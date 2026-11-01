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

/**
 * The title bridge, as seen on the shared tab: none (no label: no bridge,
 * or not a YouTube tab), ok, or old (older than this page expects: the bar
 * offers the update). Null when nothing is shared.
 */
export type BridgeState = 'none' | 'ok' | 'old' | null;

/** The live store's state and actions. */
export interface LiveState {
  capture: CaptureState;
  /** The shared tab's title (from the title bridge), or null. */
  title: string | null;
  /** The title bridge on the shared tab. */
  bridge: BridgeState;
  /** Is the page fullscreen (F)? Follows the browser's own state. */
  immersive: boolean;
  /** Is the signal meter open (D)? */
  meter: boolean;
  /** A short notice under the HUD (null: none). */
  notice: string | null;
  /** The panel open under the bar (the title bridge's steps, or SETTINGS), or null. */
  panel: Panel;
  setPanel(p: Panel): void;
  setCapture(c: CaptureState): void;
  /** The shared tab's label changed (or the share ended: both null). */
  setLabel(title: string | null, bridge: BridgeState): void;
  setImmersive(on: boolean): void;
  toggleMeter(): void;
  /** Shows `text` for NOTICE_MS (a newer notice replaces it). */
  showNotice(text: string): void;
}

/** The panels under the bar. */
export type Panel = 'bridge' | 'settings' | null;

/** How long a notice shows (ms). */
export const NOTICE_MS = 6000;

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

/** The one live store. */
export const liveStore = createStore<LiveState>()((set) => ({
  capture: 'off',
  title: null,
  bridge: null,
  immersive: false,
  meter: false,
  notice: null,
  panel: null,
  setPanel: (panel) => set({ panel }),
  setCapture: (capture) => set({ capture }),
  setLabel: (title, bridge) => set({ title, bridge }),
  setImmersive: (immersive) => set({ immersive }),
  toggleMeter: () => set((s) => ({ meter: !s.meter })),
  showNotice: (text) => {
    clearTimeout(noticeTimer);
    set({ notice: text });
    noticeTimer = setTimeout(() => set({ notice: null }), NOTICE_MS);
  },
}));
