/**
 * src/__tests__/settings.test.ts: the settings document, its migrations,
 * startup from storage, the palettes' contrast, and the scene list.
 *
 * Layer: tests (Node). The data-safety rules (R26): every field normalized
 * with its default, unknown versions refused and kept aside, a newer build's
 * scenes kept, and every palette passing WCAG AA (cyberdeck's rule).
 */
import { describe, expect, it } from 'vitest';

import { migrateSettings } from '@/lib/migrations';
import { contrast, PALETTES } from '@/lib/palettes';
import { DEFAULT_SCENE, findScene, SCENES, stepScene } from '@/lib/scenes';
import { defaultSettings, nearestStep, normalizeSettings, sceneSettings, SETTINGS_VERSION } from '@/lib/settings';
import { KEYS, memoryKV } from '@/store/kv';
import { boot, NOTICE_DAMAGED } from '@/store/persist';
import { createSettingsStore, SAVE_DEBOUNCE_MS } from '@/store/settings';

describe('the settings document', () => {
  it('starts at the first scene, the HUD shown, no scene changed', () => {
    const d = defaultSettings();
    expect(d).toEqual({ v: SETTINGS_VERSION, scene: DEFAULT_SCENE, hudHidden: false, bridgeOffer: true, scenes: {} });
  });

  it('normalizes every field, with its default where it doesn’t fit', () => {
    const s = normalizeSettings({
      v: 1,
      scene: 42,
      hudHidden: 'yes',
      scenes: { test: { palette: 'nope', glow: 'max', sensitivity: 1.3, trails: 7, zoom: 1.3 }, future: { glow: 'low' } },
    });
    expect(s.scene).toBe(DEFAULT_SCENE);
    expect(s.hudHidden).toBe(false);
    expect(s.scenes.test).toEqual({ palette: 'uv', glow: 'max', sensitivity: 1.25, trails: 1, zoom: 1.25 });
    // A newer build's scene is kept (its settings checked as well as this build can).
    expect(s.scenes.future?.glow).toBe('low');
  });

  it('gives a scene its defaults until it’s changed', () => {
    expect(sceneSettings(defaultSettings(), 'test')).toBe(findScene('test').defaults);
  });

  it('snaps numbers to the nearest step', () => {
    expect(nearestStep([0.5, 1, 2], 1.4)).toBe(1);
    expect(nearestStep([0.5, 1, 2], 9)).toBe(2);
  });
});

describe('migrations', () => {
  it('reads a version-1 fixture as it is', () => {
    const fixture = { v: 1, scene: 'test', hudHidden: true, bridgeOffer: false, scenes: { test: { palette: 'uv', glow: 'low', sensitivity: 2, trails: 0.2, zoom: 0.5 } } };
    const m = migrateSettings(fixture);
    expect(m.ok && m.settings).toEqual(fixture);
  });

  it('reads a 0.1 document (no bridgeOffer) as offering the bridge', () => {
    const m = migrateSettings({ v: 1, scene: 'test', hudHidden: false, scenes: {} });
    expect(m.ok && m.settings.bridgeOffer).toBe(true);
  });

  it('refuses what isn’t a settings document', () => {
    for (const raw of [null, 7, 'x', [], {}, { v: 0 }, { v: 1.5 }]) expect(migrateSettings(raw).ok).toBe(false);
  });

  it('reads a newer version as well as it can', () => {
    const m = migrateSettings({ v: 99, scene: 'test', hudHidden: true, scenes: {} });
    expect(m.ok && m.settings.hudHidden).toBe(true);
  });
});

describe('startup', () => {
  it('starts from the defaults on a first visit, writing nothing', async () => {
    const kv = memoryKV();
    const b = await boot(kv, 1000);
    expect(b.settings).toEqual(defaultSettings());
    expect(kv.data.size).toBe(0);
  });

  it('keeps damaged settings aside and starts fresh (never writes over them)', async () => {
    const kv = memoryKV({ [KEYS.settings]: { v: 'broken' } });
    const b = await boot(kv, 1234);
    expect(b.notice).toBe(NOTICE_DAMAGED);
    expect(b.settings).toEqual(defaultSettings());
    expect(kv.data.get(`${KEYS.corruptPrefix}1234`)).toEqual({ reason: 'unknown version broken', raw: { v: 'broken' } });
  });

  it('saves a run of changes once, after they stop', async () => {
    const kv = memoryKV();
    const store = createSettingsStore(kv, defaultSettings(), () => {});
    store.getState().setHudHidden(true);
    store.getState().stepScene(1);
    expect(kv.data.has(KEYS.settings)).toBe(false);
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE_MS + 50));
    expect((kv.data.get(KEYS.settings) as { hudHidden: boolean }).hudHidden).toBe(true);
  });
});

describe('palettes', () => {
  it('pass WCAG AA: every text colour on every background, bright on the wash', () => {
    for (const p of PALETTES) {
      const c = p.colors;
      expect(c.bg).toBe('#000000');
      for (const text of [c.textDim, c.text, c.accent, c.textBright]) {
        for (const bg of [c.bg, c.surface, c.surfaceRaised]) expect(contrast(text, bg), `${p.id} ${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(c.textBright, c.wash)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('scenes', () => {
  it('have unique ids, and ← / → wrap round', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    expect(stepScene(SCENES[0]!.id, -1)).toBe(SCENES[SCENES.length - 1]!.id);
    expect(stepScene(SCENES[SCENES.length - 1]!.id, 1)).toBe(SCENES[0]!.id);
  });
});
