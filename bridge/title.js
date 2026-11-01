// bridge/title.js: the title bridge's one script, run on YouTube and YouTube Music tabs.
//
// When you share a tab with cymatic_bridge (LISTEN), the page gets the tab's
// sound and video track, but a webpage can't read another tab's title. Chrome
// lets a page label itself for whoever captures it: the "capture handle". This
// script sets that label to the tab's title (and this bridge's version), and
// sets it again whenever the title changes (YouTube changes it in place as
// the next video or song starts). The visualizer reads it from the shared
// tab's video track, so the title is always the tab you actually shared.
//
// It has no permissions, sends nothing anywhere and reads nothing but the
// tab's title. Only cymatic_bridge's own addresses may read the label
// (PERMITTED below); any other page capturing the tab sees nothing.

/** This bridge's version: the page offers an update when it's older than the page expects (src/lib/bridge.ts). */
const VERSION = '1.0.0';
/** Who may read the label: the published page, and the local dev server and test addresses. */
const PERMITTED = [
  'https://thedungeons2077.github.io',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8173',
  'http://127.0.0.1:8175',
];
/** The label's length limit (Chrome's is 1024 characters; JSON adds a little). */
const MAX_TITLE = 400;

/** The last label set, so an unchanged title isn't set again. */
let last = '';

/** Sets the capture handle to the tab's current title. */
function label() {
  const handle = JSON.stringify({ app: 'cymatic_bridge', v: VERSION, title: document.title.slice(0, MAX_TITLE) });
  if (handle === last) return;
  last = handle;
  try {
    navigator.mediaDevices.setCaptureHandleConfig({ handle, exposeOrigin: false, permittedOrigins: PERMITTED });
  } catch {
    // Not in a top-level page, or the browser has no capture handles: nothing to label.
  }
}

label();
// The title changes in place (a new video, the next song in a mix): watch <head> for it,
// since YouTube can replace the <title> element as well as its text.
new MutationObserver(label).observe(document.head, { childList: true, subtree: true, characterData: true });
