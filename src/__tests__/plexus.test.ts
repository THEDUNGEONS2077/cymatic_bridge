/**
 * src/__tests__/plexus.test.ts: PLEXUS's field (scene/scenes/plexus/field.ts).
 *
 * Layer: tests (Node). The field is pure: the same shape gives the same
 * field; candidates are near and seamless across the depth wrap; wider
 * screens get more nodes; nodes wander and the music pushes them out from
 * the axis; louder ends reach further, so links form with the music; and
 * signals hop only along live links and stop when spent.
 */
import { describe, expect, it } from 'vitest';

import {
  ahead, buildField, CANDIDATES_PER_NODE, DEPTH, distanceAt, fire, HALF_HEIGHT, linkTarget, MAX_CANDIDATE, MAX_SIGNALS, NODES_16_9, placeNodes, reach, seeded, type Signal, stepSignals, WANDER_MAX, wrapGap, wrapStep,
} from '@/scene/scenes/plexus/field';

const f = buildField(16 / 9);
const silent = new Float32Array(f.count);

describe('the field', () => {
  it('is the same for the same shape', () => {
    const g = buildField(16 / 9);
    expect(g.home).toEqual(f.home);
    expect(g.pairs).toEqual(f.pairs);
  });

  it('fills the box, every node on a band', () => {
    expect(f.count).toBe(NODES_16_9);
    for (let i = 0; i < f.count; i++) {
      expect(Math.abs(f.home[i * 3]!)).toBeLessThanOrEqual(f.halfWidth);
      expect(Math.abs(f.home[i * 3 + 1]!)).toBeLessThanOrEqual(HALF_HEIGHT);
      expect(f.home[i * 3 + 2]).toBeGreaterThanOrEqual(0);
      expect(f.home[i * 3 + 2]).toBeLessThan(DEPTH);
      expect(f.band[i]).toBeGreaterThanOrEqual(0);
      expect(f.band[i]).toBeLessThan(1);
    }
  });

  it('lists near candidates only, across the depth wrap, each pair once', () => {
    const seen = new Set<string>();
    let wrapped = 0;
    for (let k = 0; k < f.pairs.length; k += 2) {
      const [a, b] = [f.pairs[k]!, f.pairs[k + 1]!];
      expect(a).toBeLessThan(b);
      expect(distanceAt(f.home, a, b)).toBeLessThan(MAX_CANDIDATE);
      if (Math.abs(f.home[a * 3 + 2]! - f.home[b * 3 + 2]!) > DEPTH / 2) wrapped++;
      seen.add(`${a}:${b}`);
    }
    expect(seen.size).toBe(f.pairs.length / 2);
    expect(wrapped).toBeGreaterThan(0);
    expect(f.pairs.length / 2).toBeLessThanOrEqual(f.count * CANDIDATES_PER_NODE);
  });

  it('grows with a wider screen, not stretched', () => {
    const wide = buildField(32 / 9);
    expect(wide.count).toBe(NODES_16_9 * 2);
    expect(wide.halfWidth).toBeCloseTo(f.halfWidth * 2);
  });

  it('wraps depth seen from the camera, and steps the short way', () => {
    expect(ahead(1, 0)).toBe(1);
    expect(ahead(1, 2 + DEPTH * 100)).toBeCloseTo(DEPTH - 1);
    expect(wrapGap(0.2, DEPTH - 0.2)).toBeCloseTo(0.4);
    expect(wrapStep(DEPTH - 0.2, 0.2)).toBeCloseTo(0.4);
    expect(wrapStep(0.2, DEPTH - 0.2)).toBeCloseTo(-0.4);
    expect(wrapStep(1, 3)).toBeCloseTo(2);
  });
});

