/**
 * src/store/settings.ts: the settings document, live, and saved on change.
 *
 * Layer: store (zustand). Every change goes through an action here, then
 * the document is saved to the KV after SAVE_DEBOUNCE_MS (a run of ← / →
 * presses is one write). A failed save is reported through `onError` (the
 * HUD says so); the page keeps running from memory.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import { type SceneSettings, stepScene } from '@/lib/scenes';
import { normalizeSceneSettings, sceneSettings, type Settings } from '@/lib/settings';

import { KEYS, type KV } from './kv';

/** How long after the last change the settings are written (ms). */
export const SAVE_DEBOUNCE_MS = 300;

/** The settings store's state and actions. */
export interface SettingsState {
  settings: Settings;
  /** Shows the scene `step` places on (← -1, → +1). */
  stepScene(step: number): void;
  /** Shows scene `id`. */
  setScene(id: string): void;
  /** Hides or shows the HUD (H). */
  setHudHidden(hidden: boolean): void;
  /** Turns the title bridge's offer on or off. */
  setBridgeOffer(on: boolean): void;
  /** Changes part of scene `id`'s own settings (checked, as stored ones are). */
  setSceneSetting(id: string, patch: Partial<SceneSettings>): void;
  /** Gives scene `id` its defaults back. */
  resetScene(id: string): void;
  /**
   * Replaces every setting (IMPORT). The settings before it are kept under
   * KEYS.beforeImport first, so an import never loses what was there.
   */
  replaceSettings(next: Settings): Promise<void>;
  /** Writes a pending save now (leaving the page). */
  flush(): Promise<void>;
}

/** Makes the store over `kv`, starting from `initial` (what boot found). */
export function createSettingsStore(kv: KV, initial: Settings, onError: (e: unknown) => void): StoreApi<SettingsState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  const write = async () => {
    clearTimeout(timer);
    if (!pending) return;
    pending = false;
    try {
      await kv.set(KEYS.settings, store.getState().settings);
    } catch (e) {
      onError(e);
    }
  };
  /** Applies a change and schedules the save. */
  const change = (next: (s: Settings) => Settings) => {
    store.setState((st) => ({ settings: next(st.settings) }));
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => void write(), SAVE_DEBOUNCE_MS);
  };
  const store = createStore<SettingsState>()(() => ({
    settings: initial,
    stepScene: (step) => change((s) => ({ ...s, scene: stepScene(s.scene, step) })),
    setScene: (id) => change((s) => ({ ...s, scene: id })),
    setHudHidden: (hidden) => change((s) => ({ ...s, hudHidden: hidden })),
    setBridgeOffer: (on) => change((s) => ({ ...s, bridgeOffer: on })),
    setSceneSetting: (id, patch) =>
      change((s) => ({ ...s, scenes: { ...s.scenes, [id]: normalizeSceneSettings(id, { ...sceneSettings(s, id), ...patch }) } })),
    resetScene: (id) =>
      change((s) => {
        const scenes = { ...s.scenes };
        delete scenes[id];
        return { ...s, scenes };
      }),
    replaceSettings: async (next) => {
      try {
        await kv.set(KEYS.beforeImport, store.getState().settings);
      } catch (e) {
        onError(e);
      }
      change(() => next);
      await write();
    },
    flush: write,
  }));
  return store;
}
