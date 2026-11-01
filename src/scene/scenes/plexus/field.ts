/**
 * src/scene/scenes/plexus/field.ts: PLEXUS's world: a net of nodes, which
 * of them are there, and the pulses that travel through it.
 *
 * Layer: scene, pure (no GL, no DOM; tested in Node). The design, from the
 * user's answers on 2026-11-01 after two builds that weren't right (the
 * second "too chaotic / busy"):
 *   - the view stays as it was (looking forward, down the depth of the net,
 *     B2 FLIGHT), and "the pulse moves forward through the neural net as it
 *     moves";
 *   - "a central pulse that travels from node to node, branching off into
 *     small pulses but the main one stays in focus": one MAIN pulse runs
 *     forward along links, keeping near the centre; the camera follows it;
 *     on beats, small BRANCH pulses split off it, run a few links and end;
 *   - the net "grows and shrinks" with the music: every node has a rank,
 *     and the louder the music the more ranks are present, so loud passages
 *     fill the net and quiet ones thin it;
 *   - "pulse leaves a mark": a link a pulse has run along glows, fading.
 * The net itself holds still: no wander, no rewiring.
 *
 * The box of nodes is DEPTH deep and wraps round in depth, so the pulse can
 * run forward for ever. It's as wide as the screen's shape needs. Every node
 * listens to one band picked at random (R24: scattered, colour showing
 * which). All of it comes from one seed.
 */

/** How deep the box is (world units). */
export const DEPTH = 8;
/** Half the box's height (world units). */
export const HALF_HEIGHT = 1.4;
/** Half its width on a 16:9 screen; other shapes scale it. */
export const HALF_WIDTH_16_9 = 2.6;
/** Nodes on a 16:9 screen; other shapes scale it with the width. */
export const NODES_16_9 = 340;
/** Each node's links: its nearest few within a distance. */
export const LINKS_PER_NODE = 5;
export const MAX_LINK = 1.1;
/** The field's seed. */
export const SEED = 31;

/** The world. */
export interface Field {
  count: number;
  /** Each node's x, y, z (z in 0..DEPTH). */
  pos: Float32Array;
  /** Each node's band position, 0 (bass) .. 1 (treble). */
  band: Float32Array;
  /** Each node's rank, 0..1: it's present while the music's density is above it. */
  rank: Float32Array;
  /** Links as node pairs (a, b, a, b …), a < b. */
  pairs: Uint16Array;
  /** Each node's links: [neighbour, pair index]. */
  adj: [number, number][][];
  halfWidth: number;
}

/** A seeded random in [0, 1) (Park–Miller, as cyberdeck's fields). */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** How far apart two depths are, across the wrap. */
export function wrapGap(a: number, b: number): number {
  const d = Math.abs(a - b) % DEPTH;
  return Math.min(d, DEPTH - d);
}

/** The signed step from depth a to depth b, the short way across the wrap. */
export function wrapStep(a: number, b: number): number {
  return ((((b - a) % DEPTH) + DEPTH * 1.5) % DEPTH) - DEPTH / 2;
}

/** The distance between nodes i and j (across the depth wrap). */
export function distance(field: Field, i: number, j: number): number {
  const p = field.pos;
  return Math.hypot(p[i * 3]! - p[j * 3]!, p[i * 3 + 1]! - p[j * 3 + 1]!, wrapGap(p[i * 3 + 2]!, p[j * 3 + 2]!));
}

/**
 * The field for a screen of `aspect` (width / height). Ranks are low near
 * the flight's axis and spread outward (plus noise), so the net always
 * keeps a spine for the main pulse, and grows outward as the music fills.
 */
export function buildField(aspect: number, seed = SEED): Field {
  const shape = Math.min(2.4, Math.max(0.5, aspect / (16 / 9)));
  const halfWidth = HALF_WIDTH_16_9 * shape;
  const count = Math.round(NODES_16_9 * shape);
  const rand = seeded(seed);
  const pos = new Float32Array(count * 3);
  const band = new Float32Array(count);
  const rank = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * halfWidth;
    const y = (rand() * 2 - 1) * HALF_HEIGHT;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = rand() * DEPTH;
    band[i] = rand();
    // Near the axis ranks low (always there); out at the edges, high (there only when loud).
    const out = Math.min(1, Math.hypot(x / halfWidth, y / HALF_HEIGHT) / Math.SQRT2);
    rank[i] = Math.min(1, 0.6 * out + 0.4 * rand());
  }
  const list: number[] = [];
  const seen = new Set<number>();
  const field = { count, pos, band, rank, pairs: new Uint16Array(0), adj: [] as [number, number][][], halfWidth };
  for (let i = 0; i < count; i++) {
    const near: [number, number][] = [];
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const d = distance(field, i, j);
      if (d < MAX_LINK) near.push([j, d]);
    }
    near.sort((a, b) => a[1] - b[1]);
    for (const [j] of near.slice(0, LINKS_PER_NODE)) {
      const key = Math.min(i, j) * count + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(Math.min(i, j), Math.max(i, j));
    }
  }
  field.pairs = Uint16Array.from(list);
  field.adj = Array.from({ length: count }, () => []);
  for (let k = 0; k < field.pairs.length; k += 2) {
    field.adj[field.pairs[k]!]!.push([field.pairs[k + 1]!, k / 2]);
    field.adj[field.pairs[k + 1]!]!.push([field.pairs[k]!, k / 2]);
  }
  return field;
}

