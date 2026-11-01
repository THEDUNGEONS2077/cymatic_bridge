/**
 * src/lib/signal/signal.ts: the SIGNAL engine: one analyser frame in, one
 * SIGNAL frame out.
 *
 * Layer: pure lib (tested; no browser APIs). The page's audio code
 * (audio/analyser.ts) reads the two analysers (left, right) each frame and
 * hands their decibels and waveforms here. The steps, in order:
 *   1. bands.ts: bins → 64 log bands (dB, tilted), per channel;
 *   2. dynamics.ts: one auto-gain over both channels → 0..1;
 *   3. beat.ts: the beat, from the rise of FAST_BANDS coarse bands read
 *      from the short beat analyser (≈5 ms of lag; the user, 0.1.1: the
 *      visuals lagged the sound), or from the mono bands when a frame has
 *      no fast bins;
 *   4. strobe.ts: the limited beat accent;
 *   5. dynamics.ts smooth: each band and scalar eased by the scene's
 *      profile (attack/release), so the look of a scene's response is a
 *      setting, not code;
 *   6. idle.ts: silence → blend into the breath;
 *   7. the flow clock.
 * No allocation per frame: every buffer is made once. The frame's cost
 * (SCALAR.cost) is timed and written by the caller (lib stays pure).
 *
 * A frame of silence (or no analyser at all, before LISTEN) goes through
 * the same steps with `silent()`, so the idle breath is the same path.
 */
import { bandRange, bandSpans, type BandSpan, readBands, FLOOR_DB } from './bands';
import { beatWeights, detectBeat, newBeat, type BeatState } from './beat';
import { type Envelope, followPeak, type Gain, newGain, normalize, smooth } from './dynamics';
import { breath, newIdle, stepIdle, type Idle } from './idle';
import { BANDS, OFFSET, SCALAR, SIGNAL_LENGTH, type Signal, WAVE_POINTS } from './layout';
import { newStrobe, stepStrobe, type Strobe } from './strobe';

/** How a scene wants the music to move it (R20: balanced by default, tuned per scene). */
export interface ReactProfile {
  /** How bands follow the music. */
  bands: Envelope;
  /** How the level and the four groups follow it (usually a little slower than bands). */
  levels: Envelope;
  /** How much each group (bass, low mids, high mids, treble) counts toward a beat. */
  beatWeights: readonly [number, number, number, number];
}

/** The balanced default: quick to rise, a short fall, beats mostly from the low end. */
export const BALANCED: ReactProfile = {
  bands: { attack: 0.015, release: 0.14 },
  // Levels rise in 10 ms (0.1.1: 30 ms read as late).
  levels: { attack: 0.01, release: 0.25 },
  beatWeights: [1, 0.6, 0.35, 0.25],
};

/** The four groups' edges (Hz): bass, low mids, high mids, treble. */
export const GROUP_HZ: readonly [number, number][] = [
  [0, 150],
  [150, 600],
  [600, 2500],
  [2500, 1e9],
];

/** The flow clock's speed: this much of real time when silent, plus this much more at full level. */
export const FLOW_BASE = 0.25;
export const FLOW_GAIN = 1.75;
/** How many coarse bands the beat detector reads from the short analyser (log-spaced, 40 Hz–16 kHz). */
export const FAST_BANDS = 16;
/** How fast stereo balance follows (s). */
const BALANCE_ENV: Envelope = { attack: 0.3, release: 0.3 };
/** How fast the waveform's scale follows its peak: rising at once, falling over a second or so. */
const WAVE_FALL = 0.5;

/** One analyser frame: decibels per bin and a waveform, for each channel, and the beat analyser's bins (mono). */
export interface AnalyserFrame {
  /** The short beat analyser's decibels per bin (mono); without them, beats come from the mono bands. */
  binsFast?: Float32Array<ArrayBuffer>;
  // Backed by plain ArrayBuffers: the analyser's get…Data calls take no other kind.
  binsL: Float32Array<ArrayBuffer>;
  binsR: Float32Array<ArrayBuffer>;
  waveL: Float32Array<ArrayBuffer>;
  waveR: Float32Array<ArrayBuffer>;
}

