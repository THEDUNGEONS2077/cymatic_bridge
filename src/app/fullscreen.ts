/**
 * src/app/fullscreen.ts: F: the browser's fullscreen with the HUD hidden,
 * so only the visual shows (R12, as cyberdeck's immersive mode).
 *
 * Layer: UI (the Fullscreen API). cyberdeck's, unchanged in how it works:
 * the live store's `immersive` always follows the browser's own state
 * (`fullscreenchange`), never the other way round, so leaving with Esc, F11
 * or the browser's controls brings the HUD back too.
 */
import { useEffect } from 'react';

import { liveStore } from '@/store/live';

/**
 * Enters fullscreen, or leaves it if already in. Must run inside a user
 * action (a key press or click): browsers refuse fullscreen otherwise. A
 * refusal is ignored.
 */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Refused: the page stays as it is.
  }
}

/** Keeps the live store's `immersive` in step with the browser's fullscreen state. */
export function useFullscreenSync(): void {
  useEffect(() => {
    const sync = () => liveStore.getState().setImmersive(!!document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
}

/** With the HUD out of sight, the pointer hides after this long without moving (ms). */
export const IDLE_CURSOR_MS = 2000;

/**
 * Hides the mouse pointer while `on` and the mouse has been still for
 * IDLE_CURSOR_MS (`data-idle` on <html>; app.css hides the cursor). Any
 * movement brings it back.
 */
export function useIdleCursor(on: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    if (!on) {
      delete root.dataset.idle;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      delete root.dataset.idle;
      clearTimeout(timer);
      timer = setTimeout(() => (root.dataset.idle = ''), IDLE_CURSOR_MS);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('mousedown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('mousedown', wake);
      delete root.dataset.idle;
    };
  }, [on]);
}
