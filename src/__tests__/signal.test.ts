/**
 * src/__tests__/signal.test.ts: the SIGNAL analysis (lib/signal), on
 * synthetic analyser frames.
 *
 * Layer: tests (Node). Each frame is built the way Chrome's AnalyserNode
 * reports it: decibels per bin, evenly spaced in Hz, for fftSize 4096 at
 * 48 kHz. A sine is one loud bin; a kick is a burst of loud bass bins that
 * decays; silence is the floor everywhere.
 */
import { describe, expect, it } from 'vitest';

import { bandSpans, readBands } from '@/lib/signal/bands';
import { detectBeat, newBeat } from '@/lib/signal/beat';
import { followPeak, newGain, normalize, PEAK_FLOOR_DB, RANGE_DB, smooth } from '@/lib/signal/dynamics';
import { breath, newIdle, SILENT_AFTER_S, stepIdle } from '@/lib/signal/idle';
import { BANDS, OFFSET, scalar } from '@/lib/signal/layout';
import { type AnalyserFrame, createSignalEngine } from '@/lib/signal/signal';
import { MAX_ACCENT, newStrobe, stepStrobe } from '@/lib/signal/strobe';

const RATE = 48000;
const BINS = 2048;
const HZ_PER_BIN = RATE / (BINS * 2);
const DT = 1 / 60;

/** A frame of bins at the floor, with each listed tone (Hz → dB) as one loud bin. */
function bins(tones: Record<number, number> = {}): Float32Array<ArrayBuffer> {
  const b = new Float32Array(BINS).fill(-110);
  for (const [hz, db] of Object.entries(tones)) b[Math.round(Number(hz) / HZ_PER_BIN)] = db;
  return b;
}

/** An analyser frame from left and right bins (the waveforms flat). */
function frame(l: Float32Array<ArrayBuffer>, r: Float32Array<ArrayBuffer> = l): AnalyserFrame {
  const wave = new Float32Array(4096);
  return { binsL: l, binsR: r, waveL: wave, waveR: wave };
}

/** The band of the engine's frame with the most energy, left channel. */
function loudestBand(signal: Float32Array): number {
  let best = 0;
  for (let i = 1; i < BANDS; i++) if (signal[OFFSET.bandsL + i]! > signal[OFFSET.bandsL + best]!) best = i;
  return best;
}

describe('bands', () => {
  const spans = bandSpans(BANDS, BINS, RATE);

  it('are log-spaced from 30 Hz to 16 kHz, each a little over 1/7 octave', () => {
    expect(spans[0]!.lowHz).toBeCloseTo(30);
    expect(spans[BANDS - 1]!.highHz).toBeCloseTo(16000);
    const octaves = Math.log2(spans[1]!.centreHz / spans[0]!.centreHz);
    expect(octaves).toBeGreaterThan(0.13);
    expect(octaves).toBeLessThan(0.15);
  });

  it('puts a sine in the band that holds its frequency', () => {
    const out = new Float32Array(BANDS);
    for (const hz of [60, 440, 3000, 10000]) {
      readBands(bins({ [hz]: -20 }), spans, out);
      let best = 0;
      for (let i = 1; i < BANDS; i++) if (out[i]! > out[best]!) best = i;
      // The loudest band holds the tone (the bin's rounding can put it on a neighbour's edge).
      expect(spans[best]!.lowHz * 0.93).toBeLessThanOrEqual(hz);
      expect(spans[best]!.highHz * 1.07).toBeGreaterThanOrEqual(hz);
    }
  });

  it('tilts: the same level reads higher in the treble than the bass (R20: an even range)', () => {
    const out = new Float32Array(BANDS);
    readBands(bins(), spans, out);
    expect(out[BANDS - 1]!).toBeGreaterThan(out[0]!);
  });
});

describe('dynamics', () => {
  it('rises at once, falls slowly, never below the floor', () => {
    const g = newGain();
    followPeak(g, -10, DT);
    expect(g.peakDb).toBe(-10);
    followPeak(g, -80, 1);
    expect(g.peakDb).toBeCloseTo(-12.5);
    for (let i = 0; i < 100; i++) followPeak(g, -100, 1);
    expect(g.peakDb).toBe(PEAK_FLOOR_DB);
  });

  it('maps the peak to 1 and RANGE_DB below it to 0', () => {
    const g = newGain();
    followPeak(g, -10, DT);
    expect(normalize(g, -10)).toBe(1);
    expect(normalize(g, -10 - RANGE_DB)).toBe(0);
    expect(normalize(g, -10 - RANGE_DB / 2)).toBeCloseTo(0.5);
  });

  it('smooths the same at 60 and 144 frames a second', () => {
    const env = { attack: 0.05, release: 0.2 };
    let a = 0;
    for (let i = 0; i < 60; i++) a = smooth(a, 1, 1 / 60, env);
    let b = 0;
    for (let i = 0; i < 144; i++) b = smooth(b, 1, 1 / 144, env);
    expect(a).toBeCloseTo(b, 5);
  });
});