/** The engine for one analyser (its bin count and sample rate). */
export interface SignalEngine {
  /** One frame of `dt` seconds at time `t` (s): the analysers' frame, or null for silence. Returns the SIGNAL frame (the same array each time). */
  step(frame: AnalyserFrame | null, dt: number, t: number): Signal;
  /** Uses another scene's profile from the next frame on. */
  setProfile(profile: ReactProfile): void;
  /** The frame, as last stepped. */
  readonly signal: Signal;
}

/**
 * A new engine for spectrum analysers of `binCount` bins at `sampleRate`
 * Hz, and a beat analyser of `fastBinCount` bins (0: none, beats from the
 * mono bands).
 */
export function createSignalEngine(binCount: number, sampleRate: number, profile: ReactProfile = BALANCED, fastBinCount = 0): SignalEngine {
  const spans: BandSpan[] = bandSpans(BANDS, binCount, sampleRate);
  const groups = GROUP_HZ.map(([lo, hi]) => bandRange(spans, lo, hi));
  let weights = beatWeights(BANDS, groups, profile.beatWeights);
  // The beat analyser's coarse bands, its own gain and weights (its decibels sit on another scale: a shorter window).
  const fastSpans: BandSpan[] = fastBinCount ? bandSpans(FAST_BANDS, fastBinCount, sampleRate, 40) : [];
  const fastGroups = GROUP_HZ.map(([lo, hi]) => bandRange(fastSpans, lo, hi));
  let fastWeights = beatWeights(FAST_BANDS, fastGroups, profile.beatWeights);
  const fastDb = new Float32Array(FAST_BANDS);
  const fastRaw = new Float32Array(FAST_BANDS);
  const fastGain: Gain = newGain();
  const fastBeat: BeatState = newBeat(FAST_BANDS);
  let current = profile;

  // Working buffers, made once.
  const dbL = new Float32Array(BANDS);
  const dbR = new Float32Array(BANDS);
  const rawL = new Float32Array(BANDS);
  const rawR = new Float32Array(BANDS);
  const mono = new Float32Array(BANDS);
  const silentBins = new Float32Array(binCount).fill(FLOOR_DB);
  const out: Signal = new Float32Array(SIGNAL_LENGTH);

  const gain: Gain = newGain();
  const beat: BeatState = newBeat(BANDS);
  const strobe: Strobe = newStrobe();
  const idle: Idle = newIdle();
  out[OFFSET.scalars + SCALAR.idle] = 1;
  let wavePeak = 0.05;
  let flow = 0;

  /** Sets scalar `k` of the frame. */
  const put = (k: keyof typeof SCALAR, v: number) => (out[OFFSET.scalars + SCALAR[k]] = v);
  /** Reads scalar `k` of the frame. */
  const get = (k: keyof typeof SCALAR) => out[OFFSET.scalars + SCALAR[k]]!;

  return {
    signal: out,
    setProfile(p) {
      current = p;
      weights = beatWeights(BANDS, groups, p.beatWeights);
      fastWeights = beatWeights(FAST_BANDS, fastGroups, p.beatWeights);
    },
    step(frame, dt, t) {
      dt = Math.min(Math.max(dt, 0), 0.1);

      // 1. Bands, per channel (silence: the floor everywhere).
      readBands(frame?.binsL ?? silentBins, spans, dbL);
      readBands(frame?.binsR ?? silentBins, spans, dbR);

      // 2. One gain for both channels, from the loudest band of either.
      let loudest = -Infinity;
      for (let i = 0; i < BANDS; i++) loudest = Math.max(loudest, dbL[i]!, dbR[i]!);
      followPeak(gain, loudest, dt);
      let level = 0;
      let sumL = 0;
      let sumR = 0;
      for (let i = 0; i < BANDS; i++) {
        rawL[i] = normalize(gain, dbL[i]!);
        rawR[i] = normalize(gain, dbR[i]!);
        mono[i] = (rawL[i]! + rawR[i]!) / 2;
        level += mono[i]!;
        sumL += rawL[i]!;
        sumR += rawR[i]!;
      }
      level /= BANDS;

      // 6 (first, since it gates the beat): how idle; an idle signal fires no beats.
      const idleNow = stepIdle(idle, level, dt);
      const live = 1 - idleNow;

      // 3–4. The beat (from the short analyser when there is one: it hears a kick ~16 ms sooner) and its limited accent.
      let found: number;
      let pulse: BeatState;
      if (frame?.binsFast && fastSpans.length) {
        readBands(frame.binsFast, fastSpans, fastDb);
        let fastLoudest = -Infinity;
        for (let i = 0; i < FAST_BANDS; i++) fastLoudest = Math.max(fastLoudest, fastDb[i]!);
        followPeak(fastGain, fastLoudest, dt);
        for (let i = 0; i < FAST_BANDS; i++) fastRaw[i] = normalize(fastGain, fastDb[i]!);
        found = detectBeat(fastBeat, fastRaw, fastWeights, dt);
        pulse = fastBeat;
      } else {
        found = detectBeat(beat, mono, weights, dt);
        pulse = beat;
      }
      const strength = found * (idleNow < 0.5 ? 1 : 0);
      const accent = stepStrobe(strobe, strength, dt);

      // 5. Each band eased toward its value (blended into the breath when idle).
      for (let i = 0; i < BANDS; i++) {
        const x = i / (BANDS - 1);
        const b = breath(x, t) * idleNow;
        const targetL = rawL[i]! * live + b;
        const targetR = rawR[i]! * live + b;
        out[OFFSET.bandsL + i] = smooth(out[OFFSET.bandsL + i]!, targetL, dt, current.bands);
        out[OFFSET.bandsR + i] = smooth(out[OFFSET.bandsR + i]!, targetR, dt, current.bands);
      }

      // The level and the four groups, from the eased bands.
      let eased = 0;
      for (let i = 0; i < BANDS; i++) eased += (out[OFFSET.bandsL + i]! + out[OFFSET.bandsR + i]!) / 2;
      put('level', smooth(get('level'), eased / BANDS, dt, current.levels));
      const names = ['bass', 'lowMid', 'highMid', 'treble'] as const;
      groups.forEach(([from, to], g) => {
        let s = 0;
        for (let i = from; i < to; i++) s += (out[OFFSET.bandsL + i]! + out[OFFSET.bandsR + i]!) / 2;
        put(names[g]!, smooth(get(names[g]!), to > from ? s / (to - from) : 0, dt, current.levels));
      });

      put('beat', pulse.pulse * live);
      put('beatCount', beat.count + fastBeat.count);
      put('accent', accent * live);

      // Balance: right minus left over both, eased; centred when there's nothing.
      const total = sumL + sumR;
      put('balance', smooth(get('balance'), total > 1e-3 ? (sumR - sumL) / total : 0, dt, BALANCE_ENV));

      // The waveform: mono, WAVE_POINTS points over the analyser's window, each its segment's peak (sign kept), scaled to the recent peak.
      writeWave(frame, out, dt, live);

      put('idle', idleNow);
      // 7. The flow clock: faster when loud, never backward.
      flow += dt * (FLOW_BASE + FLOW_GAIN * get('level'));
      put('flow', flow);
      return out;
    },
  };

  /** Fills the frame's waveform (silence: flat). */
  function writeWave(frame: AnalyserFrame | null, s: Signal, dt: number, live: number): void {
    if (!frame) {
      for (let i = 0; i < WAVE_POINTS; i++) s[OFFSET.wave + i] = 0;
      return;
    }
    const n = frame.waveL.length;
    const seg = Math.max(1, Math.floor(n / WAVE_POINTS));
    let peak = 0;
    for (let i = 0; i < WAVE_POINTS; i++) {
      let best = 0;
      for (let j = i * seg; j < Math.min(n, (i + 1) * seg); j++) {
        const v = (frame.waveL[j]! + (frame.waveR[j] ?? frame.waveL[j]!)) / 2;
        if (Math.abs(v) > Math.abs(best)) best = v;
      }
      peak = Math.max(peak, Math.abs(best));
      s[OFFSET.wave + i] = best;
    }
    wavePeak = Math.max(peak, wavePeak * Math.exp(-dt / WAVE_FALL), 0.02);
    for (let i = 0; i < WAVE_POINTS; i++) s[OFFSET.wave + i] = (s[OFFSET.wave + i]! / wavePeak) * live;
  }
}
