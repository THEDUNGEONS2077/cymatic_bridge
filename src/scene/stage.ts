/**
 * src/scene/stage.ts: the stage: one WebGL 2 context on the page's canvas,
 * the scenes drawn on it, every frame.
 *
 * Layer: scene (worker; no DOM). The stage owns everything scenes share:
 *   - the SIGNAL texture (gl/signalTexture.ts), written once a frame from the
 *     latest frame the page posted (it never waits for one);
 *   - each live scene's target (gl/targets.ts): two for a scene with trails,
 *     swapped every frame, so it reads its last frame (uPrev) as it draws;
 *   - the crossfade (R15): for CROSSFADE_S after a scene change the old and
 *     new scenes both draw, and the composite pass mixes them; then the old
 *     one goes;
 *   - the composite pass: the scene's target onto the canvas, dithered;
 *   - a lost context: `webglcontextlost` (preventDefault, or it never comes
 *     back) stops drawing, and `webglcontextrestored` builds everything
 *     again, scenes included (cyberdeck's 1.0 lesson: not `contextlost`,
 *     which is the 2D canvas's event).
 * It draws every frame the screen shows (R16: no cap), and only while
 * started (the page stops it while hidden, R17).
 *
 * When to draw (0.1.1, the user: the visuals lagged the sound): each frame
 * is drawn the moment the page's SIGNAL frame arrives, not at the worker's
 * own next animation frame, which could come up to a frame later. The page
 * posts once per screen frame, so this is still once per frame. The worker's
 * own animation frames only draw when no signal has come for DRIVEN_MS
 * (before the page's loop starts, and for the tests' probes).
 */
import { rgb01 } from '@/lib/palettes';
import { OFFSET, SCALAR, type Signal, emptySignal } from '@/lib/signal/layout';
import { GLOW_LEVELS } from '@/lib/scenes';

import { drawFullscreen, plainProgram } from './gl/program';
import { createSignalTexture, type SignalTexture } from './gl/signalTexture';
import { blackTexture, createTarget, deleteTarget, floatTargets, type Target } from './gl/targets';
import { findFactory } from './registry';
import compositeFrag from './shaders/composite.frag?raw';
import type { PixelsProbe, SceneEngine, SceneFrame, SceneLook, StageSize } from './types';

/** How long after the last SIGNAL frame the worker's own animation frames take over drawing (ms). */
const DRIVEN_MS = 100;
/** How long a scene change crossfades (s). */
export const CROSSFADE_S = 0.6;
/** GLOW's levels as the shader's uGlow (LOW … MAX). */
const GLOW_VALUE: Record<string, number> = { low: 0.25, medium: 0.5, high: 0.75, max: 1 };

/** A scene on the stage: its engine, its look and its targets. */
interface Live {
  id: string;
  engine: SceneEngine;
  look: SceneLook;
  trails: boolean;
  /** One target, or two swapped each frame (trails). */
  targets: Target[];
  /** Which target it draws into this frame. */
  turn: number;
}

/** The stage's controls (the worker calls these from its messages). */
export interface Stage {
  resize(size: StageSize): void;
  setSignal(s: Signal): void;
  /** Shows scene `id` (crossfading from the one showing), or updates its look if it's already showing. */
  setScene(id: string, look: SceneLook, trails: boolean): void;
  /** The showing scene's look changed (its settings). */
  setLook(look: SceneLook): void;
  start(): void;
  stop(): void;
  /** Reads the next frame's pixels (tests). */
  pixels(): Promise<PixelsProbe>;
  /** Is it drawing? */
  readonly running: boolean;
  /** Loses the context on purpose (the browser tests' lost-context path). */
  lose(): void;
  destroy(): void;
}

/** What the stage reports back. */
export interface StageEvents {
  /** The first frame is on the canvas. */
  ready(): void;
  /** A shader failed (the message is the driver's log). */
  error(message: string): void;
  /** Called with each frame's drawing time (ms), for the worker's ring. */
  frame(start: number, took: number): void;
  requestFrame(cb: (t: number) => void): number;
  cancelFrame(id: number): void;
}

