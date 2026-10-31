/**
 * src/scene/worker.ts: the scene's own thread.
 *
 * Layer: scene (a dedicated worker; no DOM, no stores). The host (host.ts)
 * hands over the page's canvas as an OffscreenCanvas, and the stage
 * (stage.ts) draws every frame here, off the page's main thread
 * (cyberdeck's wallpaper worker, 0.5.0). The page's thread is left to the
 * audio analysis and the HUD: it posts one SIGNAL frame per frame, and the
 * stage draws with the latest it has.
 *
 * Every frame's start and drawing time go into a small ring (the last RING
 * frames, no allocation), so a `stats` probe is answered at once: the
 * host's sharpness guard (lib/sharpness.ts) and the signal meter read it.
 */
import { createStage, type Stage } from './stage';
import type { FromWorker, StatsProbe, ToWorker } from './types';

/** The parts of the worker's global scope used here (the DOM typings describe a window). */
interface WorkerScope {
  postMessage(message: FromWorker): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
  close(): void;
}
const scope = self as unknown as WorkerScope;

/** How many frames the ring keeps (at 144 a second, about 3.5 s). */
const RING = 512;
const ringStart = new Float64Array(RING);
const ringDraw = new Float64Array(RING);
let ringNext = 0;
let ringCount = 0;

let stage: Stage | null = null;
let canvasSize = { w: 0, h: 0 };

/** The frames that started in the last `ms` (from the ring), oldest first. */
function stats(ms: number): StatsProbe {
  const since = performance.now() - ms;
  const gaps: number[] = [];
  const durations: number[] = [];
  let prev = Number.NaN;
  for (let k = ringCount; k > 0; k--) {
    const i = (ringNext - k + RING) % RING;
    if (ringStart[i]! < since) continue;
    if (!Number.isNaN(prev)) gaps.push(ringStart[i]! - prev);
    prev = ringStart[i]!;
    durations.push(ringDraw[i]!);
  }
  return { gaps, durations, w: canvasSize.w, h: canvasSize.h, running: stage?.running ?? false };
}

scope.onmessage = ({ data: m }) => {
  switch (m.type) {
    case 'init':
      try {
        stage = createStage(m.canvas, m.size, m.scene, m.look, m.trails, {
          ready: () => scope.postMessage({ type: 'ready' }),
          error: (message) => scope.postMessage({ type: 'error', message }),
          frame: (start, took) => {
            ringStart[ringNext] = start;
            ringDraw[ringNext] = took;
            ringNext = (ringNext + 1) % RING;
            ringCount = Math.min(RING, ringCount + 1);
            canvasSize = { w: m.canvas.width, h: m.canvas.height };
          },
          requestFrame: (cb) => scope.requestAnimationFrame(cb),
          cancelFrame: (id) => scope.cancelAnimationFrame(id),
        });
      } catch (e) {
        scope.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      }
      break;
    case 'resize':
      stage?.resize(m.size);
      break;
    case 'signal':
      stage?.setSignal(m.signal);
      break;
    case 'scene':
      stage?.setScene(m.scene, m.look, m.trails);
      break;
    case 'look':
      stage?.setLook(m.look);
      break;
    case 'start':
      stage?.start();
      break;
    case 'stop':
      stage?.stop();
      break;
    case 'probe':
      if (m.what === 'stats') scope.postMessage({ type: 'probe', id: m.id, result: stats(m.ms) });
      else if (stage) void stage.pixels().then((result) => scope.postMessage({ type: 'probe', id: m.id, result }));
      break;
    case 'lose':
      stage?.lose();
      break;
    case 'destroy':
      stage?.destroy();
      scope.close();
      break;
  }
};
