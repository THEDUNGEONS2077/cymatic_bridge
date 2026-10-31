/**
 * src/lib/signal/idle.ts: what the scene sees when nothing is playing.
 *
 * Layer: pure lib (tested).
 *
 * The user wants the page to keep breathing slowly when idle (R14): before
 * LISTEN, while the music is paused, after sharing ends. So when the
 * signal has been silent for SILENT_AFTER_S, the idle amount eases up to 1
 * and the bands blend into a synthetic breath: a low, slow swell that
 * drifts across the spectrum. Scenes then draw the same way they always do,
 * just at low energy, and need no idle code of their own. When the sound
 * returns, idle eases back to 0 in about EASE_S.
 */

/** How long it must be silent before idling starts (s): a gap between songs shouldn't drop to idle. */
export const SILENT_AFTER_S = 1.5;
/** Below this mean band value (0..1, after gain) a frame counts as silent. */
export const SILENT_LEVEL = 0.02;
/** How fast idle eases in and out (s, time constant). */
export const EASE_S = 0.8;
/** The breath's cycle (s): slow enough to read as calm. */
export const BREATH_S = 7;
/** The breath's mean level and swing (0..1). */
export const BREATH_LEVEL = 0.14;
export const BREATH_SWING = 0.08;

/** The idle tracker's state. */
export interface Idle {
  /** How idle, 0..1 (1: fully idle). */
  amount: number;
  /** Seconds the signal has been silent. */
  silentFor: number;
}

/** A new tracker: fully idle (nothing has played yet). */
export function newIdle(): Idle {
  return { amount: 1, silentFor: Infinity };
}

/** One frame of `dt` seconds at mean band value `level` (0..1). Returns how idle, 0..1. */
export function stepIdle(s: Idle, level: number, dt: number): number {
  s.silentFor = level < SILENT_LEVEL ? s.silentFor + dt : 0;
  const target = s.silentFor >= SILENT_AFTER_S ? 1 : 0;
  s.amount += (target - s.amount) * (1 - Math.exp(-dt / EASE_S));
  return s.amount;
}

/**
 * The breath's value for band position `x` (0 = bass .. 1 = treble) at
 * time `t` (s): a slow swell, a wave drifting from bass to treble, falling
 * off toward the treble the way music does.
 */
export function breath(x: number, t: number): number {
  const phase = (2 * Math.PI * t) / BREATH_S;
  const swell = Math.sin(phase);
  const drift = Math.sin(phase * 0.6 - x * 5.3);
  const v = BREATH_LEVEL + BREATH_SWING * (0.6 * swell + 0.4 * drift);
  return Math.max(0, v * (1 - 0.55 * x));
}
