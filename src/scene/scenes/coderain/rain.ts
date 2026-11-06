/**
 * src/scene/scenes/coderain/rain.ts: CODE RAIN EQ's code and warp, and the
 * flight that carries them.
 *
 * Layer: scene (pure: no WebGL, no DOM; tested in Node,
 * src/__tests__/coderain.test.ts). The look is the user's pick of the S5
 * mock-ups, C8 LAYERS (mockups/code-rain-rush-warp, then
 * mockups/code-rain-layers … code-rain-scan): the camera looks down a
 * tunnel of code from its vanishing point, which sits on the horizon.
 *   - The streams (C1 RUSH): STREAMS streams of glyphs round the axis, each
 *     on its own band for life. A stream's head rushes toward the camera with
 *     its trail of glyphs behind it, farther away; its band's loudness sets
 *     its speed and its trail's length (eased); the treble flickers its
 *     glyphs; a beat flares the bass streams' heads. Calm and readable: the
 *     code, in front.
 *   - The specks (C5 WARP, as light only): SPECKS thin streaks anywhere
 *     across the view, behind the code. Their length grows with the flight's
 *     speed: dots at cruise, long streaks in a surge.
 *   - The flight (C5's engine): a speed that eases toward a cruise plus the
 *     level plus the beat's surge, quickly up (a lunge) and slowly down (a
 *     glide), so it never jumps. The specks ride it; the streams keep C1's
 *     pace, nudged a little by it, so the two layers feel joined.
 * A point at angle a, distance r from the axis and depth z ahead is drawn at
 * the vanishing point + (cos a, sin a) · r / z · focal (view.glsl).
 */
import { BANDS, OFFSET, type Signal } from '@/lib/signal/layout';

const TAU = Math.PI * 2;

/** How many streams of code. */
export const STREAMS = 120;
/** The most glyphs a stream shows, head included (its length eases between LEN_BASE and LEN_BASE + LEN_RANGE). */
export const TRAIL = 24;
/** A stream's length in glyphs: this when its band is silent, up to this much more when it's at full loudness. */
export const LEN_BASE = 5;
export const LEN_RANGE = 18;
/** How fast a stream's length follows its loudness (s). */
export const LEN_S = 0.3;
/** Depth between a stream's glyphs (units). */
export const GAP = 0.32;
/** How deep the streams reach (units ahead): they're placed beyond it and fade in over its far third. */
export const STREAM_DEEP = 8;
/** The nearest depth drawn (units): closer than this, a glyph has passed the camera (view.glsl NEAR). */
export const NEAR = 0.3;
/** A stream's distance from the axis: from just off it to past the screen's edge (C1 RUSH). */
export const R_MIN = 0.55;
export const R_RANGE = 0.9;
/** A stream's speed toward the camera (units/s, before the flight's share): this when its band is silent, this much more when it's loud. */
export const STREAM_SPEED = 0.5;
export const STREAM_SPEED_LOUD = 3.5;
/** A beat flares the heads of streams whose band is below this (the bass); the flare fades over FLARE_S. */
export const FLARE_BAND = 0.3;
export const FLARE_S = 0.2;
/** Glyph flicker (changes a second, per stream): this when the treble is silent, this much more at full treble. */
export const FLICKER = 0.5;
export const FLICKER_TREBLE = 5;

/** How many warp specks. */
export const SPECKS = 220;
/** How deep the specks reach (units ahead). */
export const SPECK_DEEP = 12;

/** The flight: its cruise, how much the level adds, how much a beat's surge adds (speed units), how fast a surge fades (s). */
export const CRUISE = 0.6;
export const LEVEL_K = 1.3;
export const SURGE_K = 2;
export const SURGE_S = 0.35;
/** The flight's easing (s): quickly up (a lunge), slowly down (a glide). */
export const LUNGE_S = 0.1;
export const GLIDE_S = 0.35;

/** A seeded random number generator (0..1): the same seed gives the same rain (Park–Miller, as PLEXUS's field.ts). */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Picks a glyph (its cell in the glyph sheet, glyphs.ts). */
export type Pick = () => number;

/**
 * A glyph picker for a sheet of `kana` katakana followed by `base` other
 * glyphs: katakana twice as likely as the rest, as in cyberdeck's MATRIX
 * RAIN (and the film); only the others when this computer has no katakana.
 */
export function glyphPicker(kana: number, base: number, rand: () => number): Pick {
  return () => {
    if (kana > 0 && (base === 0 || rand() < 2 / 3)) return Math.floor(rand() * kana);
    return kana + Math.floor(rand() * Math.max(1, base));
  };
}

/** One stream of code. */
export interface Stream {
  /** Where it is round the axis (radians) and how far from it (units). */
  angle: number;
  r: number;
  /** Its head's depth ahead (units). */
  z: number;
  /** Its band (0 bass .. 1 treble), for life. */
  band: number;
  /** Its band's loudness this frame (0..1). */
  e: number;
  /** How many glyphs it shows (eased; fractional). */
  len: number;
  /** Its head's flare (0..1, fading). */
  flare: number;
  /** Its glyphs, head first (cells in the glyph sheet): a view into the engine's buffer, uploaded as is. */
  glyphs: Uint8Array;
}

