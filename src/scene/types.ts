/**
 * src/scene/types.ts: the contract every scene follows, and the messages
 * between the page and the scene worker.
 *
 * Layer: scene (no DOM, no stores). A scene is a factory that, given the
 * stage's WebGL 2 context, makes an engine that draws one frame into
 * whatever target is bound. Scenes don't own a canvas, a clock or the
 * music: the stage (stage.ts) gives each draw the SIGNAL texture, the
 * scalars, the scene's settings and its last frame (for trails) through
 * `bind`, which sets every uniform signal.glsl declares. Adding a scene = a
 * folder under scenes/ with a factory, an entry in registry.ts, and its card
 * in lib/scenes.ts.
 */
import type { PaletteColors } from '@/lib/palettes';
import type { GlowLevel } from '@/lib/scenes';
import type { Signal } from '@/lib/signal/layout';

/** A scene's look, as the page sends it: its settings with the palette's colours resolved. */
export interface SceneLook {
  colors: PaletteColors;
  glow: GlowLevel;
  sensitivity: number;
  trails: number;
  zoom: number;
}

/** What a scene's draw gets. */
export interface SceneFrame {
  gl: WebGL2RenderingContext;
  /** The latest SIGNAL frame (the scalars are also uniforms through `bind`). */
  signal: Signal;
  /** The target's size (device px) and the device px per CSS px. */
  w: number;
  h: number;
  dpr: number;
  /** The scene's ZOOM, SENSITIVITY and TRAILS (also uZoom, uSensitivity, uTrails; trails 0 when off), for scenes that work on the CPU side. */
  zoom: number;
  sensitivity: number;
  trails: number;
  /** Real time (s) and this frame's step (s). */
  time: number;
  dt: number;
  /** Uses `program` and sets every uniform signal.glsl declares (signal, settings, palette, the last frame). */
  bind(program: WebGLProgram): void;
}

/** A running scene. */
export interface SceneEngine {
  /** Draws one frame into the bound target (the viewport is set). */
  draw(frame: SceneFrame): void;
  /** Releases its programs and buffers. */
  destroy(): void;
}

/** A scene's factory. */
export interface SceneFactory {
  id: string;
  /**
   * Can it draw straight onto the canvas (it reads no last frame from the
   * stage, and dithers its own light)? Then, outside a crossfade, the stage
   * skips its target and composite pass for it (0.4.2: a full-screen pass
   * less a frame).
   */
  direct?: boolean;
  /** Makes its engine on `gl` (again after a lost context: the stage throws the old one away). */
  create(gl: WebGL2RenderingContext): SceneEngine;
}

/** A canvas size: CSS px and device px per CSS px. */
export interface StageSize {
  w: number;
  h: number;
  dpr: number;
}

/** What the page sends the worker. */
export type ToWorker =
  | { type: 'init'; canvas: OffscreenCanvas; size: StageSize; scene: string; look: SceneLook; trails: boolean }
  | { type: 'resize'; size: StageSize }
  | { type: 'signal'; signal: Signal }
  | { type: 'scene'; scene: string; look: SceneLook; trails: boolean }
  | { type: 'look'; look: SceneLook }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'probe'; id: number; what: 'pixels' }
  | { type: 'probe'; id: number; what: 'stats'; ms: number }
  | { type: 'lose' }
  | { type: 'destroy' };

/** What the worker sends back. */
export type FromWorker =
  | { type: 'ready' }
  /** A SIGNAL frame was handled (drawn, or dropped while stopped): the page may post the next (host.ts flow control). */
  | { type: 'drawn' }
  | { type: 'error'; message: string }
  | { type: 'probe'; id: number; result: PixelsProbe | StatsProbe };

/** How much of the canvas is lit, its mean brightness, and a fingerprint of it (tests). */
export interface PixelsProbe {
  /** The share of pixels brighter than a dim floor (0..1). */
  lit: number;
  /** The mean brightness (0..255). */
  mean: number;
  /** A hash of a coarse grid of the picture: changes when the picture does. */
  sig: number;
  w: number;
  h: number;
}

/** The frames of the last while, from the worker's ring: gaps between them and each one's drawing time (ms). */
export interface StatsProbe {
  gaps: number[];
  durations: number[];
  w: number;
  h: number;
  /** Is the stage drawing (started, context not lost)? */
  running: boolean;
}
