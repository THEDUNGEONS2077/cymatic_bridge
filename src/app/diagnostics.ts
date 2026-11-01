/**
 * src/app/diagnostics.ts: gathers the facts for COPY DIAGNOSTICS and puts
 * the report on the clipboard.
 *
 * Layer: UI (browser APIs). lib/diagnostics.ts lays the report out; this
 * reads the browser, the stage's last few seconds of frames, the signal
 * and the capture's state. The shared tab's title is left out.
 */
import { latestSignal } from '@/audio/listen';
import { diagnosticsText } from '@/lib/diagnostics';
import { findScene } from '@/lib/scenes';
import { sceneSettings, type Settings } from '@/lib/settings';
import { percentile } from '@/lib/sharpness';
import { OFFSET, SCALAR, SCALARS } from '@/lib/signal/layout';
import { sceneStats } from '@/scene/host';
import { liveStore } from '@/store/live';

/** Builds the report from the page as it is now. */
export async function diagnosticsReport(settings: Settings): Promise<string> {
  const stats = await sceneStats(3000);
  const gaps = stats?.gaps ?? [];
  const span = gaps.reduce((a, b) => a + b, 0);
  const scene = findScene(settings.scene);
  const own = sceneSettings(settings, scene.id);
  const s = latestSignal();
  const names = Object.keys(SCALAR) as (keyof typeof SCALAR)[];
  const signal: Record<string, number> = {};
  for (const k of names.slice(0, SCALARS)) signal[k] = s[OFFSET.scalars + SCALAR[k]] ?? Number.NaN;
  const live = liveStore.getState();
  return diagnosticsText({
    version: __APP_VERSION__,
    build: __APP_BUILD__,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screen: `${screen.width}×${screen.height}`,
    window: `${window.innerWidth}×${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    scene: scene.id,
    look: `palette ${own.palette} · glow ${own.glow} · sensitivity ${own.sensitivity} · trails ${own.trails} · zoom ${own.zoom}`,
    canvas: stats ? `${stats.w}×${stats.h}` : 'none',
    fps: span > 0 ? (1000 * gaps.length) / span : Number.NaN,
    drawP95: stats ? percentile(stats.durations, 0.95) : Number.NaN,
    signal,
    capture: live.capture,
    bridge: live.bridge ?? 'not listening',
  });
}

/** Copies the report to the clipboard; false if the browser refused. */
export async function copyDiagnostics(settings: Settings): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(await diagnosticsReport(settings));
    return true;
  } catch {
    return false;
  }
}
