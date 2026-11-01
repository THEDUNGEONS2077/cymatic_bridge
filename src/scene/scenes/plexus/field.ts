/**
 * src/scene/scenes/plexus/field.ts: PLEXUS's world: the nodes the camera
 * flies through, how they move, which of them connect, and the signals that
 * race along the connections.
 *
 * Layer: scene, pure (no GL, no DOM; tested in Node). The user picked the
 * FLIGHT variation of the DEPTH direction (mock-ups round 2, 2026-11-01:
 * "I like B2 - Flight"), then asked for more life (0.4.0 build: "I want
 * the neural net to shift and form new connections and be way more
 * reactive to the music"). So the net is alive:
 *   - every node wanders on a slow orbit of its own around its home, so
 *     distances keep changing;
 *   - the music pushes nodes outward from the flight's axis, each by its
 *     band's loudness, and a beat sends a shockwave out (kicks), so the
 *     tunnel breathes;
 *   - links aren't fixed: each node has a few candidate neighbours, and a
 *     candidate is linked while the two are within reach, and the reach
 *     grows with their loudness. Loud nodes connect further; quiet ones let
 *     go. The engine eases each link in and out, so the net visibly rewires.
 *
 * The box of nodes is DEPTH deep and wraps round in depth: the camera flies
 * forward for ever. It's as wide as the screen's shape needs (a wide screen
 * gets more nodes, not stretched ones). Every node listens to one band
 * picked at random (R24: scattered, colour showing which). All of it comes
 * from one seed: the same screen shape always gives the same field.
 */

/** How deep the box is (world units); the camera sees all of it, faded far off. */
export const DEPTH = 8;
/** Half the box's height (world units). */
export const HALF_HEIGHT = 1.4;
/** Half its width on a 16:9 screen; other shapes scale it. */
export const HALF_WIDTH_16_9 = 2.6;
/** Nodes on a 16:9 screen; other shapes scale it with the width. */
export const NODES_16_9 = 300;
/** Each node's nearest candidates for a link, and the farthest a candidate may be (home to home). */
export const CANDIDATES_PER_NODE = 8;
export const MAX_CANDIDATE = 1.7;
/** A link's reach: this when both ends are silent, up to this much more when one end is at full loudness. */
export const REACH_QUIET = 0.58;
export const REACH_LOUD = 0.85;
/** The wander: each node's orbit radius (world units) and period (s), drawn between these. */
export const WANDER_MIN = 0.12;
export const WANDER_MAX = 0.4;
export const WANDER_PERIOD_MIN = 9;
export const WANDER_PERIOD_MAX = 26;
/** How far the music pushes a node out from the axis at full loudness, and how hard a beat's shockwave kicks. */
export const PUSH_LOUD = 0.35;
export const KICK = 0.45;
/** The field's seed. */
export const SEED = 31;

/** The world. */
export interface Field {
  /** How many nodes. */
  count: number;
  /** Each node's home x, y, z (z in 0..DEPTH). */
  home: Float32Array;
  /** Each node's band position, 0 (bass) .. 1 (treble). */
  band: Float32Array;
  /** Each node's wander: radius, angular speed (rad/s), phase. */
  wander: Float32Array;
  /** Candidate links as node pairs (a, b, a, b …), a < b. */
  pairs: Uint16Array;
  /** Each node's candidates: [neighbour, pair index]. */
  adj: [number, number][][];
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

/** The signed step from depth a to depth b, the short way across the wrap. */
export function wrapStep(a: number, b: number): number {
  const d = (((b - a) % DEPTH) + DEPTH * 1.5) % DEPTH - DEPTH / 2;
  return d;
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
  const home = new Float32Array(count * 3);
  const band = new Float32Array(count);
  const wander = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    home[i * 3] = (rand() * 2 - 1) * halfWidth;
    home[i * 3 + 1] = (rand() * 2 - 1) * HALF_HEIGHT;
    home[i * 3 + 2] = rand() * DEPTH;
    band[i] = rand();
    wander[i * 3] = WANDER_MIN + rand() * (WANDER_MAX - WANDER_MIN);
    wander[i * 3 + 1] = (Math.PI * 2) / (WANDER_PERIOD_MIN + rand() * (WANDER_PERIOD_MAX - WANDER_PERIOD_MIN)) * (rand() < 0.5 ? -1 : 1);
    wander[i * 3 + 2] = rand() * Math.PI * 2;
  }
  // Each node's nearest few, across the wrap; a pair is listed once.
  const dist = (i: number, j: number) =>
    Math.hypot(home[i * 3]! - home[j * 3]!, home[i * 3 + 1]! - home[j * 3 + 1]!, wrapGap(home[i * 3 + 2]!, home[j * 3 + 2]!));
  const list: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i++) {
    const near: [number, number][] = [];
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const d = dist(i, j);
      if (d < MAX_CANDIDATE) near.push([j, d]);
    }
    near.sort((a, b) => a[1] - b[1]);
    for (const [j] of near.slice(0, CANDIDATES_PER_NODE)) {
      const key = Math.min(i, j) * count + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(Math.min(i, j), Math.max(i, j));
    }
  }
  const pairs = Uint16Array.from(list);
  const adj: [number, number][][] = Array.from({ length: count }, () => []);
  for (let k = 0; k < pairs.length; k += 2) {
    adj[pairs[k]!]!.push([pairs[k + 1]!, k / 2]);
    adj[pairs[k + 1]!]!.push([pairs[k]!, k / 2]);
  }
  return { count, home, band, wander, pairs, adj, halfWidth };
}

