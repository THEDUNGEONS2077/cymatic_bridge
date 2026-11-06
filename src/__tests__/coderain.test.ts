/**
 * src/__tests__/coderain.test.ts: CODE RAIN EQ's pure parts: the rain
 * (scene/scenes/coderain/rain.ts) and the horizon monitor (monitor.ts).
 *
 * Layer: tests (Node). The heartbeat has its shape (the spike lands 28 ms
 * after the beat, then a dip and a rounded T, nothing before the beat); the
 * resting heartbeat comes only after a quiet while, then steadily; the scan
 * bounces across and back at a steady pace, writing every column on every
 * pass at the moment it crossed it (so the trace doesn't depend on the
 * frame rate); the streams move by their band and come back far off; the
 * specks wrap; the flight lunges on a beat and glides back, never jumping.
 */
import { describe, expect, it } from 'vitest';

import { BANDS, emptySignal, OFFSET } from '@/lib/signal/layout';
import { COLS, createMonitor, ecgAt, heartAt, monitorBeat, NEVER, R_TIME, REST_AFTER_S, REST_EVERY_S, stepMonitor, SWEEP_S, T_END } from '@/scene/scenes/coderain/monitor';
import {
  bandOf,
  createFlight,
  createSpecks,
  createStreams,
  CRUISE,
  flightBeat,
  GAP,
  glyphPicker,
  LEN_BASE,
  LEN_RANGE,
  NEAR,
  seeded,
  SPECK_DEEP,
  speckStretch,
  stepFlight,
  stepSpeck,
  stepStream,
  STREAM_DEEP,
  STREAMS,
  TRAIL,
} from '@/scene/scenes/coderain/rain';

describe('the heartbeat', () => {
  it('is flat before the beat and after its T, spikes at R_TIME, dips after, and has a rounded T', () => {
    expect(ecgAt(-0.05)).toBe(0);
    expect(ecgAt(T_END + 0.01)).toBe(0);
    expect(ecgAt(R_TIME)).toBeCloseTo(1);
    // The spike is the highest point, and it lands within 30 ms of the beat (with the kick).
    let peak = -Infinity;
    let when = 0;
    for (let t = 0; t <= T_END; t += 0.001) if (ecgAt(t) > peak) [peak, when] = [ecgAt(t), t];
    expect(when).toBeLessThan(0.03);
    expect(Math.min(...Array.from({ length: 300 }, (_, i) => ecgAt(i / 1000)))).toBeCloseTo(-0.3, 2);
    expect(ecgAt(0.21)).toBeGreaterThan(0.2);
  });
});

