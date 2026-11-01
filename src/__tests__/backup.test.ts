/**
 * src/__tests__/backup.test.ts: EXPORT / IMPORT files and the diagnostics
 * report.
 *
 * Layer: tests (Node). A file round-trips; anything that isn't this app's
 * settings is refused with a reason; an older settings document in a file
 * imports through the migrations; the report holds what it should and no title.
 */
import { describe, expect, it } from 'vitest';

import { readSettingsFile, settingsFile, settingsFileName } from '@/lib/backup';
import { diagnosticsText } from '@/lib/diagnostics';
import { defaultSettings } from '@/lib/settings';

describe('settings files', () => {
  it('round-trip', () => {
    const s = { ...defaultSettings(), hudHidden: true, scenes: { test: { palette: 'laser' as const, glow: 'max' as const, sensitivity: 1.5, trails: 0.25, zoom: 1.25 } } };
    const text = JSON.stringify(settingsFile(s, '0.3.0', 4, Date.UTC(2026, 10, 1)));
    const r = readSettingsFile(text);
    expect(r.ok && r.settings).toEqual(s);
  });

  it('are named by date', () => {
    expect(settingsFileName(Date.UTC(2026, 10, 1, 12))).toBe('cymatic-bridge-settings-2026-11-01.json');
  });

  it('refuse what isn’t this app’s settings, saying why', () => {
    expect(readSettingsFile('nope')).toEqual({ ok: false, reason: 'NOT A JSON FILE' });
    expect(readSettingsFile(JSON.stringify({ app: 'cyberdeck_terminal', kind: 'settings' }))).toEqual({ ok: false, reason: 'NOT A CYMATIC BRIDGE SETTINGS FILE' });
    expect(readSettingsFile(JSON.stringify({ app: 'cymatic_bridge', kind: 'settings', settings: { v: 'x' } }))).toEqual({ ok: false, reason: 'ITS SETTINGS COULDN’T BE READ' });
  });

  it('import a 0.1 document (no bridgeOffer) through the migrations', () => {
    const r = readSettingsFile(JSON.stringify({ app: 'cymatic_bridge', kind: 'settings', settings: { v: 1, scene: 'test', hudHidden: false, scenes: {} } }));
    expect(r.ok && r.settings.bridgeOffer).toBe(true);
  });
});

describe('the diagnostics report', () => {
  it('lays the facts out, one kind a line', () => {
    const text = diagnosticsText({
      version: '0.3.0',
      build: 4,
      at: '2026-11-01T00:00:00.000Z',
      userAgent: 'Chrome',
      screen: '1920×1080',
      window: '1920×1040',
      dpr: 1,
      scene: 'test',
      look: 'palette uv',
      canvas: '1920×1040',
      fps: 143.6,
      drawP95: 0.42,
      signal: { level: 0.5, beat: 0 },
      capture: 'live',
      bridge: 'ok',
    });
    expect(text.split('\n')).toHaveLength(7);
    expect(text).toContain('cymatic_bridge 0.3.0 (build 4)');
    expect(text).toContain('144 fps');
    expect(text).toContain('level 0.500');
  });
});