/**
 * Where every node is at time `t` (s), into `out` (x, y, z per node): its
 * home, plus its wander orbit, plus a push out from the flight's axis (the
 * centre line, x = y = 0): `loud[i]` (0..1, its band's loudness) times
 * PUSH_LOUD, and `kick[i]` (the beat's shockwave, eased by the engine).
 */
export function placeNodes(field: Field, t: number, loud: Float32Array, kick: Float32Array, out: Float32Array): void {
  const { home, wander, count } = field;
  for (let i = 0; i < count; i++) {
    const r = wander[i * 3]!;
    const a = wander[i * 3 + 2]! + t * wander[i * 3 + 1]!;
    let x = home[i * 3]! + Math.cos(a) * r;
    let y = home[i * 3 + 1]! + Math.sin(a * 0.83) * r * 0.7;
    const z = home[i * 3 + 2]! + Math.sin(a * 0.61 + 1.7) * r * 0.6;
    // Out from the axis: the tunnel breathes with the music.
    const len = Math.hypot(x, y) || 1;
    const push = loud[i]! * PUSH_LOUD + kick[i]!;
    x += (x / len) * push;
    y += (y / len) * push;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
}

/** A candidate link's reach for two ends of loudness `a` and `b` (0..1): the louder end reaches further. */
export function reach(a: number, b: number): number {
  return REACH_QUIET + REACH_LOUD * Math.max(a, b);
}

/** How linked a candidate pair at distance `d` should be (0..1): fully within 80% of reach, fading to none at reach. */
export function linkTarget(d: number, a: number, b: number): number {
  const r = reach(a, b);
  const t = (r - d) / (0.2 * r);
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/** The distance between nodes i and j at positions `pos` (across the depth wrap). */
export function distanceAt(pos: Float32Array, i: number, j: number): number {
  return Math.hypot(pos[i * 3]! - pos[j * 3]!, pos[i * 3 + 1]! - pos[j * 3 + 1]!, wrapGap(pos[i * 3 + 2]!, pos[j * 3 + 2]!));
}

/** A signal: light running from node `from` to node `to` (`t` 0..1 of the way), with `hops` links still to run. */
export interface Signal {
  from: number;
  to: number;
  t: number;
  hops: number;
}

/** How many links a signal runs a second. */
export const SIGNAL_SPEED = 2.8;
/** At most this many signals at once (a dense beat can't flood the field). */
export const MAX_SIGNALS = 96;

/** Links a signal may run along: those linked at least this much now. */
export const SIGNAL_LINK = 0.35;

/**
 * Fires a signal from node `from` along one of its live links (`live(pair)`
 * says how linked a pair is now), to run `hops` links. None if it has no
 * live link.
 */
export function fire(field: Field, signals: Signal[], from: number, hops: number, rand: () => number, live: (pair: number) => number): void {
  if (signals.length >= MAX_SIGNALS) return;
  const out = field.adj[from]!.filter(([, p]) => live(p) >= SIGNAL_LINK);
  if (!out.length) return;
  signals.push({ from, to: out[Math.floor(rand() * out.length)]![0], t: 0, hops });
}

/**
 * Moves the signals on by `dt` s. One that reaches its node calls
 * `arrive(node)` and runs on along another live link (never straight back)
 * until its hops are spent or there's nowhere live to go.
 */
export function stepSignals(field: Field, signals: Signal[], dt: number, rand: () => number, live: (pair: number) => number, arrive: (node: number) => void): void {
  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i]!;
    s.t += dt * SIGNAL_SPEED;
    if (s.t < 1) continue;
    arrive(s.to);
    const next = field.adj[s.to]!.filter(([n, p]) => n !== s.from && live(p) >= SIGNAL_LINK);
    if (s.hops > 1 && next.length) {
      signals[i] = { from: s.to, to: next[Math.floor(rand() * next.length)]![0], t: s.t - 1, hops: s.hops - 1 };
    } else signals.splice(i, 1);
  }
}
