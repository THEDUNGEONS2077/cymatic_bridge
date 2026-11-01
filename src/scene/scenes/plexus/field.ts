/**
 * src/scene/scenes/plexus/field.ts: PLEXUS's world: the nodes the camera
 * flies through, their links, and the signals that race along them.
 *
 * Layer: scene, pure (no GL, no DOM; tested in Node). The user picked the
 * FLIGHT variation of the DEPTH direction (mock-ups round 2, 2026-11-01:
 * "I like B2 - Flight"). The world is a box of nodes, DEPTH deep, that wraps
 * round in depth: the camera flies forward through it for ever, and a node
 * that passes the camera comes back at the far end. The box is as wide as
 * the screen's shape needs, so a wide screen gets more nodes, not stretched
 * ones.
 *
 * Every node listens to one band picked at random (R24: scattered, colour
 * showing which). Links join each node to its LINKS_PER_NODE nearest within
 * MAX_LINK, measured across the wrap, so the field has no seam. All of it
 * comes from one seed: the same screen shape always gives the same field.
 */

/** How deep the box is (world units); the camera sees all of it, faded far off. */
export const DEPTH = 8;
/** Half the box's height (world units). */
export const HALF_HEIGHT = 1.4;
/** Half its width on a 16:9 screen; other shapes scale it. */
export const HALF_WIDTH_16_9 = 2.6;
/** Nodes on a 16:9 screen (mock-up B2's 300); other shapes scale it with the width. */
export const NODES_16_9 = 300;
/** Each node's nearest neighbours that get a link, and the longest a link may be. */
export const LINKS_PER_NODE = 3;
export const MAX_LINK = 0.95;
/** The field's seed. */
export const SEED = 31;

/** The world. */
export interface Field {
  /** How many nodes. */
  count: number;
  /** Each node's x, y, z (z in 0..DEPTH). */
  pos: Float32Array;
  /** Each node's band position, 0 (bass) .. 1 (treble). */
  band: Float32Array;
  /** Links as node pairs (a, b, a, b …). */
  links: Uint16Array;
  /** Each node's neighbours, by link. */
  adj: number[][];
  /** The box's half width. */
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

/** Depth `z` seen from a camera at `camZ`: 0 (at the camera) .. DEPTH (the far end). */
export function ahead(z: number, camZ: number): number {
  return (((z - camZ) % DEPTH) + DEPTH) % DEPTH;
}

/** The field for a screen of `aspect` (width / height). */
export function buildField(aspect: number, seed = SEED): Field {
  const shape = Math.min(2.4, Math.max(0.5, aspect / (16 / 9)));
  const halfWidth = HALF_WIDTH_16_9 * shape;
  const count = Math.round(NODES_16_9 * shape);
  const rand = seeded(seed);
  const pos = new Float32Array(count * 3);
  const band = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() * 2 - 1) * halfWidth;
    pos[i * 3 + 1] = (rand() * 2 - 1) * HALF_HEIGHT;
    pos[i * 3 + 2] = rand() * DEPTH;
    band[i] = rand();
  }
  // Each node's nearest few, across the wrap; a pair is linked once.
  const dist = (i: number, j: number) =>
    Math.hypot(pos[i * 3]! - pos[j * 3]!, pos[i * 3 + 1]! - pos[j * 3 + 1]!, wrapGap(pos[i * 3 + 2]!, pos[j * 3 + 2]!));
  const pairs: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i++) {
    const near: [number, number][] = [];
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const d = dist(i, j);
      if (d < MAX_LINK) near.push([j, d]);
    }
    near.sort((a, b) => a[1] - b[1]);
    for (const [j] of near.slice(0, LINKS_PER_NODE)) {
      const key = Math.min(i, j) * count + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(Math.min(i, j), Math.max(i, j));
    }
  }
  const links = Uint16Array.from(pairs);
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (let k = 0; k < links.length; k += 2) {
    adj[links[k]!]!.push(links[k + 1]!);
    adj[links[k + 1]!]!.push(links[k]!);
  }
  return { count, pos, band, links, adj, halfWidth };
}

/** A signal: light running from node `from` to node `to` (`t` 0..1 of the way), with `hops` links still to run. */
export interface Signal {
  from: number;
  to: number;
  t: number;
  hops: number;
}

/** How many links a signal runs a second. */
export const SIGNAL_SPEED = 2.4;
/** At most this many signals at once (a dense beat can't flood the field). */
export const MAX_SIGNALS = 64;

/** Fires a signal from node `from` along a random link, to run `hops` links. */
export function fire(field: Field, signals: Signal[], from: number, hops: number, rand: () => number): void {
  const out = field.adj[from]!;
  if (!out.length || signals.length >= MAX_SIGNALS) return;
  signals.push({ from, to: out[Math.floor(rand() * out.length)]!, t: 0, hops });
}

/**
 * Moves the signals on by `dt` s. One that reaches its node calls
 * `arrive(node)` and runs on along another link (never straight back)
 * until its hops are spent.
 */
export function stepSignals(field: Field, signals: Signal[], dt: number, rand: () => number, arrive: (node: number) => void): void {
  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i]!;
    s.t += dt * SIGNAL_SPEED;
    if (s.t < 1) continue;
    arrive(s.to);
    const next = field.adj[s.to]!.filter((n) => n !== s.from);
    if (s.hops > 1 && next.length) {
      signals[i] = { from: s.to, to: next[Math.floor(rand() * next.length)]!, t: s.t - 1, hops: s.hops - 1 };
    } else signals.splice(i, 1);
  }
}
