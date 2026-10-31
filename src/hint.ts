/**
 * src/hint.ts: the start-up hint: the last visit's scene and its settings.
 *
 * Layer: entry point helper (localStorage, no React, no stores). The
 * settings live in IndexedDB, which is read after the stage has started; so
 * the scene and its settings are also kept here (a hint only, written
 * whenever they change), and the very first frame shows the right scene in
 * the right colours instead of switching once storage answers. The key is
 * this app's own: cyberdeck_terminal and quest_log_desktop share the origin.
 */
import { DEFAULT_SCENE, findScene, type SceneSettings } from '@/lib/scenes';
import { normalizeSceneSettings } from '@/lib/settings';

/** The localStorage key. */
const HINT_KEY = 'cymatic_bridge:scene';

/** The last visit's scene and settings (or the defaults). */
export function sceneHint(): { id: string; settings: SceneSettings } {
  try {
    const raw = JSON.parse(localStorage.getItem(HINT_KEY) ?? 'null') as { id?: unknown; settings?: unknown } | null;
    const id = findScene(typeof raw?.id === 'string' ? raw.id : DEFAULT_SCENE).id;
    return { id, settings: normalizeSceneSettings(id, raw?.settings) };
  } catch {
    return { id: DEFAULT_SCENE, settings: findScene(DEFAULT_SCENE).defaults };
  }
}

/** Remembers the scene and its settings for the next start (best effort). */
export function saveSceneHint(id: string, settings: SceneSettings): void {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify({ id, settings }));
  } catch {
    // Storage blocked: the next start shows the default first.
  }
}
