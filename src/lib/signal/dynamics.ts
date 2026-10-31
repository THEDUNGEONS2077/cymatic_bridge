/**
 * src/lib/signal/dynamics.ts: auto-gain and smoothing, the two steps that
 * turn decibels into steady 0..1 values a scene can draw with.
 *
 * Layer: pure lib (tested).
 *
 * Auto-gain is one peak follower over all the bands, not one per band.
 * Per-band gain would lift every band to full, so a quiet band (the hiss
 * above a bass-heavy track) would look as loud as the kick. With one gain
 * for the whole spectrum, plus bands.ts's tilt, the shape of the music
 * stays: loud bands look loud. The follower rises at once to a new peak and
 * falls slowly, so a quiet passage after a loud one grows back into view
 * over a few seconds, and a quiet track fills the range as well as a loud
 * one. It never falls below PEAK_FLOOR_DB, so silence and noise stay dark
 * instead of being lifted to full.
 */

/** The decibels shown, from the follower's peak down (dB): below peak - RANGE_DB reads 0. */
export const RANGE_DB = 48;
/** How fast the peak falls after a loud moment (dB a second). */
export const PEAK_FALL_DB_PER_S = 2.5;
/** The lowest the peak may fall (dB): quieter than this is treated as silence, not lifted. */
export const PEAK_FLOOR_DB = -62;
/** The highest it may rise (dB, with the tilt): a guard against a broken frame. */
export const PEAK_CEIL_DB = 12;

/** The peak follower's state. */
export interface Gain {
  peakDb: number;
}

/** A new follower, at its floor. */
export function newGain(): Gain {
  return { peakDb: PEAK_FLOOR_DB };
}

/**
 * Moves the follower on by `dt` seconds, given this frame's loudest band
 * (dB): up at once, down slowly, never below the floor.
 */
export function followPeak(g: Gain, loudestDb: number, dt: number): void {
  const fallen = g.peakDb - PEAK_FALL_DB_PER_S * dt;
  const next = Number.isFinite(loudestDb) ? Math.max(fallen, Math.min(PEAK_CEIL_DB, loudestDb)) : fallen;
  g.peakDb = Math.max(PEAK_FLOOR_DB, next);
}

/** A band's level (dB) as 0..1 under the follower: 1 at the peak, 0 at RANGE_DB below it. */
export function normalize(g: Gain, db: number): number {
  const v = (db - (g.peakDb - RANGE_DB)) / RANGE_DB;
  return v <= 0 || !Number.isFinite(v) ? 0 : v >= 1 ? 1 : v;
}

/** How fast a value follows its input (s): rising (attack) and falling (release) time constants. */
export interface Envelope {
  attack: number;
  release: number;
}

/**
 * One smoothing step: `current` moves toward `target` by the fraction a
 * time constant gives over `dt` (frame-rate independent: 60 and 144 Hz
 * screens smooth the same). Rising uses `attack`, falling `release`.
 */
export function smooth(current: number, target: number, dt: number, env: Envelope): number {
  const tau = target > current ? env.attack : env.release;
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}
