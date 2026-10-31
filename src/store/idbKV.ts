/**
 * src/store/idbKV.ts: the KV interface (store/kv.ts) on IndexedDB.
 *
 * Layer: store (browser storage). cyberdeck_terminal's, renamed.
 *
 * The database is this app's own (`cymatic_bridge`). cyberdeck_terminal and
 * quest_log_desktop are served from the same origin (thedungeons2077.github.io),
 * so all three apps see the same storage area: they must never share a
 * database name or a localStorage key, or one could overwrite another's data.
 */
import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';

import type { KV } from './kv';

/** This app's IndexedDB database and object store. Never another app's. */
const DB_NAME = 'cymatic_bridge';
const STORE_NAME = 'kv';

/** Opens (creating on first use) the app's IndexedDB store as a KV. */
export function idbKV(): KV {
  const store: UseStore = createStore(DB_NAME, STORE_NAME);
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
  };
}
