/**
 * src/__tests__/plexus.test.ts: PLEXUS's field (scene/scenes/plexus/field.ts).
 *
 * Layer: tests (Node). The same shape gives the same field; links are near
 * and seamless across the depth wrap; the net grows with loudness and keeps
 * a spine near the axis when quiet; the main pulse runs forward, keeps near
 * the centre and never runs backward; branches run along present links,
 * mark them, and end.
 */
import { describe, expect, it } from 'vitest';

import { branch, buildField, density, DEPTH, distance, HALF_HEIGHT, MAX_BRANCHES, MAX_LINK, nextForward, NODES_16_9, pairOf, type Pulse, presenceTarget, seeded, stepBranches, wrapGap, wrapStep } from '@/scene/scenes/plexus/field';

const f = buildField(16 / 9);
const all = () => 1;

describe('the field', () => {
  it('is the same for the same shape', () => {
    const g = buildField(16 / 9);
    expect(g.pos).toEqual(f.pos);
    expect(g.pairs).toEqual(f.pairs);
  });

  it('fills the box, every node on a band and a rank', () => {
    expect(f.count).toBe(NODES_16_9);
    for (let i = 0; i < f.count; i++) {
      expect(Math.abs(f.pos[i * 3]!)).toBeLessThanOrEqual(f.halfWidth);
      expect(Math.abs(f.pos[i * 3 + 1]!)).toBeLessThanOrEqual(HALF_HEIGHT);
      expect(f.pos[i * 3 + 2]).toBeLessThan(DEPTH);
      expect(f.band[i]).toBeLessThan(1);
      expect(f.rank[i]).toBeGreaterThanOrEqual(0);
      expect(f.rank[i]).toBeLessThanOrEqual(1);
    }
  });

  it('links near nodes, across the depth wrap, each pair once', () => {
    let wrapped = 0;
    const seen = new Set<string>();
    for (let k = 0; k < f.pairs.length; k += 2) {
      const [a, b] = [f.pairs[k]!, f.pairs[k + 1]!];
      expect(distance(f, a, b)).toBeLessThan(MAX_LINK);
      if (Math.abs(f.pos[a * 3 + 2]! - f.pos[b * 3 + 2]!) > DEPTH / 2) wrapped++;
      seen.add(`${a}:${b}`);
      expect(pairOf(f, a, b)).toBe(k / 2);
    }
    expect(seen.size).toBe(f.pairs.length / 2);
    expect(wrapped).toBeGreaterThan(0);
  });

  it('steps depth the short way across the wrap', () => {
    expect(wrapStep(DEPTH - 0.2, 0.2)).toBeCloseTo(0.4);
    expect(wrapStep(0.2, DEPTH - 0.2)).toBeCloseTo(-0.4);
    expect(wrapGap(0.2, DEPTH - 0.2)).toBeCloseTo(0.4);
  });
});

describe('growing and shrinking', () => {
  const present = (d: number) => Array.from({ length: f.count }, (_, i) => presenceTarget(f, i, d)).filter((p) => p > 0.5).length;

  it('is never empty, and full when loud', () => {
    expect(density(0)).toBeGreaterThan(0);
    expect(density(1)).toBeGreaterThanOrEqual(1);
    expect(present(density(0))).toBeGreaterThan(f.count * 0.15);
    expect(present(density(1))).toBe(f.count);
  });

  it('grows with loudness', () => {
    expect(present(density(0.4))).toBeGreaterThan(present(density(0.1)));
  });

  it('keeps about a third when quiet, spread over the screen (0.4.1: "Fills the screen"), a little denser near the axis', () => {
    const radius = (i: number) => Math.hypot(f.pos[i * 3]! / f.halfWidth, f.pos[i * 3 + 1]! / HALF_HEIGHT);
    const quiet = Array.from({ length: f.count }, (_, i) => i).filter((i) => presenceTarget(f, i, density(0)) > 0.5);
    expect(quiet.length / f.count).toBeGreaterThan(0.28);
    expect(quiet.length / f.count).toBeLessThan(0.4);
    const mean = quiet.reduce((s, i) => s + radius(i), 0) / quiet.length;
    const all_ = Array.from({ length: f.count }, (_, i) => radius(i)).reduce((s, r) => s + r, 0) / f.count;
    expect(mean).toBeLessThan(all_);
    expect(mean).toBeGreaterThan(all_ * 0.8);
    // Every quarter of the screen keeps some of it.
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      expect(quiet.filter((i) => Math.sign(f.pos[i * 3]!) === sx && Math.sign(f.pos[i * 3 + 1]!) === sy).length).toBeGreaterThan(quiet.length * 0.15);
    }
  });

  it('builds a wide screen’s field quickly (a grid, not a quadratic search)', () => {
    const t = performance.now();
    buildField(2.4 * (16 / 9));
    expect(performance.now() - t).toBeLessThan(400);
  });
});

describe('the main pulse', () => {
  it('runs forward, near the centre, never backward, for a long way', () => {
    const rand = seeded(3);
    const quiet = (n: number) => presenceTarget(f, n, density(0));
    // Start at the present node nearest the axis.
    let at = 0;
    for (let i = 0; i < f.count; i++) if (quiet(i) > 0.5 && Math.hypot(f.pos[i * 3]!, f.pos[i * 3 + 1]!) < Math.hypot(f.pos[at * 3]!, f.pos[at * 3 + 1]!)) at = i;
    let travelled = 0;
    let offCentre = 0;
    for (let step = 0; step < 300; step++) {
      const next = nextForward(f, at, quiet, rand);
      expect(next).not.toBe(at);
      const forward = wrapStep(f.pos[at * 3 + 2]!, f.pos[next * 3 + 2]!);
      expect(forward).toBeGreaterThan(0);
      travelled += forward;
      offCentre += Math.hypot(f.pos[next * 3]!, f.pos[next * 3 + 1]!);
      at = next;
    }
    // Through the box several times over, mostly within the middle of the screen.
    expect(travelled).toBeGreaterThan(DEPTH * 3);
    expect(offCentre / 300).toBeLessThan(0.9);
  });
});

describe('branches', () => {
  it('split off along present links (not the main pulse’s way), mark their links, and end', () => {
    const rand = seeded(5);
    const at = f.adj.findIndex((n) => n.length >= 4);
    const except = f.adj[at]![0]![0];
    const branches: Pulse[] = [];
    branch(f, branches, at, 3, 3, except, all, rand);
    expect(branches).toHaveLength(3);
    for (const b of branches) {
      expect(b.to).not.toBe(except);
      expect(pairOf(f, b.from, b.to)).toBe(b.pair);
    }
    const marked = new Set<number>();
    for (let i = 0; i < 400 && branches.length; i++) stepBranches(f, branches, 1 / 60, 3, all, rand, (p) => marked.add(p));
    expect(branches).toHaveLength(0);
    expect(marked.size).toBeGreaterThanOrEqual(3);
  });

  it('never exceed MAX_BRANCHES, and never run to absent nodes', () => {
    const rand = seeded(9);
    const branches: Pulse[] = [];
    for (let i = 0; i < MAX_BRANCHES * 2; i++) branch(f, branches, i % f.count, 4, 3, -1, all, rand);
    expect(branches.length).toBeLessThanOrEqual(MAX_BRANCHES);
    const none: Pulse[] = [];
    branch(f, none, 0, 4, 3, -1, () => 0, rand);
    expect(none).toHaveLength(0);
  });
});
