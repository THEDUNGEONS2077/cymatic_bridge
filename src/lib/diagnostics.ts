/**
 * src/lib/diagnostics.ts: COPY DIAGNOSTICS: the figures to paste back
 * when something looks wrong (R27).
 *
 * Layer: pure lib (tested). The app gathers the facts (app/diagnostics.ts);
 * this lays them out as plain text, one fact a line. It holds nothing
 * private: no title, no addresses, no settings beyond the scene's look.
 */

/** Everything the report says. */
export interface DiagnosticsFacts {
  version: string;
  build: number;
  /** When it was taken (ISO time). */
  at: string;
  userAgent: string;
  screen: string;
  window: string;
  dpr: number;
  scene: string;
  look: string;
  canvas: string;
  /** Frames a second and the p95 drawing time (ms), over the last seconds. */
  fps: number;
  drawP95: number;
  /** The signal's scalars, by name. */
  signal: Record<string, number>;
  capture: string;
  bridge: string;
}

/** The report as text. */
export function diagnosticsText(f: DiagnosticsFacts): string {
  const n = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  return [
    `cymatic_bridge ${f.version} (build ${f.build}) · ${f.at}`,
    `browser: ${f.userAgent}`,
    `screen ${f.screen} · window ${f.window} · dpr ${n(f.dpr)}`,
    `scene ${f.scene} · ${f.look}`,
    `canvas ${f.canvas} · ${n(f.fps, 0)} fps · draw p95 ${n(f.drawP95)} ms`,
    `signal: ${Object.entries(f.signal)
      .map(([k, v]) => `${k} ${n(v, 3)}`)
      .join(' · ')}`,
    `capture ${f.capture} · title bridge ${f.bridge}`,
  ].join('\n');
}
