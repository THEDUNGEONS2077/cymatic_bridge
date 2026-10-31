/**
 * src/lib/signal/beat.ts: finding beats in the bands.
 *
 * Layer: pure lib (tested).
 *
 * The method is spectral flux with an adaptive threshold, a common and
 * cheap onset detector. Each frame, flux is how much the bands rose since
 * the last frame (falls are ignored), weighted by the scene's profile. A
 * kick lifts the bass bands sharply, so its flux spikes. A held note or a
 * steady pad doesn't rise, so it gives no flux at all.
 *
 * A beat is a flux that stands out from the recent average: more than the
 * running mean plus THRESHOLD_SIGMA running deviations (both over about
 * HISTORY_S seconds, so a busy track needs a bigger rise than a sparse one).
 * It also has to be at least MIN_FLUX, and at least REFRACTORY_S after the
 * last beat, so one kick isn't counted twice as its rise spans frames.
 *
 * The pulse a scene sees jumps to the beat's strength (0.5..1, by how far
 * it cleared the threshold) and decays with PULSE_DECAY_S.
 */

/** How long the running mean and deviation remember (s). */
export const HISTORY_S = 1.5;
/** How many deviations above the mean a beat's flux must be. */
export const THRESHOLD_SIGMA = 1.6;
/** The smallest flux that can be a beat (in band units summed, after weights): ignores tiny rises in near-silence. */
export const MIN_FLUX = 0.35;
/** The shortest time between two beats (s): 120 ms is faster than any real beat (500 BPM). */
export const REFRACTORY_S = 0.12;
/** How fast the pulse decays (s, time constant). */
export const PULSE_DECAY_S = 0.15;

/** The detector's state. */
export interface BeatState {
  /** Last frame's band values, to measure the rise. */
  prev: Float32Array;
  /** The running mean and variance of flux. */
  mean: number;
  variance: number;
  /** Seconds since the last beat (Infinity: none yet). */
  since: number;
  /** The pulse, 0..1. */
  pulse: number;
  /** Beats so far. */
  count: number;
}

/** A new detector for `bands` bands. */
export function newBeat(bands: number): BeatState {
  return { prev: new Float32Array(bands), mean: 0, variance: 0, since: Infinity, pulse: 0, count: 0 };
}

/**
 * One frame: the flux of `bands` (0..1 each) against last frame's, weighted
 * per band by `weights`, over `dt` seconds. Updates the pulse, and returns
 * the strength of a beat found this frame (0: none).
 */
export function detectBeat(state: BeatState, bands: Float32Array, weights: Float32Array, dt: number): number {
  // The rise of every band since the last frame, weighted (falls don't count).
  let flux = 0;
  for (let i = 0; i < bands.length; i++) {
    const rise = bands[i]! - state.prev[i]!;
    if (rise > 0) flux += rise * (weights[i] ?? 1);
    state.prev[i] = bands[i]!;
  }
  // Frame-rate independent: flux per 60th of a second, so 144 Hz screens see the same beats.
  flux *= 1 / 60 / Math.max(dt, 1 / 240);

  state.since += dt;
  state.pulse *= Math.exp(-dt / PULSE_DECAY_S);

  const deviation = Math.sqrt(state.variance);
  const threshold = Math.max(MIN_FLUX, state.mean + THRESHOLD_SIGMA * deviation);
  let strength = 0;
  if (flux > threshold && state.since >= REFRACTORY_S) {
    // How far it cleared the threshold: a bare beat 0.5, double the threshold or more 1.
    strength = Math.min(1, 0.5 + 0.5 * ((flux - threshold) / threshold));
    state.pulse = Math.max(state.pulse, strength);
    state.since = 0;
    state.count++;
  }

  // The running mean and variance (exponential, over HISTORY_S), updated after the test so a beat doesn't raise its own bar.
  const k = 1 - Math.exp(-dt / HISTORY_S);
  const diff = flux - state.mean;
  state.mean += k * diff;
  state.variance = (1 - k) * (state.variance + k * diff * diff);
  return strength;
}

/**
 * Per-band weights for the flux from a profile's group weights: bands in
 * each of the four groups (bass, low mids, high mids, treble: index ranges)
 * take that group's weight.
 */
export function beatWeights(bands: number, groups: readonly [number, number][], groupWeights: readonly number[]): Float32Array {
  const w = new Float32Array(bands);
  groups.forEach(([from, to], g) => {
    for (let i = from; i < to; i++) w[i] = groupWeights[g] ?? 1;
  });
  return w;
}
