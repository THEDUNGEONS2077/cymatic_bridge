/**
 * src/audio/listen.ts: LISTEN, SWITCH and STOP, and the loop that turns
 * the shared tab's sound into a SIGNAL frame every frame.
 *
 * Layer: audio (browser APIs; it sets the live store's capture state). The
 * loop runs on the page's main thread (an AnalyserNode lives where its
 * AudioContext does) at the screen's frame rate, while the page is visible:
 * read the analysers → step the SIGNAL engine (lib/signal) → post the frame
 * to the stage (scene/host.ts). Before LISTEN, and after a share ends, it
 * steps the engine with silence, so the scene breathes in idle (R14) through
 * the very same path. Hidden, it stops and the audio context sleeps (R17);
 * the share itself stays open.
 *
 * When the share ends (Chrome's "Stop sharing", the shared tab closed), the
 * tracks end, and the page goes back to LISTEN while the scene eases into
 * idle (R7). Nothing pops up.
 *
 * The title (R9, S2): the title bridge labels a YouTube tab with its title
 * through Chrome's capture handle, which the shared tab's video track
 * carries. It's read when the share starts and again on every
 * `capturehandlechange` (the next video, the next song, or the user moving
 * the share with "Share this tab instead"). It's always the shared tab's own.
 */
import { BRIDGE_VERSION, isOlder, parseHandle } from '@/lib/bridge';
import { setScalar } from '@/lib/signal/layout';
import { type ReactProfile, createSignalEngine, type SignalEngine } from '@/lib/signal/signal';
import { postSignal } from '@/scene/host';
import { liveStore } from '@/store/live';

import { type Analyser, createAnalyser, FAST_FFT_SIZE, FFT_SIZE } from './analyser';
import { captureTab, stopStream } from './capture';

/** The notice when a tab was shared without its sound (R8). */
export const NOTICE_NO_AUDIO = 'NO SOUND SHARED · IN CHROME’S PICKER, TURN ON “ALSO SHARE TAB AUDIO”';
/** The notice when the browser can't share tabs. */
export const NOTICE_UNSUPPORTED = 'THIS BROWSER CAN’T SHARE A TAB’S SOUND · USE A CURRENT CHROME';

let analyser: Analyser | null = null;
let stream: MediaStream | null = null;
// Until LISTEN there's no analyser: the engine is made for a typical one (48 kHz) and remade if the real one differs.
let engine: SignalEngine = createSignalEngine(FFT_SIZE / 2, 48000, undefined, FAST_FFT_SIZE / 2);
let profile: ReactProfile | null = null;
let frameId = 0;
let lastT = 0;

/** One frame: read, step, post. */
function tick(t: number): void {
  frameId = requestAnimationFrame(tick);
  const dt = lastT ? (t - lastT) / 1000 : 1 / 60;
  lastT = t;
  const started = performance.now();
  const frame = analyser && stream ? analyser.read() : null;
  const signal = engine.step(frame, dt, t / 1000);
  setScalar(signal, 'cost', performance.now() - started);
  postSignal(signal);
}

/** Starts the loop (if the page is visible). */
function run(): void {
  if (frameId || document.hidden) return;
  lastT = 0;
  frameId = requestAnimationFrame(tick);
}

/** Stops the loop. */
function halt(): void {
  cancelAnimationFrame(frameId);
  frameId = 0;
}

/** The audio graph, made on the first LISTEN, inside its click (analyser.ts says why). */
function ensureAnalyser(): Analyser {
  if (analyser) return analyser;
  analyser = createAnalyser();
  // A context at another rate than the engine assumed: remake it for the real bins.
  if (analyser.sampleRate !== 48000) {
    engine = createSignalEngine(analyser.binCount, analyser.sampleRate, undefined, analyser.fastBinCount);
    if (profile) engine.setProfile(profile);
  }
  return analyser;
}

/** The video track's capture handle (null where the browser has none). */
function handleOf(track: MediaStreamTrack): string | null {
  const t = track as MediaStreamTrack & { getCaptureHandle?: () => { handle?: string } | null };
  return t.getCaptureHandle?.()?.handle ?? null;
}

/** Reads the shared tab's label into the live store: its title, and whether the bridge is there and current. */
function readLabel(track: MediaStreamTrack): void {
  const label = parseHandle(handleOf(track));
  const live = liveStore.getState();
  if (!label) live.setLabel(null, 'none');
  else live.setLabel(label.title || null, isOlder(label.v, BRIDGE_VERSION) ? 'old' : 'ok');
}

/** Uses `s` as the source (the graph reconnected, SWITCH included). */
function adoptStream(s: MediaStream): void {
  if (stream) stopStream(stream);
  stream = s;
  ensureAnalyser().connect(s);
  // The share can end from Chrome's own bar or the tab closing: either track ending ends it.
  for (const track of s.getTracks()) track.addEventListener('ended', () => stream === s && stopListening());
  // The title: now, and whenever the shared tab's label changes.
  const video = s.getVideoTracks()[0];
  if (video) {
    readLabel(video);
    video.addEventListener('capturehandlechange', () => stream === s && readLabel(video));
  } else liveStore.getState().setLabel(null, 'none');
  liveStore.getState().setCapture('live');
}

/**
 * LISTEN (or SWITCH, when already listening): opens Chrome's picker. A
 * cancelled picker leaves things as they were; a share without sound says
 * so (R8). Must be called from a click.
 */
export async function listen(): Promise<void> {
  const live = liveStore.getState();
  const before = live.capture;
  // The audio context first, still inside the click: after the picker's await it could start suspended.
  ensureAnalyser();
  live.setCapture('asking');
  const r = await captureTab();
  if (r.ok) {
    adoptStream(r.stream);
    return;
  }
  live.setCapture(before === 'live' && stream ? 'live' : 'off');
  if (r.why === 'no-audio') live.showNotice(NOTICE_NO_AUDIO);
  else if (r.why === 'unsupported') live.showNotice(NOTICE_UNSUPPORTED);
  else if (r.why === 'failed') live.showNotice(`COULDN’T SHARE THE TAB · ${(r.message ?? '').toUpperCase().slice(0, 80)}`);
}

/** STOP: ends the share; the scene eases into idle and LISTEN shows again (R7). */
export function stopListening(): void {
  if (stream) stopStream(stream);
  stream = null;
  liveStore.getState().setCapture('off');
  liveStore.getState().setLabel(null, null);
}

/** The scene's react profile, from the next frame on (the app, when the scene changes). */
export function setReactProfile(p: ReactProfile): void {
  profile = p;
  engine.setProfile(p);
}

/** The latest SIGNAL frame (the signal meter and the tests read it; don't keep it: it's reused). */
export function latestSignal(): Float32Array {
  return engine.signal;
}

/** Starts the loop: called once, by main.tsx, so the idle breath starts with the page. */
export function startListening(): void {
  run();
}

// Hidden: stop the loop and let the audio sleep; shown again: wake and run (R17).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    halt();
    void analyser?.suspend();
  } else {
    void analyser?.resume();
    run();
  }
});

// For the browser tests: the latest frame as plain numbers.
(window as unknown as { __cymaticSignal: object }).__cymaticSignal = {
  latest: () => Array.from(engine.signal),
  running: () => frameId !== 0,
};
