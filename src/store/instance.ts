/**
 * src/store/instance.ts: the one settings store, and a React hook to read it.
 *
 * Layer: store. start.tsx makes the store once storage has answered and
 * sets it here; the app's components read it through useSettings.
 */
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import type { SettingsState } from './settings';

let instance: StoreApi<SettingsState> | null = null;

/** Sets the store (start.tsx, once). */
export function setSettingsStore(store: StoreApi<SettingsState>): void {
  instance = store;
}

/** The store (throws if read before start.tsx set it: a bug). */
export function settingsStore(): StoreApi<SettingsState> {
  if (!instance) throw new Error('settings store not ready');
  return instance;
}

/** Reads part of the settings state in a component. */
export function useSettings<T>(select: (s: SettingsState) => T): T {
  return useStore(settingsStore(), select);
}
