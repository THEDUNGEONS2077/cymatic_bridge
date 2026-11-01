/**
 * src/__tests__/plexus.test.ts: PLEXUS's field (scene/scenes/plexus/field.ts).
 *
 * Layer: tests (Node). The field is pure: the same shape gives the same
 * field, links are short and seamless across the depth wrap, wider screens
 * get more nodes, and signals hop along links and stop when spent.
 */
import { describe, expect, it } from 'vitest';

import { ahead, buildField, DEPTH, fire, HALF_HEIGHT, LINKS_PER_NODE, MAX_LINK, MAX_SIGNALS, NODES_16_9, seeded, type Signal, stepSignals, wrapGap } from '@/scene/scenes/plexus/field';

describe('the field', () => {
  const f = buildField(16 / 9);

  it('is the same for the same shape', () => {
    const g = buildField(16 / 9);
    expect(g.pos).toEqual(f.pos);
    expect(g.links).toEqual(f.links);
  });

  it('fills the box, every node on a band', () => {
    expect(f.count).toBe(NODES_16_9);
    for (let i = 0; i < f.count; i++) {
      expect(Math.abs(f.pos[i * 3]!)).toBeLessThanOrEqual(f.halfWidth);
      expect(Math.abs(f.pos[i * 3 + 1]!)).toBeLessThanOrEqual(HALF_HEIGHT);
      expect(f.pos[i * 3 + 2]).toBeGreaterThanOrEqual(0);
      expect(f.pos[i * 3 + 2]).toBeLessThan(DEPTH);
      expect(f.band[i]).toBeGreaterThanOrEqual(0);
      expect(f.band[i]).toBeLessThan(1);
    }
  });

  it('links near nodes only, measured across the depth wrap, each pair once', () => {
    const pairs = new Set<string>();
    let wrapped = 0;
    for (let k = 0; k < f.links.length; k += 2) {
      const [a, b] = [f.links[k]!, f.links[k + 1]!];
      expect(a).toBeLessThan(b);
      const d = Math.hypot(f.pos[a * 3]! - f.pos[b * 3]!, f.pos[a * 3 + 1]! - f.pos[b * 3 + 1]!, wrapGap(f.pos[a * 3 + 2]!, f.pos[b * 3 + 2]!));
      expect(d).toBeLessThan(MAX_LINK);
      if (Math.abs(f.pos[a * 3 + 2]! - f.pos[b * 3 + 2]!) > DEPTH / 2) wrapped++;
      pairs.add(`${a}:${b}`);
    }
    expect(pairs.size).toBe(f.links.length / 2);
    // Some links cross the wrap: no seam at the far end.
    expect(wrapped).toBeGreaterThan(0);
    // Most nodes have links (a few far from all others may not).
    const linked = f.adj.filter((n) => n.length > 0).length;
    expect(linked / f.count).toBeGreaterThan(0.9);
    expect(f.links.length / 2).toBeLessThanOrEqual(f.count * LINKS_PER_NODE);
  });

  it('grows with a wider screen, not stretched', () => {
    const wide = buildField(32 / 9);
    expect(wide.count).toBe(NODES_16_9 * 2);
    expect(wide.halfWidth).toBeCloseTo(f.halfWidth * 2);
  });

  it('wraps depth seen from the camera', () => {
    expect(ahead(1, 0)).toBe(1);
    expect(ahead(1, 2)).toBeCloseTo(DEPTH - 1);
    expect(ahead(1, 2 + DEPTH * 100)).toBeCloseTo(DEPTH - 1);
    expect(wrapGap(0.2, DEPTH - 0.2)).toBeCloseTo(0.4);
  });
});

describe('signals', () => {
  const f = buildField(16 / 9);

  it('run along links, hop on, and stop when their hops are spent', () => {
    const rand = seeded(5);
    const start = f.adj.findIndex((n) => n.length > 1);
    const signals: Signal[] = [];
    fire(f, signals, start, 3, rand);
    const reached: number[] = [];
    for (let i = 0; i < 200 && signals.length; i++) stepSignals(f, signals, 1 / 60, rand, (n) => reached.push(n));
    expect(signals).toHaveLength(0);
    expect(reached.length).toBeGreaterThanOrEqual(1);
    expect(reached.length).toBeLessThanOrEqual(3);
    // Each hop is along a link.
    let at = start;
    for (const n of reached) {
      expect(f.adj[at]).toContain(n);
      at = n;
    }
  });

  it('never exceed MAX_SIGNALS', () => {
    const rand = seeded(9);
    const signals: Signal[] = [];
    for (let i = 0; i < MAX_SIGNALS * 3; i++) fire(f, signals, i % f.count, 3, rand);
    expect(signals.length).toBeLessThanOrEqual(MAX_SIGNALS);
  });
});
