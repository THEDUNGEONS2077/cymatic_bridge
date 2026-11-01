/**
 * src/lib/backup.ts: the settings as a file: EXPORT and IMPORT (R26).
 *
 * Layer: pure lib (tested). The file is JSON:
 *   { app: 'cymatic_bridge', kind: 'settings', version, build, exported, settings }
 * `version` and `build` are the page's that wrote it; `settings` is the
 * settings document, read back through migrations.ts like stored settings,
 * so an older file (or a newer one) imports as well as it can. A file that
 * isn't this app's settings is refused with a reason, never half-applied.
 */
import { migrateSettings } from './migrations';
import type { Settings } from './settings';

/** What an export holds. */
export interface SettingsFile {
  app: 'cymatic_bridge';
  kind: 'settings';
  version: string;
  build: number;
  /** When it was written (ISO time). */
  exported: string;
  settings: Settings;
}

/** The file for `settings`, written by page `version` (build `build`) at `now` (epoch ms). */
export function settingsFile(settings: Settings, version: string, build: number, now: number): SettingsFile {
  return { app: 'cymatic_bridge', kind: 'settings', version, build, exported: new Date(now).toISOString(), settings };
}

/** The file's name for a date (epoch ms): cymatic-bridge-settings-YYYY-MM-DD.json. */
export function settingsFileName(now: number): string {
  return `cymatic-bridge-settings-${new Date(now).toISOString().slice(0, 10)}.json`;
}

/** Reads an imported file's text: the settings, or why not. */
export function readSettingsFile(text: string): { ok: true; settings: Settings } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'NOT A JSON FILE' };
  }
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r || r.app !== 'cymatic_bridge' || r.kind !== 'settings') return { ok: false, reason: 'NOT A CYMATIC BRIDGE SETTINGS FILE' };
  const m = migrateSettings(r.settings);
  return m.ok ? { ok: true, settings: m.settings } : { ok: false, reason: 'ITS SETTINGS COULDN’T BE READ' };
}
