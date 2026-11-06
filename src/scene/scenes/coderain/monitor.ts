/**
 * src/scene/scenes/coderain/monitor.ts: CODE RAIN EQ's horizon monitor: a
 * heartbeat line that a bouncing scan writes along the horizon.
 *
 * Layer: scene (pure: no WebGL, no DOM; tested in Node,
 * src/__tests__/coderain.test.ts). The user's picks, in order (S5 mock-ups,
 * mockups/code-rain-layers … code-rain-scan): the horizon "as if it's a
 * heartbeat pattern line"; MONITOR (a point sweeping along it, writing the
 * trace); its SCAN (the point carries a beam that lights the code: drawn by
 * the engine); and that scan's BOUNCE: the point sweeps across and back,
 * like a scanner, never jumping back to the start.
 *   - The heartbeat: each beat writes an ECG's sharp middle (Q dips, R
 *     spikes 28 ms after the beat, so the spike lands with the kick, S dips)
 *     and then a rounded T. No P bump: it comes before the beat, which a
 *     monitor can't know yet. A beat's strength sets its height.
 *   - The resting heartbeat: after REST_AFTER_S without a beat, a small,
 *     slow beat every REST_EVERY_S, so the line never flatlines (in silence
 *     too: the idle breath, R14, as a pulse).
 *   - The trace: COLS columns across the view. Each frame the scan moves
 *     on by dt / SWEEP_S of the view, turning round at either edge, and
 *     writes every column it crosses with the heartbeat at the moment it
 *     crossed it, so a spike's shape doesn't depend on the frame rate. Each
 *     column keeps when it was written: the trace fades as it ages, and two
 *     neighbours written on different passes aren't joined (horizon.frag).
 *     On the way back the trace runs mirror-wise; that's the bounce.
 */

/** Columns across the view that the trace is written into. */
export const COLS = 1024;
/** How long the scan takes to cross the view, one way (s). */
export const SWEEP_S = 2;
/** The heartbeat's sharp middle, as corners in time (s after the beat → height, in spike heights), joined by straight lines. */
export const QRS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.012, -0.1],
  [0.028, 1],
  [0.046, -0.3],
  [0.066, 0],
];
/** When the spike peaks (s after the beat). */
export const R_TIME = 0.028;
/** The T wave: a rounded bump from T_START to T_END (s after the beat), T_HEIGHT high. */
export const T_START = 0.12;
export const T_END = 0.3;
export const T_HEIGHT = 0.26;
/** The resting heartbeat: after REST_AFTER_S without a beat, one every REST_EVERY_S, REST_STRENGTH strong (a real beat is 0.65–1). */
export const REST_AFTER_S = 1.6;
export const REST_EVERY_S = 1.1;
export const REST_STRENGTH = 0.32;
/** A column's write time before it's first written: far in the past (the shader skips it). */
export const NEVER = -1e9;

/** A heartbeat's height `t` s after its beat (in spike heights): flat before it, the QRS corners, the rounded T, flat after. */
export function ecgAt(t: number): number {
  if (t < 0 || t > T_END) return 0;
  if (t >= T_START) return T_HEIGHT * Math.sin(((t - T_START) / (T_END - T_START)) * Math.PI);
  for (let k = 0; k < QRS.length - 1; k++) {
    const [t0, y0] = QRS[k]!;
    const [t1, y1] = QRS[k + 1]!;
    if (t >= t0 && t < t1) return y0 + ((y1 - y0) * (t - t0)) / (t1 - t0);
  }
  return 0;
}

/** A beat the monitor is drawing: when (its clock) and how strong. */
interface Beat {
  t: number;
  a: number;
}

