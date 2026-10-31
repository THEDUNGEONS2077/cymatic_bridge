/**
 * src/store/kv.ts: the small async key-value interface persistence uses,
 * the storage keys, and an in-memory implementation for tests.
 *
 * Layer: store. cyberdeck_terminal's, cut down to this app's keys:
 * persist.ts talks to this interface instead of IndexedDB directly, so its
 * logic (startup, corrupt-data handling) runs in plain Vitest tests against
 * a Map. The IndexedDB implementation is in store/idbKV.ts.
 */

/** Async key-value storage (values are structured-cloneable objects). */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Every storage key in one place. */
export const KEYS = {
  /** The settings document (lib/settings.ts). */
  settings: 'settings.v1',
  /** Unreadable data is kept under `corrupt.<epoch ms>` instead of being thrown away. */
  corruptPrefix: 'corrupt.',
} as const;

/** A KV backed by a Map: for tests (values are deep-copied, as IndexedDB would). */
export function memoryKV(initial: Record<string, unknown> = {}): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  return {
    data,
    get: async (key) => structuredClone(data.get(key)),
    set: async (key, value) => void data.set(key, structuredClone(value)),
    del: async (key) => void data.delete(key),
    keys: async () => [...data.keys()],
  };
}