/**
 * How dense the net is at loudness `level` (0..1): the rank below which
 * nodes are present. 0.47 when silent keeps about a third of the net, most
 * of it near the axis (measured on the 16:9 field); typical music (level
 * 0.2–0.4) brings most of it in; full by about 0.5.
 */
export function density(level: number): number {
  return Math.min(1, 0.47 + 1.1 * Math.max(0, level));
}

/** How present node `i` should be at density `d`: 1 below its rank, 0 above, eased across a small margin. */
export function presenceTarget(field: Field, i: number, d: number): number {
  const t = (d - field.rank[i]!) / 0.06;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** The node the main pulse runs to next from `at`: present, ahead, and keeping to the centre. */
export function nextForward(field: Field, at: number, present: (node: number) => number, rand: () => number): number {
  const p = field.pos;
  const z0 = p[at * 3 + 2]!;
  let best = -1;
  let bestScore = Infinity;
  for (const [n] of field.adj[at]!) {
    if (present(n) < 0.5) continue;
    const ahead = wrapStep(z0, p[n * 3 + 2]!);
    if (ahead < 0.08) continue;
    // Off the centre line costs; a longer stride forward helps; a little noise so the path isn't fixed.
    const score = Math.hypot(p[n * 3]!, p[n * 3 + 1]!) - 0.6 * ahead + 0.25 * rand();
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  if (best >= 0) return best;
  // A dead end: the nearest present node ahead anywhere near the centre (a jump, but never backward).
  for (let n = 0; n < field.count; n++) {
    if (n === at || present(n) < 0.5) continue;
    const ahead = wrapStep(z0, p[n * 3 + 2]!);
    if (ahead < 0.08 || ahead > DEPTH / 2) continue;
    const score = Math.hypot(p[n * 3]!, p[n * 3 + 1]!) + ahead;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best >= 0 ? best : at;
}

/** A pulse running from node `from` to node `to` (`t` 0..1 of the way). Branches also count down `hops`. */
export interface Pulse {
  from: number;
  to: number;
  t: number;
  hops: number;
  /** The link it's on (-1: a dead-end jump, along no link). */
  pair: number;
}

/** The pair joining a and b (-1 if none). */
export function pairOf(field: Field, a: number, b: number): number {
  for (const [n, p] of field.adj[a]!) if (n === b) return p;
  return -1;
}

/** How many branches can run at once. */
export const MAX_BRANCHES = 40;

/**
 * Starts `count` branches from node `at`, each along a different present
 * link (not `except`, the main pulse's own way), to run `hops` links.
 */
export function branch(field: Field, branches: Pulse[], at: number, count: number, hops: number, except: number, present: (node: number) => number, rand: () => number): void {
  const out = field.adj[at]!.filter(([n]) => n !== except && present(n) >= 0.5);
  for (let k = 0; k < count && out.length && branches.length < MAX_BRANCHES; k++) {
    const [to, pair] = out.splice(Math.floor(rand() * out.length), 1)[0]!;
    branches.push({ from: at, to, t: 0, hops, pair });
  }
}

/**
 * Moves branches on by `dt` s at `speed` links a second; one that reaches
 * its node marks its link (`mark(pair)`) and runs on along another present
 * link (never back) until its hops are spent.
 */
export function stepBranches(field: Field, branches: Pulse[], dt: number, speed: number, present: (node: number) => number, rand: () => number, mark: (pair: number) => void): void {
  for (let i = branches.length - 1; i >= 0; i--) {
    const b = branches[i]!;
    b.t += dt * speed;
    if (b.pair >= 0) mark(b.pair);
    if (b.t < 1) continue;
    const next = field.adj[b.to]!.filter(([n]) => n !== b.from && present(n) >= 0.5);
    if (b.hops > 1 && next.length) {
      const [to, pair] = next[Math.floor(rand() * next.length)]!;
      branches[i] = { from: b.to, to, t: b.t - 1, hops: b.hops - 1, pair };
    } else branches.splice(i, 1);
  }
}
