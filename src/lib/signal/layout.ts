/**
 * src/lib/signal/layout.ts: the shape of one SIGNAL frame, the small
 * feature set every scene draws from.
 *
 * Layer: pure lib (no browser APIs; tested). The page's analysis
 * (signal.ts) fills one Float32Array of SIGNAL_LENGTH numbers per frame and
 * posts it to the scene worker, which uploads it as one texture plus a
 * handful of uniforms (scene/gl/signalTexture.ts). Both sides read the
 * array through the offsets below, so the format lives in one place.
 *
 * Every value is already shaped for drawing: bands and groups are 0..1
 * (after gain and smoothing), the beat and accent are pulses that decay,
 * flow is a clock that runs faster when the music is loud. Scenes never
 * see audio.
 */

/** How many frequency bands, log-spaced from BAND_LOW_HZ to BAND_HIGH_HZ, per channel. */
export const BANDS = 64;
/** The lowest band's lower edge (Hz): below this a tab's music carries little but rumble. */
export const BAND_LOW_HZ = 30;
/** The highest band's upper edge (Hz): above this is mostly hiss and codec cut-off. */
export const BAND_HIGH_HZ = 16000;
/** How many points of the waveform (mono, peak-kept), for scope-style scenes. */
export const WAVE_POINTS = 64;

/** Where each part of the frame starts in the array. */
export const OFFSET = {
  /** BANDS values, 0..1: the left channel's spectrum, bass first. */
  bandsL: 0,
  /** BANDS values, 0..1: the right channel's spectrum. */
  bandsR: BANDS,
  /** WAVE_POINTS values, -1..1: the latest waveform, scaled to its own recent peak. */
  wave: BANDS * 2,
  /** The scalars, one each (SCALAR below). */
  scalars: BANDS * 2 + WAVE_POINTS,
} as const;

/** The scalars' positions after OFFSET.scalars. */
export const SCALAR = {
  /** Overall loudness, 0..1 (the mean of the bands, smoothed). */
  level: 0,
  /** Bass (30–150 Hz), 0..1. */
  bass: 1,
  /** Low mids (150–600 Hz), 0..1. */
  lowMid: 2,
  /** High mids (600–2500 Hz), 0..1. */
  highMid: 3,
  /** Treble (2.5–16 kHz), 0..1. */
  treble: 4,
  /** The beat: jumps to its strength (0.5..1) on a beat, then decays. */
  beat: 5,
  /** How many beats so far (a whole number; scenes use it to pick or seed per beat). */
  beatCount: 6,
  /** The beat accent, 0..1, limited to 3 flashes a second (strobe.ts): the only value allowed to flash the screen. */
  accent: 7,
  /** The flow clock (s): runs at 0.25–2× real time with the loudness, never jumps. */
  flow: 8,
  /** Stereo balance, -1 (left) .. 1 (right), smoothed. */
  balance: 9,
  /** How idle, 0..1: 1 when silent for a while (the bands are then a slow breath, idle.ts). */
  idle: 10,
  /** The analysis time of this frame (ms), for the signal meter. */
  cost: 11,
} as const;

/** How many scalars. */
export const SCALARS = 12;
/** The length of one SIGNAL frame. */
export const SIGNAL_LENGTH = OFFSET.scalars + SCALARS;

/** A SIGNAL frame (SIGNAL_LENGTH numbers, laid out as above). */
export type Signal = Float32Array;

/** A new, silent SIGNAL frame (fully idle). */
export function emptySignal(): Signal {
  const s = new Float32Array(SIGNAL_LENGTH);
  s[OFFSET.scalars + SCALAR.idle] = 1;
  return s;
}

/** Sets scalar `name` of a frame. */
export function setScalar(s: Signal, name: keyof typeof SCALAR, v: number): void {
  s[OFFSET.scalars + SCALAR[name]] = v;
}

/** Reads scalar `name` from a frame. */
export function scalar(s: Signal, name: keyof typeof SCALAR): number {
  return s[OFFSET.scalars + SCALAR[name]] ?? 0;
}