/** Sets up the stage on `canvas` at `size`, showing scene `scene`. */
export function createStage(canvas: OffscreenCanvas, size: StageSize, scene: string, look: SceneLook, trails: boolean, ev: StageEvents): Stage {
  const gl = canvas.getContext('webgl2', {
    // No multisampling (cyberdeck 0.17.5: it made HORIZON laggy); lines are smoothed in the shaders.
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('WebGL 2 is not available');

  let signal: Signal = emptySignal();
  let px = { w: 1, h: 1, dpr: 1 };
  let tex: SignalTexture;
  let black: WebGLTexture;
  let composite: WebGLProgram;
  let float = false;
  let active: Live | null = null;
  let outgoing: (Live & { since: number }) | null = null;
  let wanted = { id: scene, look, trails };
  let lost = false;
  let started = false;
  let frameId = 0;
  let lastT = 0;
  let readyOnce = false;
  // When the last SIGNAL frame arrived (ms): while recent, signals drive the drawing.
  let lastSignal = -Infinity;
  // Probes waiting for the next frame's pixels.
  const pixelWaiters: ((p: PixelsProbe) => void)[] = [];
  // Each program's uniform locations, looked up once.
  const locations = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  /** The location of uniform `name` in `program` (cached). */
  const loc = (program: WebGLProgram, name: string) => {
    let m = locations.get(program);
    if (!m) locations.set(program, (m = new Map()));
    if (!m.has(name)) m.set(name, gl.getUniformLocation(program, name));
    return m.get(name)!;
  };

  /** A new live scene on the current size. */
  const makeLive = (id: string, l: SceneLook, withTrails: boolean): Live => ({
    id,
    engine: findFactory(id).create(gl),
    look: l,
    trails: withTrails,
    targets: Array.from({ length: withTrails ? 2 : 1 }, () => createTarget(gl, px.w, px.h, float)),
    turn: 0,
  });
  const dropLive = (live: Live) => {
    live.engine.destroy();
    for (const t of live.targets) deleteTarget(gl, t);
  };

  /** Builds everything on the context (at start, and again after a lost context). */
  const build = () => {
    float = floatTargets(gl);
    tex = createSignalTexture(gl);
    black = blackTexture(gl);
    composite = plainProgram(gl, compositeFrag);
    active = makeLive(wanted.id, wanted.look, wanted.trails);
    outgoing = null;
  };

  /** Sets the uniforms signal.glsl declares, for `live`'s draw. */
  const bindFor = (live: Live, prev: WebGLTexture, dt: number) => (program: WebGLProgram) => {
    gl.useProgram(program);
    const s = signal;
    const at = (k: keyof typeof SCALAR) => s[OFFSET.scalars + SCALAR[k]]!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex.texture);
    gl.uniform1i(loc(program, 'uSignal'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prev);
    gl.uniform1i(loc(program, 'uPrev'), 1);
    gl.uniform1f(loc(program, 'uHead'), tex.head);
    gl.uniform4f(loc(program, 'uGroups'), at('bass'), at('lowMid'), at('highMid'), at('treble'));
    gl.uniform1f(loc(program, 'uLevel'), at('level'));
    gl.uniform1f(loc(program, 'uBeat'), at('beat'));
    gl.uniform1f(loc(program, 'uBeatCount'), at('beatCount'));
    gl.uniform1f(loc(program, 'uAccent'), at('accent'));
    gl.uniform1f(loc(program, 'uFlow'), at('flow'));
    gl.uniform1f(loc(program, 'uBalance'), at('balance'));
    gl.uniform1f(loc(program, 'uIdle'), at('idle'));
    gl.uniform1f(loc(program, 'uTime'), lastT / 1000);
    gl.uniform1f(loc(program, 'uDt'), dt);
    gl.uniform2f(loc(program, 'uRes'), px.w, px.h);
    gl.uniform1f(loc(program, 'uDpr'), px.dpr);
    const l = live.look;
    gl.uniform1f(loc(program, 'uZoom'), l.zoom);
    gl.uniform1f(loc(program, 'uGlow'), GLOW_VALUE[l.glow] ?? GLOW_VALUE[GLOW_LEVELS[2]]!);
    gl.uniform1f(loc(program, 'uSensitivity'), l.sensitivity);
    gl.uniform1f(loc(program, 'uTrails'), live.trails ? l.trails : 0);
    const c = l.colors;
    gl.uniform3fv(loc(program, 'uColBg'), rgb01(c.bg));
    gl.uniform3fv(loc(program, 'uColLine'), rgb01(c.line));
    gl.uniform3fv(loc(program, 'uColDim'), rgb01(c.textDim));
    gl.uniform3fv(loc(program, 'uColText'), rgb01(c.text));
    gl.uniform3fv(loc(program, 'uColAccent'), rgb01(c.accent));
    gl.uniform3fv(loc(program, 'uColBright'), rgb01(c.textBright));
    gl.uniform3fv(loc(program, 'uColCool'), rgb01(c.cool));
  };

  /** Draws `live` into its target for this frame; returns the texture it drew. */
  const drawLive = (live: Live, time: number, dt: number): WebGLTexture => {
    const target = live.targets[live.turn]!;
    const prev = live.targets.length > 1 ? live.targets[1 - live.turn]!.texture : black;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.w, target.h);
    const frame: SceneFrame = { gl, signal, w: target.w, h: target.h, dpr: px.dpr, zoom: live.look.zoom, time, dt, bind: bindFor(live, prev, dt) };
    live.engine.draw(frame);
    // Unbind uPrev before the targets swap: a texture can't be read while it's being drawn into.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (live.targets.length > 1) live.turn = 1 - live.turn;
    return target.texture;
  };

  /** The worker's own animation frame: draws only when no signal is driving, and keeps itself going. */
  const tick = (t: number) => {
    frameId = 0;
    if (!started || lost) return;
    if (performance.now() - lastSignal > DRIVEN_MS || pixelWaiters.length) frame(t);
    frameId = ev.requestFrame(tick);
  };

  /** One frame: the signal up, each live scene into its target, then the composite onto the canvas. */
  const frame = (t: number) => {
    if (!started || lost || !active) return;
    const start = performance.now();
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.1) : 1 / 60;
    lastT = t;
    try {
      tex.upload(signal, dt);
      const a = drawLive(active, t / 1000, dt);
      let b = a;
      let mixT = 1;
      if (outgoing) {
        b = drawLive(outgoing, t / 1000, dt);
        outgoing.since += dt;
        const k = Math.min(1, outgoing.since / CROSSFADE_S);
        mixT = k * k * (3 - 2 * k);
        if (k >= 1) {
          dropLive(outgoing);
          outgoing = null;
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(composite);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, a);
      gl.uniform1i(loc(composite, 'uA'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, b);
      gl.uniform1i(loc(composite, 'uB'), 1);
      gl.uniform1f(loc(composite, 'uMix'), mixT);
      drawFullscreen(gl);
      if (pixelWaiters.length) answerPixels();
    } catch (e) {
      ev.error(e instanceof Error ? e.message : String(e));
      started = false;
      return;
    }
    ev.frame(start, performance.now() - start);
    if (!readyOnce) {
      readyOnce = true;
      ev.ready();
    }
  };

  /** Reads the canvas as just drawn (before it's shown, so preserveDrawingBuffer isn't needed) and answers the probes. */
  const answerPixels = () => {
    const w = canvas.width;
    const h = canvas.height;
    const data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let lit = 0;
    let sum = 0;
    let sig = 0;
    const step = Math.max(1, Math.floor((w * h) / 20000));
    let n = 0;
    for (let i = 0; i < w * h; i += step) {
      const v = Math.max(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
      if (v > 12) lit++;
      sum += v;
      // A coarse fingerprint: brightness in 16 steps, hashed in order.
      sig = (Math.imul(sig, 31) + (v >> 4)) | 0;
      n++;
    }
    const result: PixelsProbe = { lit: lit / n, mean: sum / n, sig, w, h };
    for (const resolve of pixelWaiters.splice(0)) resolve(result);
  };

  /** Resizes the canvas and every target. */
  const applySize = (size: StageSize) => {
    px = { w: Math.max(1, Math.round(size.w * size.dpr)), h: Math.max(1, Math.round(size.h * size.dpr)), dpr: size.dpr };
    canvas.width = px.w;
    canvas.height = px.h;
    if (lost) return;
    for (const live of [active, outgoing]) {
      if (!live) continue;
      for (const t of live.targets) deleteTarget(gl, t);
      live.targets = live.targets.map(() => createTarget(gl, px.w, px.h, float));
    }
  };

  const schedule = () => {
    if (started && !lost && !frameId) frameId = ev.requestFrame(tick);
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    // Without preventDefault the context never comes back.
    e.preventDefault();
    lost = true;
    if (frameId) ev.cancelFrame(frameId);
    frameId = 0;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    // Everything on the old context is gone: build it all again, at the current size.
    try {
      build();
      applySize({ w: px.w / px.dpr, h: px.h / px.dpr, dpr: px.dpr });
      schedule();
    } catch (e) {
      ev.error(e instanceof Error ? e.message : String(e));
    }
  });

  applySize(size);
  build();

  // The lost-context test keeps the extension from before the loss (getExtension returns null on a lost context).
  const loseExt = gl.getExtension('WEBGL_lose_context');

  return {
    get running() {
      return started && !lost;
    },
    resize(s) {
      applySize(s);
    },
    setSignal(s) {
      signal = s;
      lastSignal = performance.now();
      // Drawn at once: the frame goes out with this task, not at the next animation frame.
      frame(lastSignal);
    },
    setScene(id, l, withTrails) {
      wanted = { id, look: l, trails: withTrails };
      if (lost) return;
      if (active?.id === id && active.trails === withTrails) {
        active.look = l;
        return;
      }
      // Crossfade from the scene showing; one still fading out is dropped.
      if (outgoing) dropLive(outgoing);
      outgoing = active ? { ...active, since: 0 } : null;
      active = makeLive(id, l, withTrails);
    },
    setLook(l) {
      wanted = { ...wanted, look: l };
      if (active) active.look = l;
    },
    start() {
      started = true;
      lastT = 0;
      schedule();
    },
    stop() {
      started = false;
      if (frameId) ev.cancelFrame(frameId);
      frameId = 0;
    },
    pixels() {
      return new Promise((resolve) => {
        pixelWaiters.push(resolve);
        schedule();
      });
    },
    lose() {
      if (!loseExt) return;
      loseExt.loseContext();
      // Restore a moment later, as a driver reset would.
      setTimeout(() => loseExt.restoreContext(), 300);
    },
    destroy() {
      started = false;
      if (frameId) ev.cancelFrame(frameId);
      if (active) dropLive(active);
      if (outgoing) dropLive(outgoing);
      tex.destroy();
    },
  };
}