/** The monitor's state. */
export interface Monitor {
  /** Each column's height (spike heights). */
  trace: Float32Array;
  /** When each column was written (the monitor's clock, s; NEVER before). */
  wrote: Float32Array;
  /** Where the scan is across the view (0 left edge .. 1 right edge) and which way it's going (1 right, -1 left). */
  head: number;
  dir: 1 | -1;
  /** The monitor's clock (s): the sum of its steps. */
  now: number;
  /** The heartbeat at the scan now (spike heights). */
  live: number;
  /** The columns the last step wrote, lo..hi (lo > hi: none): what the engine uploads. */
  lo: number;
  hi: number;
  /** The beats still being drawn. */
  beats: Beat[];
  /** Seconds since the last real beat, and until the next resting one. */
  quiet: number;
  wait: number;
}

/** A monitor at the left edge, heading right, nothing written yet. */
export function createMonitor(): Monitor {
  return { trace: new Float32Array(COLS), wrote: new Float32Array(COLS).fill(NEVER), head: 0, dir: 1, now: 0, live: 0, lo: COLS, hi: -1, beats: [], quiet: 0, wait: 0 };
}

/** A real beat of `strength` (0.65–1): its heartbeat starts now; the resting beat waits again. */
export function monitorBeat(m: Monitor, strength: number): void {
  m.beats.push({ t: m.now, a: strength });
  m.quiet = 0;
}

/** The heartbeat at moment `t` (the monitor's clock): every beat still being drawn, from its start. */
export function heartAt(m: Monitor, t: number): number {
  let y = 0;
  for (const b of m.beats) y += b.a * ecgAt(t - b.t);
  return y;
}

/** Writes column `c` with the heartbeat at moment `t`, the moment the scan crossed it. */
function put(m: Monitor, c: number, t: number): void {
  m.trace[c] = heartAt(m, t);
  m.wrote[c] = t;
  if (c < m.lo) m.lo = c;
  if (c > m.hi) m.hi = c;
}

/**
 * Writes the columns the scan crosses going from `p0` to `p1` (positions
 * 0..1, either way) between moments `t0` and `t1`: each after p0 up to p1,
 * at the moment the scan reached it.
 */
function writeSpan(m: Monitor, p0: number, p1: number, t0: number, t1: number): void {
  const a = p0 * (COLS - 1);
  const b = p1 * (COLS - 1);
  if (b > a) for (let c = Math.floor(a) + 1; c <= Math.floor(b); c++) put(m, c, t0 + ((c - a) / (b - a)) * (t1 - t0));
  else if (b < a) for (let c = Math.ceil(a) - 1; c >= Math.ceil(b); c--) put(m, c, t0 + ((a - c) / (a - b)) * (t1 - t0));
}

/**
 * Moves the monitor on by `dt` s: a resting beat when one is due, then the
 * scan on by dt / SWEEP_S of the view (turning round at either edge),
 * writing every column it crosses; then the clock, the heartbeat at the
 * scan, and the beats that are done dropped.
 */
export function stepMonitor(m: Monitor, dt: number): void {
  m.quiet += dt;
  if (m.quiet >= REST_AFTER_S) {
    m.wait -= dt;
    if (m.wait <= 0) {
      m.beats.push({ t: m.now, a: REST_STRENGTH });
      m.wait = REST_EVERY_S;
    }
  } else m.wait = 0;

  m.lo = COLS;
  m.hi = -1;
  const delta = dt / SWEEP_S;
  let p = m.head;
  let t0 = m.now;
  let left = delta;
  while (left > 1e-12) {
    const room = m.dir > 0 ? 1 - p : p;
    const go = Math.min(left, room);
    const turn = go >= room;
    // At an edge exactly (so the edge column is always written), else part-way.
    const p1 = turn ? (m.dir > 0 ? 1 : 0) : p + m.dir * go;
    const t1 = t0 + (go / delta) * dt;
    writeSpan(m, p, p1, t0, t1);
    p = p1;
    t0 = t1;
    left -= go;
    if (turn) m.dir = m.dir > 0 ? -1 : 1;
  }
  m.head = p;
  m.now += dt;
  m.live = heartAt(m, m.now);
  // Beats whose heartbeat is drawn, in place (no allocation a frame).
  let keep = 0;
  for (const b of m.beats) if (m.now - b.t <= T_END + 0.05) m.beats[keep++] = b;
  m.beats.length = keep;
}
