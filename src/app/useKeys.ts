/**
 * src/app/useKeys.ts: the page's keys (R12, the user's minimal set):
 *   F      fullscreen with only the visual (app/fullscreen.ts)
 *   H      hide / show the HUD
 *   ← / →  the previous / next scene
 *   D      the signal meter
 * Everything else is by mouse. Keys with a modifier (Ctrl+F is the
 * browser's find) and keys typed into a field are left alone.
 *
 * Layer: UI.
 */
import { useEffect } from 'react';

import { liveStore } from '@/store/live';
import { settingsStore } from '@/store/instance';

import { toggleFullscreen } from './fullscreen';

/** Installs the keys while the app is mounted. */
export function useKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const settings = settingsStore().getState();
      switch (e.key) {
        case 'f':
        case 'F':
          void toggleFullscreen();
          break;
        case 'h':
        case 'H':
          settings.setHudHidden(!settings.settings.hudHidden);
          break;
        case 'ArrowLeft':
          settings.stepScene(-1);
          break;
        case 'ArrowRight':
          settings.stepScene(1);
          break;
        case 'd':
        case 'D':
          liveStore.getState().toggleMeter();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