/** One warp speck. */
export interface Speck {
  angle: number;
  r: number;
  /** Its near end's depth ahead (units). */
  z: number;
  band: number;
}

/** The flight: its speed (1 ≈ C1's pace) and the beat's surge (0..1, fading). */
export interface Flight {
  speed: number;
  surge: number;
}

/** Places a stream anew round the axis: any angle, between just off the axis and past the screen's edge (its band stays). */
function placeStream(s: Stream, rand: () => number): void {
  s.angle = rand() * TAU;
  s.r = R_MIN + rand() * R_RANGE;
}

/**
 * The streams, each with its glyphs as a view into `glyphs` (STREAMS × TRAIL
 * cells, the engine's upload buffer), spread through the tunnel's depth.
 */
export function createStreams(rand: () => number, pick: Pick, glyphs: Uint8Array): Stream[] {
  return Array.from({ length: STREAMS }, (_, i) => {
    const s: Stream = { angle: 0, r: 1, z: rand() * STREAM_DEEP, band: rand(), e: 0, len: LEN_BASE, flare: 0, glyphs: glyphs.subarray(i * TRAIL, (i + 1) * TRAIL) };
    placeStream(s, rand);
    for (let k = 0; k < TRAIL; k++) s.glyphs[k] = pick();
    return s;
  });
}

/**
 * Moves a stream on by `dt` s, its band at loudness `e`: toward the camera
 * at its speed × `pace` (the flight's share), its length easing after the
 * loudness, its flare fading, its glyphs flickering (`flicker` changes a
 * second). Once its whole trail has passed the camera it's placed again
 * beyond the far end: true then.
 */
export function stepStream(s: Stream, e: number, dt: number, pace: number, flicker: number, rand: () => number, pick: Pick): boolean {
  s.e = e;
  s.len += (LEN_BASE + LEN_RANGE * e - s.len) * (1 - Math.exp(-dt / LEN_S));
  s.z -= (STREAM_SPEED + STREAM_SPEED_LOUD * e) * pace * dt;
  s.flare *= Math.exp(-dt / FLARE_S);
  if (rand() < flicker * dt) s.glyphs[Math.floor(rand() * TRAIL)] = pick();
  if (s.z + s.len * GAP >= NEAR) return false;
  placeStream(s, rand);
  s.z = STREAM_DEEP + rand();
  s.flare = 0;
  return true;
}

/** The specks, anywhere across the view (r spread evenly over the disc), spread through their depth. */
export function createSpecks(rand: () => number): Speck[] {
  return Array.from({ length: SPECKS }, () => {
    const d: Speck = { angle: 0, r: 1, z: rand() * SPECK_DEEP, band: 0 };
    placeSpeck(d, rand);
    return d;
  });
}

/** Places a speck anew: any angle, anywhere out to well past the screen's edge, a new band. */
function placeSpeck(d: Speck, rand: () => number): void {
  d.angle = rand() * TAU;
  d.r = 0.3 + Math.sqrt(rand()) * 2.4;
  d.band = rand();
}

/** How far back a speck reaches (units of depth) at flight speed `speed`: a dot at cruise, a long streak in a surge. */
export function speckStretch(speed: number): number {
  return 0.05 + 0.45 * Math.max(0, speed - 0.9);
}

/** Moves a speck on by `dt` s at flight speed `speed`, its band at loudness `e`; placed anew beyond the far end once it has passed. */
export function stepSpeck(d: Speck, e: number, speed: number, dt: number, rand: () => number): void {
  d.z -= (1 + 1.5 * e) * speed * dt;
  if (d.z + speckStretch(speed) >= NEAR) return;
  placeSpeck(d, rand);
  d.z = SPECK_DEEP + rand();
}

/** The flight at rest: cruising at a middling level. */
export function createFlight(): Flight {
  return { speed: CRUISE + LEVEL_K * 0.3, surge: 0 };
}

/** A beat: a surge starts. */
export function flightBeat(f: Flight): void {
  f.surge = 1;
}

/** Moves the flight on by `dt` s at loudness `level`: the surge fades; the speed eases toward its goal (a lunge up, a glide down). */
export function stepFlight(f: Flight, level: number, dt: number): void {
  f.surge *= Math.exp(-dt / SURGE_S);
  const goal = CRUISE + LEVEL_K * level + SURGE_K * f.surge;
  f.speed += (goal - f.speed) * (1 - Math.exp(-dt / (goal > f.speed ? LUNGE_S : GLIDE_S)));
}

/** The streams' share of the flight: C1's own pace, nudged by the flight (1 at a speed of 1). */
export function streamPace(speed: number): number {
  return 0.85 + 0.15 * speed;
}

/** The band at x (0 bass .. 1 treble) in SIGNAL frame `s`: both channels' mean, interpolated between bands, with SENSITIVITY `sens`, at most 1. */
export function bandOf(s: Signal, x: number, sens: number): number {
  const p = Math.max(0, Math.min(1, x)) * (BANDS - 1);
  const i = Math.floor(p);
  const j = Math.min(BANDS - 1, i + 1);
  const t = p - i;
  const at = (k: number) => 0.5 * (s[OFFSET.bandsL + k]! + s[OFFSET.bandsR + k]!);
  return Math.min(1, (at(i) * (1 - t) + at(j) * t) * sens);
}