describe('movement', () => {
  it('wanders: nodes move over time, staying near home', () => {
    const a = new Float32Array(f.count * 3);
    const b = new Float32Array(f.count * 3);
    placeNodes(f, 0, silent, silent, a);
    placeNodes(f, 5, silent, silent, b);
    let moved = 0;
    for (let i = 0; i < f.count; i++) {
      const d = Math.hypot(a[i * 3]! - b[i * 3]!, a[i * 3 + 1]! - b[i * 3 + 1]!, a[i * 3 + 2]! - b[i * 3 + 2]!);
      if (d > 0.05) moved++;
      // x and y orbit at different rates (y at 0.83×, 0.7 as far), so the reach is up to √(1 + 0.7²) ≈ 1.22 radii.
      expect(Math.hypot(a[i * 3]! - f.home[i * 3]!, a[i * 3 + 1]! - f.home[i * 3 + 1]!)).toBeLessThanOrEqual(WANDER_MAX * 1.221);
    }
    expect(moved / f.count).toBeGreaterThan(0.8);
  });

  it('breathes: loudness and a beat push nodes out from the axis', () => {
    const quiet = new Float32Array(f.count * 3);
    const loud = new Float32Array(f.count * 3);
    const kicked = new Float32Array(f.count * 3);
    placeNodes(f, 1, silent, silent, quiet);
    placeNodes(f, 1, new Float32Array(f.count).fill(1), silent, loud);
    placeNodes(f, 1, silent, new Float32Array(f.count).fill(0.4), kicked);
    const r = (p: Float32Array, i: number) => Math.hypot(p[i * 3]!, p[i * 3 + 1]!);
    for (let i = 0; i < f.count; i++) {
      expect(r(loud, i)).toBeGreaterThan(r(quiet, i));
      expect(r(kicked, i)).toBeGreaterThan(r(quiet, i));
      expect(loud[i * 3 + 2]).toBeCloseTo(quiet[i * 3 + 2]!);
    }
  });
});

describe('links', () => {
  it('reach further when either end is loud', () => {
    expect(reach(1, 0)).toBeGreaterThan(reach(0, 0));
    expect(reach(0, 1)).toBe(reach(1, 0));
  });

  it('form with the music: a pair out of reach when quiet links when loud', () => {
    const d = reach(0, 0) * 1.2;
    expect(linkTarget(d, 0, 0)).toBe(0);
    expect(linkTarget(d, 0.8, 0)).toBe(1);
    // Smooth between.
    const r = reach(0.3, 0);
    expect(linkTarget(r * 0.9, 0.3, 0)).toBeGreaterThan(0);
    expect(linkTarget(r * 0.9, 0.3, 0)).toBeLessThan(1);
  });

  it('link more of the field when the music is loud', () => {
    const pos = new Float32Array(f.count * 3);
    placeNodes(f, 2, silent, silent, pos);
    const linked = (loud: number) => {
      let n = 0;
      for (let k = 0; k < f.pairs.length; k += 2) if (linkTarget(distanceAt(pos, f.pairs[k]!, f.pairs[k + 1]!), loud, loud) > 0.5) n++;
      return n;
    };
    expect(linked(0)).toBeGreaterThan(0);
    expect(linked(1)).toBeGreaterThan(linked(0) * 2);
  });
});

describe('signals', () => {
  const all = () => 1;

  it('run along live links, hop on, and stop when their hops are spent', () => {
    const rand = seeded(5);
    const start = f.adj.findIndex((n) => n.length > 1);
    const signals: Signal[] = [];
    fire(f, signals, start, 3, rand, all);
    const reached: number[] = [];
    for (let i = 0; i < 200 && signals.length; i++) stepSignals(f, signals, 1 / 60, rand, all, (n) => reached.push(n));
    expect(signals).toHaveLength(0);
    expect(reached.length).toBeGreaterThanOrEqual(1);
    expect(reached.length).toBeLessThanOrEqual(3);
    let at = start;
    for (const n of reached) {
      expect(f.adj[at]!.map(([m]) => m)).toContain(n);
      at = n;
    }
  });

  it('never start along a dead link', () => {
    const signals: Signal[] = [];
    fire(f, signals, 0, 3, seeded(1), () => 0);
    expect(signals).toHaveLength(0);
  });

  it('never exceed MAX_SIGNALS', () => {
    const rand = seeded(9);
    const signals: Signal[] = [];
    for (let i = 0; i < MAX_SIGNALS * 3; i++) fire(f, signals, i % f.count, 3, rand, all);
    expect(signals.length).toBeLessThanOrEqual(MAX_SIGNALS);
  });
});