describe('the monitor', () => {
  it('rests: a small beat only after REST_AFTER_S of quiet, then every REST_EVERY_S; a real beat resets it', () => {
    const m = createMonitor();
    const dt = 1 / 60;
    // Every resting beat is in the list for a while after it starts: collect their start times.
    const rests = new Set<number>();
    for (let i = 0; i < 60 * 6; i++) {
      if (i === 60) monitorBeat(m, 1);
      stepMonitor(m, dt);
      for (const b of m.beats) if (b.a < 0.5) rests.add(b.t);
    }
    const restTimes = [...rests].sort((a, b) => a - b);
    // None before REST_AFTER_S of quiet at the start; after the beat at 1 s, none until 1 s + REST_AFTER_S; then steady.
    expect(restTimes[0]).toBeGreaterThanOrEqual(REST_AFTER_S - 0.02);
    const afterBeat = restTimes.filter((t) => t > 1);
    expect(afterBeat[0]).toBeGreaterThanOrEqual(1 + REST_AFTER_S - 0.02);
    for (let k = 1; k < afterBeat.length; k++) expect(afterBeat[k]! - afterBeat[k - 1]!).toBeCloseTo(REST_EVERY_S, 1);
  });

  it('bounces: across in SWEEP_S, turns at the edge, back in SWEEP_S, never jumping', () => {
    const m = createMonitor();
    const dt = 1 / 144;
    let last = m.head;
    let turns = 0;
    let dir = m.dir;
    for (let i = 0; i < Math.round((2 * SWEEP_S) / dt); i++) {
      stepMonitor(m, dt);
      expect(Math.abs(m.head - last)).toBeLessThanOrEqual(dt / SWEEP_S + 1e-9);
      expect(m.head).toBeGreaterThanOrEqual(0);
      expect(m.head).toBeLessThanOrEqual(1);
      if (m.dir !== dir) turns++;
      dir = m.dir;
      last = m.head;
    }
    // Over then back: one turn at the right edge, and back at (about) the start.
    expect(turns).toBeGreaterThanOrEqual(1);
    expect(m.head).toBeLessThan(0.01);
  });

  it('writes every column on each pass, at the moment it crossed it (later along the way it went)', () => {
    const m = createMonitor();
    // A step that divides the sweep exactly in binary (1/256 of it), so each pass ends exactly at an edge.
    const dt = SWEEP_S / 256;
    for (let i = 0; i < 256; i++) stepMonitor(m, dt);
    expect(m.head).toBe(1);
    // One pass right: all written, in order.
    for (let c = 1; c < COLS; c++) {
      expect(m.wrote[c]).not.toBe(NEVER);
      expect(m.wrote[c]!).toBeGreaterThanOrEqual(m.wrote[c - 1]!);
    }
    const firstPass = Float32Array.from(m.wrote);
    for (let i = 0; i < 256; i++) stepMonitor(m, dt);
    expect(m.head).toBe(0);
    // Back left: all written again, later toward the left.
    for (let c = 0; c < COLS - 1; c++) {
      expect(m.wrote[c]!).toBeGreaterThan(firstPass[c]!);
      expect(m.wrote[c]!).toBeGreaterThanOrEqual(m.wrote[c + 1]!);
    }
  });

  it('reports which columns it wrote each step', () => {
    const m = createMonitor();
    stepMonitor(m, 0.05);
    expect(m.lo).toBeGreaterThanOrEqual(1);
    expect(m.hi).toBeGreaterThan(m.lo);
    expect(m.hi).toBeLessThanOrEqual(Math.ceil(0.05 / SWEEP_S * (COLS - 1)));
    stepMonitor(m, 0);
    expect(m.hi).toBeLessThan(m.lo);
  });

  it('draws the same heartbeat at 60 and 144 frames a second', () => {
    const run = (fps: number) => {
      const m = createMonitor();
      const dt = 1 / fps;
      // Beats at 0.5 s, 1 s and 1.5 s: whole frames at both rates.
      const beatsAt = new Set([0.5, 1, 1.5].map((t) => Math.round(t * fps)));
      for (let i = 0; i < Math.round(1.9 * fps); i++) {
        if (beatsAt.has(i)) monitorBeat(m, 1);
        stepMonitor(m, dt);
      }
      return m.trace;
    };
    const a = run(60);
    const b = run(144);
    let worst = 0;
    for (let c = 0; c < COLS; c++) worst = Math.max(worst, Math.abs(a[c]! - b[c]!));
    expect(worst).toBeLessThan(0.02);
    // And it holds the spikes: the trace reaches near 1 somewhere.
    expect(Math.max(...a)).toBeGreaterThan(0.95);
  });

  it('knows the heartbeat at the scan now', () => {
    const m = createMonitor();
    monitorBeat(m, 0.8);
    for (let i = 0; i < 2; i++) stepMonitor(m, R_TIME / 2);
    expect(m.live).toBeCloseTo(heartAt(m, m.now));
    expect(m.live).toBeCloseTo(0.8, 2);
  });
});

