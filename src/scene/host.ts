/**
 * src/scene/host.ts: runs the stage on the page's one canvas, from the
 * first moment of loading.
 *
 * Layer: scene (DOM + canvas; no React, no stores). The canvas is plain
 * HTML in index.html, and main.tsx starts the stage here before anything
 * else loads, so the idle breath is on screen at once. React only tells the
 * host when the scene or its settings change (app/App.tsx); the audio code
 * (audio/listen.ts) posts a SIGNAL frame every frame.
 *
 * The stage runs in a worker of its own (worker.ts) on an OffscreenCanvas
 * (cyberdeck's 0.5.0). Unlike cyberdeck there's no page fallback: SIGNAL
 * needs WebGL 2 in a worker, which every Chrome this page supports has; if
 * it can't start, the page says so.
 *
 * The host:
 *   - sizes the canvas to the window (the page is the visual), at the
 *     screen's pixel ratio, capped (lib/sharpness.ts), resizing after
 *     RESIZE_DEBOUNCE_MS;
 *   - stops the stage while the page is hidden (R17), restarts it on return;
 *   - runs the sharpness guard: after the first frame has settled it reads
 *     the worker's frame ring, and steps back to SAFE_DPR if frames were slow
 *     (remembered per scene, a start-up hint);
 *   - gives the browser tests and the signal meter a probe
 *     (window.__cymatic.stage, sceneStats);
 *   - keeps at most one SIGNAL frame in flight (0.2.0). The worker draws
 *     each frame as it arrives (0.1.1), and answers `drawn`; until then a
 *     newer frame waits here, replacing any older one waiting. Without this,
 *     a worker slower than the page (a scene too heavy for the GPU, or
 *     headless Chrome's uncapped frames) let frames queue up: the visuals
 *     fell further and further behind, and every other message (stop,
 *     probes) waited behind them.
 */
import { findPalette } from '@/lib/palettes';
import { findScene, type SceneSettings } from '@/lib/scenes';
import type { Signal } from '@/lib/signal/layout';
import { drawnDpr, GUARD_BUDGET_MS, GUARD_SETTLE_MS, GUARD_WATCH_MS, guardVerdict, normalizeSharpness, SAFE_DPR, type Sharpness, wantsGuard } from '@/lib/sharpness';

import type { FromWorker, PixelsProbe, SceneLook, StageSize, StatsProbe, ToWorker } from './types';
// The worker's code, inlined into this chunk (it starts from a Blob URL): no extra request before the scene can start.
import SceneWorker from './worker.ts?worker&inline';

/** Waits this long after the last resize before resizing the canvas (ms). */
const RESIZE_DEBOUNCE_MS = 150;
/** The sharpness guard's verdicts, per scene: this app's own localStorage prefix (two other apps share the origin). */
const SHARP_KEY = 'cymatic_bridge:sharp';
/** The browser tests' knob: the guard's budget (ms) instead of GUARD_BUDGET_MS. */
const BUDGET_KEY = 'cymatic_bridge:sharp-budget';

let worker: Worker | null = null;
let sceneId = '';
let size: StageSize | null = null;
let failed: string | null = null;
/** Flow control: is a SIGNAL frame with the worker, and the newest one waiting to go (a copy). */
let inFlight = false;
let waitingSignal: Float32Array | null = null;
let onFailure: (message: string) => void = () => {};
// Probes waiting for their answers, by id.
const waiting = new Map<number, (result: never) => void>();
let asked = 0;

/** Reads a localStorage hint (null when there is none, or storage is blocked). */
function readHint(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The guard's verdicts (the last visits', kept as a hint). */
let sharp: Record<string, Sharpness> = (() => {
  try {
    return normalizeSharpness(JSON.parse(readHint(SHARP_KEY) ?? '{}'));
  } catch {
    return {};
  }
})();

/** Sends the worker a message. */
function send(m: ToWorker, transfer: Transferable[] = []): void {
  worker?.postMessage(m, transfer);
}

/** Asks the worker a probe and waits for its answer. */
function ask<T>(make: (id: number) => ToWorker): Promise<T> {
  return new Promise<T>((resolve) => {
    waiting.set(++asked, resolve as (result: never) => void);
    send(make(asked));
  });
}

/** The canvas's wanted size: the window's CSS px at the scene's pixel ratio. */
function wantedSize(): StageSize {
  const screenDpr = window.devicePixelRatio || 1;
  return { w: window.innerWidth, h: window.innerHeight, dpr: drawnDpr(screenDpr, SAFE_DPR, sharp[sceneId]) };
}

/** A scene's look for the worker: its settings with the palette's colours resolved. */
export function lookOf(settings: SceneSettings): SceneLook {
  return { colors: findPalette(settings.palette).colors, glow: settings.glow, sensitivity: settings.sensitivity, trails: settings.trails, zoom: settings.zoom };
}

/** Resizes the canvas if the window or pixel ratio changed. */
function measure(): void {
  const next = wantedSize();
  if (size && next.w === size.w && next.h === size.h && next.dpr === size.dpr) return;
  size = next;
  send({ type: 'resize', size: next });
}