describe('beat', () => {
  /** Runs `seconds` of frames where `bass(t)` is the bass bands' value (others 0.1); returns the beat times. */
  function beatsOf(seconds: number, bass: (t: number) => number, dt = DT): number[] {
    const state = newBeat(BANDS);
    const weights = new Float32Array(BANDS).fill(1);
    const bands = new Float32Array(BANDS);
    const times: number[] = [];
    for (let t = 0; t < seconds; t += dt) {
      for (let i = 0; i < BANDS; i++) bands[i] = i < 12 ? bass(t) : 0.1;
      if (detectBeat(state, bands, weights, dt) > 0) times.push(t);
    }
    return times;
  }
  /** A kick every 0.5 s (120 BPM): a jump to 0.9, decaying over 0.1 s. */
  const kick = (t: number) => 0.1 + 0.8 * Math.exp(-(t % 0.5) / 0.1);

  it('finds every kick at 120 BPM, once each', () => {
    const times = beatsOf(8, kick);
    // The first kick or two teach the running mean; after that, one beat per kick.
    const later = times.filter((t) => t > 1);
    expect(later.length).toBe(14);
    for (const t of later) expect(t % 0.5).toBeLessThan(0.05);
  });

  it('finds the same kicks at 144 frames a second', () => {
    expect(beatsOf(8, kick, 1 / 144).filter((t) => t > 1).length).toBe(14);
  });

  it('finds no beats in a steady tone or a slow swell (after its onset)', () => {
    // The tone's start from silence is an onset; nothing after it is.
    expect(beatsOf(8, () => 0.7).filter((t) => t > 0.2)).toEqual([]);
    expect(beatsOf(8, (t) => 0.4 + 0.3 * Math.sin(t)).filter((t) => t > 0.2)).toEqual([]);
  });
});

describe('strobe', () => {
  it('never flashes more than 3 times in any second (WCAG 2.3.1), and never above MAX_ACCENT', () => {
    for (const dt of [1 / 60, 1 / 144, 1 / 30]) {
      const s = newStrobe();
      const flashes: number[] = [];
      let prev = 0;
      let max = 0;
      // A full-strength beat on every frame for 6 s: the worst case.
      for (let i = 0; i * dt < 6; i++) {
        const v = stepStrobe(s, 1, dt);
        if (v > prev + 0.1) flashes.push(i * dt);
        prev = v;
        max = Math.max(max, v);
      }
      // Every closed one-second window, starting at each flash.
      for (const start of flashes) expect(flashes.filter((t) => t >= start && t <= start + 1).length).toBeLessThanOrEqual(3);
      expect(flashes.length).toBeGreaterThanOrEqual(15);
      expect(max).toBeLessThanOrEqual(MAX_ACCENT);
    }
  });

  it('ignores weak beats', () => {
    const s = newStrobe();
    expect(stepStrobe(s, 0.5, DT)).toBe(0);
  });
});

describe('idle', () => {
  it('starts idle, wakes with sound, idles again after SILENT_AFTER_S of silence', () => {
    const s = newIdle();
    expect(s.amount).toBe(1);
    for (let t = 0; t < 3; t += DT) stepIdle(s, 0.3, DT);
    expect(s.amount).toBeLessThan(0.05);
    for (let t = 0; t < SILENT_AFTER_S - 0.2; t += DT) stepIdle(s, 0, DT);
    expect(s.amount).toBeLessThan(0.05);
    for (let t = 0; t < 4; t += DT) stepIdle(s, 0, DT);
    expect(s.amount).toBeGreaterThan(0.9);
  });

  it('breathes low and stays in range', () => {
    for (let t = 0; t < 14; t += 0.37) {
      for (let x = 0; x <= 1; x += 0.1) {
        expect(breath(x, t)).toBeGreaterThanOrEqual(0);
        expect(breath(x, t)).toBeLessThan(0.25);
      }
    }
  });
});

describe('the engine', () => {
  it('shows a tone in its band, and the right group', () => {
    const e = createSignalEngine(BINS, RATE);
    let t = 0;
    for (let i = 0; i < 120; i++) e.step(frame(bins({ 80: -15 })), DT, (t += DT));
    const s = e.signal;
    expect(scalar(s, 'idle')).toBeLessThan(0.2);
    expect(scalar(s, 'bass')).toBeGreaterThan(scalar(s, 'treble'));
    const best = loudestBand(s);
    expect(best).toBeLessThan(16);
  });

  it('starts idle, with the breath in the bands, and no beats', () => {
    const e = createSignalEngine(BINS, RATE);
    let t = 0;
    for (let i = 0; i < 300; i++) e.step(null, DT, (t += DT));
    expect(scalar(e.signal, 'idle')).toBeGreaterThan(0.99);
    expect(scalar(e.signal, 'beatCount')).toBe(0);
    expect(scalar(e.signal, 'level')).toBeGreaterThan(0.02);
    expect(scalar(e.signal, 'level')).toBeLessThan(0.25);
  });

  it('pans: a source on the right gives a positive balance', () => {
    const e = createSignalEngine(BINS, RATE);
    let t = 0;
    for (let i = 0; i < 120; i++) e.step(frame(bins(), bins({ 440: -15, 1000: -15 })), DT, (t += DT));
    expect(scalar(e.signal, 'balance')).toBeGreaterThan(0.5);
  });

  it('keeps every value in range, and the flow clock never goes back', () => {
    const e = createSignalEngine(BINS, RATE);
    let t = 0;
    let flow = 0;
    for (let i = 0; i < 600; i++) {
      // Kicks over a tone, then silence, then wild frames.
      const loud = i % 30 < 3;
      const f = i < 400 ? frame(bins({ 60: loud ? -5 : -40, 440: -25 })) : i < 500 ? null : frame(bins({ 100: 40, 5000: 40 }));
      e.step(f, DT, (t += DT));
      const s = e.signal;
      for (let b = 0; b < BANDS * 2; b++) {
        expect(s[b]).toBeGreaterThanOrEqual(0);
        expect(s[b]).toBeLessThanOrEqual(1);
      }
      expect(scalar(s, 'flow')).toBeGreaterThanOrEqual(flow);
      flow = scalar(s, 'flow');
      expect(scalar(s, 'accent')).toBeLessThanOrEqual(MAX_ACCENT);
    }
    expect(scalar(e.signal, 'beatCount')).toBeGreaterThan(5);
  });
});
