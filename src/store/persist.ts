/**
 * src/store/persist.ts: loading the settings at startup.
 *
 * Layer: store. The light version of cyberdeck's boot (R26): read the
 * document, migrate it (lib/migrations.ts), and if it can't be read, keep
 * the raw value under `corrupt.<now>` and start from the defaults: data that
 * couldn't be read is never written over.
 */
import { migrateSettings } from '@/lib/migrations';
import { defaultSettings, type Settings } from '@/lib/settings';

import { KEYS, type KV } from './kv';

/** What startup found. */
export interface Boot {
  settings: Settings;
  /** A notice for the HUD (damaged settings, blocked storage), if any. */
  notice?: string;
}

/** The notice when the stored settings couldn't be read. */
export const NOTICE_DAMAGED = 'SAVED SETTINGS COULDN’T BE READ · KEPT ASIDE, DEFAULTS IN USE';

/** Loads the settings from `kv` (at time `now`, epoch ms, for the corrupt copy's key). */
export async function boot(kv: KV, now: number): Promise<Boot> {
  const raw = await kv.get(KEYS.settings);
  if (raw === undefined) return { settings: defaultSettings() };
  const m = migrateSettings(raw);
  if (m.ok) return { settings: m.settings };
  // Keep what couldn't be read, then start fresh (the fresh copy is only written on the first change).
  await kv.set(`${KEYS.corruptPrefix}${now}`, { reason: m.reason, raw });
  await kv.del(KEYS.settings);
  return { settings: defaultSettings(), notice: NOTICE_DAMAGED };
}