describe('the rain', () => {
  const pickOf = (rand: () => number) => glyphPicker(46, 30, rand);

  it('is the same for the same seed', () => {
    const a = createStreams(seeded(19), pickOf(seeded(1)), new Uint8Array(STREAMS * TRAIL));
    const b = createStreams(seeded(19), pickOf(seeded(1)), new Uint8Array(STREAMS * TRAIL));
    expect(a.map((s) => [s.angle, s.r, s.z, s.band])).toEqual(b.map((s) => [s.angle, s.r, s.z, s.band]));
  });

  it('picks katakana twice as often as the rest, and only the rest without katakana', () => {
    const rand = seeded(3);
    const pick = glyphPicker(46, 30, rand);
    const n = 30000;
    let kana = 0;
    for (let i = 0; i < n; i++) if (pick() < 46) kana++;
    expect(kana / n).toBeCloseTo(2 / 3, 1);
    const plain = glyphPicker(0, 30, rand);
    for (let i = 0; i < 1000; i++) {
      const g = plain();
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(30);
    }
  });

  it('moves a loud stream faster, with a longer trail; it comes back far off once its trail has passed', () => {
    const rand = seeded(5);
    const pick = pickOf(rand);
    const [quiet, loud] = createStreams(rand, pick, new Uint8Array(STREAMS * TRAIL));
    quiet!.z = loud!.z = 6;
    for (let i = 0; i < 30; i++) {
      stepStream(quiet!, 0, 1 / 60, 1, 0, rand, pick);
      stepStream(loud!, 1, 1 / 60, 1, 0, rand, pick);
    }
    expect(6 - loud!.z).toBeGreaterThan(3 * (6 - quiet!.z));
    expect(loud!.len).toBeGreaterThan(quiet!.len);
    expect(loud!.len).toBeLessThanOrEqual(LEN_BASE + LEN_RANGE);
    // Run it in: it comes back beyond the far end.
    let back = false;
    for (let i = 0; i < 600 && !back; i++) back = stepStream(loud!, 1, 1 / 60, 1, 0, rand, pick);
    expect(back).toBe(true);
    expect(loud!.z).toBeGreaterThanOrEqual(STREAM_DEEP);
  });

  it('lets a stream go only once its whole trail has passed the camera', () => {
    const rand = seeded(6);
    const pick = pickOf(rand);
    const [s] = createStreams(rand, pick, new Uint8Array(STREAMS * TRAIL));
    s!.z = 1;
    for (let i = 0; i < 600; i++) {
      const tail = s!.z + s!.len * GAP;
      if (stepStream(s!, 1, 1 / 60, 1, 0, rand, pick)) {
        // Just before it went, its tail was close to the camera (one frame's travel from NEAR).
        expect(tail).toBeLessThan(NEAR + 0.2);
        return;
      }
    }
    throw new Error('never went');
  });

  it('flickers glyphs about as often as asked', () => {
    const rand = seeded(8);
    const pick = pickOf(rand);
    const [s] = createStreams(rand, pick, new Uint8Array(STREAMS * TRAIL));
    let changes = 0;
    for (let i = 0; i < 600; i++) {
      const before = Uint8Array.from(s!.glyphs);
      s!.z = 4;
      stepStream(s!, 0, 1 / 60, 1, 3, rand, pick);
      if (s!.glyphs.some((g, k) => g !== before[k])) changes++;
    }
    // 3 a second for 10 s (some re-picks land on the same glyph).
    expect(changes).toBeGreaterThan(18);
    expect(changes).toBeLessThan(42);
  });

  it('wraps the specks, and stretches them with the speed', () => {
    const rand = seeded(9);
    const specks = createSpecks(rand);
    for (let i = 0; i < 600; i++) for (const d of specks) stepSpeck(d, 0.5, 2, 1 / 60, rand);
    for (const d of specks) {
      expect(d.z + speckStretch(2)).toBeGreaterThanOrEqual(NEAR);
      expect(d.z).toBeLessThanOrEqual(SPECK_DEEP + 1);
    }
    expect(speckStretch(3)).toBeGreaterThan(speckStretch(1));
    expect(speckStretch(0.5)).toBeGreaterThan(0);
  });

  it('flies: a beat lunges it forward, then it glides back to its cruise, never jumping', () => {
    const f = createFlight();
    const dt = 1 / 144;
    for (let i = 0; i < 144 * 3; i++) stepFlight(f, 0, dt);
    expect(f.speed).toBeCloseTo(CRUISE, 1);
    const cruise = f.speed;
    flightBeat(f);
    let top = 0;
    let worstStep = 0;
    let last = f.speed;
    for (let i = 0; i < 144 * 3; i++) {
      stepFlight(f, 0, dt);
      top = Math.max(top, f.speed);
      worstStep = Math.max(worstStep, Math.abs(f.speed - last));
      last = f.speed;
    }
    expect(top).toBeGreaterThan(cruise + 0.8);
    expect(f.speed).toBeCloseTo(cruise, 1);
    // No jump: the most it changes in one 144 Hz frame is small.
    expect(worstStep).toBeLessThan(0.15);
  });

  it('reads a band from the signal, interpolated, with SENSITIVITY, at most 1', () => {
    const s = emptySignal();
    s[OFFSET.bandsL + 10] = 0.4;
    s[OFFSET.bandsR + 10] = 0.6;
    expect(bandOf(s, 10 / (BANDS - 1), 1)).toBeCloseTo(0.5);
    expect(bandOf(s, 10.5 / (BANDS - 1), 1)).toBeCloseTo(0.25);
    expect(bandOf(s, 10 / (BANDS - 1), 4)).toBe(1);
  });
});
