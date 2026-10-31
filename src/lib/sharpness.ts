/**
 * src/lib/sharpness.ts: how many canvas pixels a scene draws per CSS px,
 * and the guard that keeps that from costing smoothness.
 *
 * Layer: pure lib (the scene host uses it). cyberdeck_terminal's (0.14.0),
 * unchanged but for the words: each scene has a safe cap (SAFE_DPR). On a
 * screen with more pixels than that (200% scaling and up) it draws at the
 * screen's own ratio, up to SHARP_DPR. A guard watches its first seconds
 * on screen: if drawing a frame takes too long (p95 over GUARD_BUDGET_MS,
 * half a 60 Hz frame), it steps back to the safe cap and remembers that,
 * per scene. It never goes below the safe cap.
 */

/** The most canvas pixels per CSS px any scene draws (a 300% screen). */
export const SHARP_DPR = 3;
/** Every scene's safe cap (cyberdeck's usual): what the guard steps back to. */
export const SAFE_DPR = 2;
/** The longest a frame's drawing may take, p95, at full sharpness (ms): half a 60 Hz frame. */
export const GUARD_BUDGET_MS = 8;
/** How long the guard waits after the first full frame before it watches (ms): fonts and sheets settle. */
export const GUARD_SETTLE_MS = 1000;
/** How long it watches (ms). */
export const GUARD_WATCH_MS = 3000;
/** Fewer frames than this in the watch (a hidden tab, a still frame) and it can't say: it tries again next time. */
export const GUARD_MIN_FRAMES = 30;

/** A scene's sharpness, once the guard has watched it: full (the screen's own ratio) or safe (stepped back). */
export type Sharpness = 'full' | 'safe';

/** The pixel ratio a scene draws at: the screen's, capped at full sharpness, or at its safe cap once stepped back. */
export function drawnDpr(dpr: number, safeDpr: number, state: Sharpness | undefined): number {
  const screen = Number.isFinite(dpr) && dpr > 0 ? Math.max(1, dpr) : 1;
  return Math.min(screen, state === 'safe' ? safeDpr : SHARP_DPR);
}

/** Does the guard need to watch: would full sharpness draw more pixels than the safe cap? */
export function wantsGuard(dpr: number, safeDpr: number): boolean {
  return drawnDpr(dpr, safeDpr, 'full') > safeDpr + 1e-6;
}

/** The `p`th percentile (0–1) of `values` (nearest rank); NaN when there are none. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

/** The guard's verdict on the frames' drawing times (ms): full or safe, or null when there were too few frames to tell. */
export function guardVerdict(durations: readonly number[], budget = GUARD_BUDGET_MS): Sharpness | null {
  if (durations.length < GUARD_MIN_FRAMES) return null;
  return percentile(durations, 0.95) > budget ? 'safe' : 'full';
}

/** The stored verdicts (a start-up hint), checked: scene id → full or safe. */
export function normalizeSharpness(v: unknown): Record<string, Sharpness> {
  const out: Record<string, Sharpness> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, s] of Object.entries(v as Record<string, unknown>)) {
    if (id && id.length <= 64 && (s === 'full' || s === 'safe')) out[id] = s;
  }
  return out;
}

/** A run of frames summed up: frames a second, the median and p95 gap between them (ms), and drawing time per second (ms). */
export interface FrameSummary {
  fps: number;
  medianGap: number;
  p95Gap: number;
  drawPerSecond: number;
  /** The p95 of a frame's drawing (ms). */
  p95Draw: number;
}

/** Sums up frames from their gaps and drawing times (ms); NaNs when there were none. */
export function summarizeFrames(gaps: readonly number[], durations: readonly number[]): FrameSummary {
  const span = gaps.reduce((a, b) => a + b, 0);
  const drawn = durations.reduce((a, b) => a + b, 0);
  return {
    fps: span > 0 ? (gaps.length * 1000) / span : Number.NaN,
    medianGap: percentile(gaps, 0.5),
    p95Gap: percentile(gaps, 0.95),
    drawPerSecond: span > 0 ? (drawn * 1000) / span : Number.NaN,
    p95Draw: percentile(durations, 0.95),
  };
}
