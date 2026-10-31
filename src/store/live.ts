/**
 * src/store/live.ts: what's happening now, never saved: the capture's
 * state, fullscreen, the signal meter, the HUD's notice.
 *
 * Layer: store (zustand). The audio code (audio/listen.ts) sets the
 * capture's state; the HUD reads it.
 */
import { createStore } from 'zustand/vanilla';

/** Where the capture is: off (LISTEN shows), asking (Chrome's picker is open), or live. */
export type CaptureState = 'off' | 'asking' | 'live';

/** The live store's state and actions. */
export interface LiveState {
  capture: CaptureState;
  /** The shared tab's title (S2, the title bridge), or null. */
  title: string | null;
  /** Is the page fullscreen (F)? Follows the browser's own state. */
  immersive: boolean;
  /** Is the signal meter open (D)? */
  meter: boolean;
  /** A short notice under the HUD (null: none). */
  notice: string | null;
  setCapture(c: CaptureState): void;
  setTitle(t: string | null): void;
  setImmersive(on: boolean): void;
  toggleMeter(): void;
  /** Shows `text` for NOTICE_MS (a newer notice replaces it). */
  showNotice(text: string): void;
}

/** How long a notice shows (ms). */
export const NOTICE_MS = 6000;

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

/** The one live store. */
export const liveStore = createStore<LiveState>()((set) => ({
  capture: 'off',
  title: null,
  immersive: false,
  meter: false,
  notice: null,
  setCapture: (capture) => set({ capture }),
  setTitle: (title) => set({ title }),
  setImmersive: (immersive) => set({ immersive }),
  toggleMeter: () => set((s) => ({ meter: !s.meter })),
  showNotice: (text) => {
    clearTimeout(noticeTimer);
    set({ notice: text });
    noticeTimer = setTimeout(() => set({ notice: null }), NOTICE_MS);
  },
}));