let guardTimer: ReturnType<typeof setTimeout> | undefined;

/** The sharpness guard (cyberdeck's): watches the scene's first seconds, then keeps full sharpness or steps back. */
function guard(): void {
  clearTimeout(guardTimer);
  const id = sceneId;
  if (!wantsGuard(window.devicePixelRatio || 1, SAFE_DPR) || sharp[id] === 'safe') return;
  const budget = Number(readHint(BUDGET_KEY) ?? Number.NaN);
  guardTimer = setTimeout(() => {
    void sceneStats(GUARD_WATCH_MS).then((s) => {
      if (sceneId !== id || !s) return;
      const verdict = guardVerdict(s.durations, Number.isFinite(budget) ? budget : GUARD_BUDGET_MS);
      if (!verdict) return;
      sharp = { ...sharp, [id]: verdict };
      try {
        localStorage.setItem(SHARP_KEY, JSON.stringify(sharp));
      } catch {
        // Storage blocked: it watches again next time.
      }
      if (verdict === 'safe') measure();
    });
  }, GUARD_SETTLE_MS + GUARD_WATCH_MS);
}

/**
 * Starts the stage on the canvas in index.html, showing scene `id` with
 * `settings`. Called once, by main.tsx; `failure` is told if it can't run.
 */
export function startStage(id: string, settings: SceneSettings, failure: (message: string) => void): void {
  onFailure = failure;
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
  if (!canvas || worker) return;
  if (typeof Worker === 'undefined' || !('transferControlToOffscreen' in HTMLCanvasElement.prototype)) {
    fail('THIS BROWSER CAN’T DRAW IN A WORKER · USE A CURRENT CHROME');
    return;
  }
  sceneId = findScene(id).id;
  worker = new SceneWorker({ name: 'scene' });
  worker.onmessage = ({ data: m }: MessageEvent<FromWorker>) => {
    if (m.type === 'drawn') {
      inFlight = false;
      if (waitingSignal) {
        const next = waitingSignal;
        waitingSignal = null;
        inFlight = true;
        send({ type: 'signal', signal: next });
      }
    } else if (m.type === 'ready') {
      canvas.dataset.ready = '';
      guard();
    } else if (m.type === 'error') fail(`THE SCENE COULDN’T DRAW · ${m.message.slice(0, 120)}`);
    else {
      waiting.get(m.id)?.(m.result as never);
      waiting.delete(m.id);
    }
  };
  worker.onerror = (e) => {
    e.preventDefault();
    fail('THE SCENE STOPPED');
  };
  size = wantedSize();
  const offscreen = canvas.transferControlToOffscreen();
  send({ type: 'init', canvas: offscreen, size, scene: sceneId, look: lookOf(settings), trails: findScene(sceneId).trails }, [offscreen]);
  if (!document.hidden) send({ type: 'start' });
}

/** Reports a failure once (the HUD shows it). */
function fail(message: string): void {
  if (failed) return;
  failed = message;
  console.error(message);
  onFailure(message);
}

/** Shows scene `id` with `settings` (crossfading), or updates its settings if it's showing. */
export function showScene(id: string, settings: SceneSettings): void {
  const info = findScene(id);
  if (info.id !== sceneId) {
    sceneId = info.id;
    send({ type: 'scene', scene: info.id, look: lookOf(settings), trails: info.trails });
    // The new scene's own sharpness.
    measure();
    guard();
  } else send({ type: 'look', look: lookOf(settings) });
}

/**
 * Posts this frame's SIGNAL to the stage (posting copies it: the engine
 * reuses its array). If the last one hasn't been drawn yet, this one waits,
 * replacing any older one waiting (only the newest matters).
 */
export function postSignal(signal: Signal): void {
  if (!worker) return;
  if (inFlight) {
    if (!waitingSignal) waitingSignal = new Float32Array(signal.length);
    waitingSignal.set(signal);
    return;
  }
  inFlight = true;
  send({ type: 'signal', signal });
}

/** The frames of the last `ms` from the worker's ring (null before the stage runs). */
export function sceneStats(ms: number): Promise<StatsProbe | null> {
  if (!worker) return Promise.resolve(null);
  return ask<StatsProbe>((id) => ({ type: 'probe', id, what: 'stats', ms }));
}

// For the browser tests (e2e/): ask the stage how it's doing, or lose its context on purpose.
(window as unknown as { __cymaticStage: object }).__cymaticStage = {
  pixels: () => (worker ? ask<PixelsProbe>((id) => ({ type: 'probe', id, what: 'pixels' })) : Promise.resolve(null)),
  stats: (ms: number) => sceneStats(ms),
  lose: () => send({ type: 'lose' }),
  scene: () => sceneId,
  size: () => size,
};

// The window's events, installed once.
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
});
document.addEventListener('fullscreenchange', () => {
  clearTimeout(resizeTimer);
  requestAnimationFrame(measure);
});
// Draw only while the page can be seen (R17).
document.addEventListener('visibilitychange', () => send({ type: document.hidden ? 'stop' : 'start' }));
