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
 * run forward for ever. It's wide and tall enough to reach the screen's
 * edges and corners near the camera (0.4.1, the user: "I would like there to
 * be more of the net … Fills the screen"), at the same density as before
 * (~2.9 nodes a cubic unit), so a 16:9 screen has
 * about 1,100 nodes. Every node listens to one band picked at random (R24:
 * scattered, colour showing which). All of it comes from one seed.
 */

/** How deep the box is (world units). */
export const DEPTH = 8;
/**
 * Half the box's height and half its width on a 16:9 screen (other shapes
 * scale the width): the screen's edges at about depth 2 (the projection's
 * SCALE_OF_HEIGHT, engine.ts), so the net reaches every edge and corner.
 * 0.4.0 had 1.4 and 2.6: the edges were empty beyond depth 1.
 */
export const HALF_HEIGHT = 2.6;
export const HALF_WIDTH_16_9 = 4.6;
/** Nodes on a 16:9 screen (0.4.0's density over the larger box); other shapes scale it with the width. */
export const NODES_16_9 = 1100;
/** Each node's links: its nearest few within a distance. */
export const LINKS_PER_NODE = 5;
export const MAX_LINK = 1.1;
/** Nodes within this distance of the flight's axis rank low: a spine the main pulse can always run down. */
export const SPINE = 0.7;
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
 * The field for a screen of `aspect` (width / height). Ranks lean a little
 * low near the flight's axis (mostly noise), so a quiet net still spreads
 * over the whole screen (0.4.1: "Fills the screen") with a touch more near
 * the pulse's way. Links come from a grid of MAX_LINK cells (wrapping in
 * depth): each node looks only at the 27 cells round its own, so a resize
 * (a new field) costs a few ms, not a quadratic search.
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
    // Mostly chance; a little lower near the axis; and a spine (within SPINE of the axis) nearly
    // always there, so the main pulse always has a way down the middle.
    const out = Math.min(1, Math.hypot(x / halfWidth, y / HALF_HEIGHT) / Math.SQRT2);
    const r = Math.min(1, 0.25 * out + 0.75 * rand());
    rank[i] = Math.hypot(x, y) < SPINE ? r * 0.3 : r;
  }
  const list: number[] = [];
  const seen = new Set<number>();
  const field = { count, pos, band, rank, pairs: new Uint16Array(0), adj: [] as [number, number][][], halfWidth };
  // The grid: cells MAX_LINK on a side, wrapping in depth.
  const nx = Math.max(1, Math.ceil((2 * halfWidth) / MAX_LINK));
  const ny = Math.max(1, Math.ceil((2 * HALF_HEIGHT) / MAX_LINK));
  const nz = Math.max(1, Math.floor(DEPTH / MAX_LINK));
  const cellOf = (i: number): [number, number, number] => [
    Math.min(nx - 1, Math.floor((pos[i * 3]! + halfWidth) / MAX_LINK)),
    Math.min(ny - 1, Math.floor((pos[i * 3 + 1]! + HALF_HEIGHT) / MAX_LINK)),
    Math.min(nz - 1, Math.floor((pos[i * 3 + 2]! / DEPTH) * nz)),
  ];
  const cells = new Map<number, number[]>();
  const key3 = (x: number, y: number, z: number) => (z * ny + y) * nx + x;
  for (let i = 0; i < count; i++) {
    const [x, y, z] = cellOf(i);
    const k = key3(x, y, z);
    const c = cells.get(k);
    if (c) c.push(i);
    else cells.set(k, [i]);
  }
  for (let i = 0; i < count; i++) {
    const near: [number, number][] = [];
    const [cx, cy, cz] = cellOf(i);
    const zs = new Set([(cz - 1 + nz) % nz, cz, (cz + 1) % nz]);
    for (let x = Math.max(0, cx - 1); x <= Math.min(nx - 1, cx + 1); x++) {
      for (let y = Math.max(0, cy - 1); y <= Math.min(ny - 1, cy + 1); y++) {
        for (const z of zs) {
          for (const j of cells.get(key3(x, y, z)) ?? []) {
            if (j === i) continue;
            const d = distance(field, i, j);
            if (d < MAX_LINK) near.push([j, d]);
          }
        }
      }
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
 * nodes are present. 0.4 when silent keeps about a third of the net, spread
 * over the whole screen (34%, measured on the 16:9 field); typical music
 * (level 0.2–0.4) brings most of it in; full by about 0.55.
 */
export function density(level: number): number {
  // Up to 1.06: a little past the highest rank, so a loud net is whole (presenceTarget eases over 0.06).
  return Math.min(1.06, 0.4 + 1.1 * Math.max(0, level));
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
    // Off the centre line costs (twice: the net spreads over the whole screen, 0.4.1, and the
    // pulse should still hold the middle); a longer stride forward helps; a little noise so the path isn't fixed.
    const score = 2 * Math.hypot(p[n * 3]!, p[n * 3 + 1]!) - 0.6 * ahead + 0.25 * rand();
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

/** The camera's forward glide (unwrapped depths): where it is, and its smoothed speed. */
export interface Glide {
  depth: number;
  speed: number;
}

/**
 * Moves the camera on by `dt` s, after a pulse now at unwrapped depth
 * `pulse` that moved `step` this frame: at the pulse's forward speed
 * smoothed over `speedS`, pulled back to `follow` behind it over `holdS`.
 * Following the pulse's depth exactly steps at every node (each link points
 * another way, so the forward share of the pulse's speed jumps there); this
 * glides (0.4.2).
 */
export function glide(g: Glide, pulse: number, step: number, dt: number, follow: number, speedS: number, holdS: number): void {
  if (dt <= 0) return;
  g.speed += (step / dt - g.speed) * (1 - Math.exp(-dt / speedS));
  g.depth += g.speed * dt;
  g.depth += (pulse - follow - g.depth) * (1 - Math.exp(-dt / holdS));
}
