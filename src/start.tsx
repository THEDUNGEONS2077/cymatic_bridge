/**
 * src/start.tsx: the app's startup: storage, then the HUD.
 *
 * Layer: entry point (second stage). main.tsx has already started the stage
 * and the listen loop, and loads this module in parallel. It reads the
 * settings before the first render (store/persist.ts boot), so the HUD never
 * flashes defaults. If the browser blocks storage, the page still runs from
 * memory and says that changes won't be kept.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { idbKV } from './store/idbKV';
import { type KV, memoryKV } from './store/kv';
import { liveStore } from './store/live';
import { type Boot, boot } from './store/persist';
import { createSettingsStore } from './store/settings';
import { setSettingsStore } from './store/instance';

/** The notice when storage can't be used at all. */
const NOTICE_NO_STORAGE = 'BROWSER STORAGE IS BLOCKED · SETTINGS WON’T BE KEPT';

// Storage: IndexedDB, or memory if the browser refuses it.
let kv: KV = idbKV();
let booted: Boot;
try {
  booted = await boot(kv, Date.now());
} catch (e) {
  console.error('storage unavailable', e);
  kv = memoryKV();
  booted = { ...(await boot(kv, Date.now())), notice: NOTICE_NO_STORAGE };
}

const store = createSettingsStore(kv, booted.settings, (e) => {
  console.error('save failed', e);
  liveStore.getState().showNotice('COULDN’T SAVE THE SETTINGS');
});
setSettingsStore(store);
if (booted.notice) liveStore.getState().showNotice(booted.notice);

// Leaving the page: write a pending save now.
window.addEventListener('pagehide', () => void store.getState().flush());

// A handle for the browser tests: the settings, and a pending save written now.
(window as unknown as { __cymatic: object }).__cymatic = {
  settings: () => store.getState().settings,
  flush: () => store.getState().flush(),
};

// The service worker (production builds only): opens instantly, works offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
