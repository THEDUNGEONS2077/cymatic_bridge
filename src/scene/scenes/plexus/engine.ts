/**
 * src/scene/scenes/plexus/engine.ts: PLEXUS, the first scene (S4): a flight
 * through a plexus of glowing nodes and links, on SIGNAL.
 *
 * Layer: scene (worker; WebGL 2). The user's choices (R24, then the mock-up
 * rounds of 2026-11-01): nodes scattered, each listening to one band, its
 * colour showing which; bolder than cyberdeck's NEURAL NET; on each beat
 * signals race along links, nodes swell and the net flashes; seen as B2
 * FLIGHT: the camera flies forward through an endless field, faster when the
 * music is loud.
 *
 * Each frame:
 *   1. trail.frag: the last frame pushed outward and faded (TRAILS as warp
 *      streaks), or black;
 *   2. every link, one instanced draw: quads with cyberdeck's smooth glowing
 *      line, additive;
 *   3. every node and signal, one instanced draw: glowing discs, additive.
 * The camera's depth is SIGNAL's flow clock × FLIGHT_SPEED, wrapped here in
 * double precision (the clock grows for hours). Beats come from the signal's
 * beat count: on each new one the loudest bass nodes in view swell and fire
 * signals (field.ts). The node buffer (swell, signals) is the only data sent
 * per frame: 5 floats a point.
 */
import { BANDS, OFFSET, SCALAR } from '@/lib/signal/layout';

import { drawFullscreen, sceneGeometryProgram, sceneProgram } from '../../gl/program';
import type { SceneEngine, SceneFactory, SceneFrame } from '../../types';
import cameraGlsl from './camera.glsl?raw';
import { ahead, buildField, DEPTH, type Field, fire, MAX_SIGNALS, seeded, type Signal, stepSignals, wrapGap } from './field';
import linkFrag from './link.frag?raw';
import linkVert from './link.vert?raw';
import nodeFrag from './node.frag?raw';
import nodeVert from './node.vert?raw';
import trailFrag from './trail.frag?raw';

/** World units the camera flies per second of flow (flow runs 0.25–2× real time with the loudness). */
export const FLIGHT_SPEED = 0.6;
/** Device px per world unit at depth 1, as a share of the canvas height (B2's look). */
const SCALE_OF_HEIGHT = 0.39;
/** How many of the loudest bass nodes in view fire on a beat, and how far their signals run. */
const FIRE_COUNT = 3;
const FIRE_HOPS = 3;
/** Nodes below this band position count as bass for firing. */
const BASS_BAND = 0.3;
/** How fast a swell fades (s). */
const SWELL_S = 0.25;
/** Floats per point in the node buffer: x, y, z, band, swell. */
const POINT = 5;

/** PLEXUS's factory. */
export const plexusScene: SceneFactory = {
  id: 'plexus',
  create(gl) {
    const linkProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${linkVert}`, linkFrag);
    const nodeProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${nodeVert}`, nodeFrag);
    const trailProgram = sceneProgram(gl, trailFrag);
    const linkBuffer = gl.createBuffer()!;
    const nodeBuffer = gl.createBuffer()!;
    const linkVao = gl.createVertexArray()!;
    const nodeVao = gl.createVertexArray()!;

    // The links' VAO: two vec4 per instance (each end's x, y, z, band).
    gl.bindVertexArray(linkVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(1, 1);
    // The nodes' VAO: a vec4 (x, y, z, band) and the swell, per instance.
    gl.bindVertexArray(nodeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, POINT * 4, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, POINT * 4, 16);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    let field: Field | null = null;
    let aspect = 0;
    let swell = new Float32Array(0);
    let points = new Float32Array(0);
    const signals: Signal[] = [];
    const rand = seeded(7);
    let lastBeat = -1;
    // Each program's own uniforms (the camera), looked up once.
    const camLoc = new Map<WebGLProgram, { camZ: WebGLUniformLocation | null; depth: WebGLUniformLocation | null; scale: WebGLUniformLocation | null }>();
    const camOf = (p: WebGLProgram) => {
      let l = camLoc.get(p);
      if (!l) camLoc.set(p, (l = { camZ: gl.getUniformLocation(p, 'uCamZ'), depth: gl.getUniformLocation(p, 'uDepth'), scale: gl.getUniformLocation(p, 'uScale') }));
      return l;
    };

    /** Builds the field for the canvas's shape, and its static link buffer. */
    const build = (shape: number) => {
      aspect = shape;
      field = buildField(shape);
      swell = new Float32Array(field.count);
      points = new Float32Array((field.count + MAX_SIGNALS) * POINT);
      signals.length = 0;
      // Each link's ends; B's depth unwrapped to sit next to A's, so a link never spans the box.
      const data = new Float32Array((field.links.length / 2) * 8);
      for (let k = 0; k < field.links.length; k += 2) {
        const a = field.links[k]!;
        const b = field.links[k + 1]!;
        const o = (k / 2) * 8;
        const za = field.pos[a * 3 + 2]!;
        let zb = field.pos[b * 3 + 2]!;
        if (Math.abs(zb - za) > DEPTH / 2) zb += zb < za ? DEPTH : -DEPTH;
        data.set([field.pos[a * 3]!, field.pos[a * 3 + 1]!, za, field.band[a]!, field.pos[b * 3]!, field.pos[b * 3 + 1]!, zb, field.band[b]!], o);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    };

    /** A node's band loudness, from the signal (both channels). */
    const loudness = (f: SceneFrame, band: number) => {
      const i = Math.round(band * (BANDS - 1));
      return 0.5 * (f.signal[OFFSET.bandsL + i]! + f.signal[OFFSET.bandsR + i]!);
    };

    /** A beat: the loudest bass nodes in view, nearest first, swell and fire signals. */
    const onBeat = (f: SceneFrame, camZ: number, scale: number) => {
      if (!field) return;
      const halfX = (0.5 * f.w) / scale;
      const halfY = (0.5 * f.h) / scale;
      const candidates: [number, number][] = [];
      for (let i = 0; i < field.count; i++) {
        if (field.band[i]! >= BASS_BAND) continue;
        const z = ahead(field.pos[i * 3 + 2]!, camZ);
        // In view: not at the far end's fog, not about to pass, inside the screen.
        if (z < 0.8 || z > DEPTH - 2.5) continue;
        if (Math.abs(field.pos[i * 3]!) / z > halfX || Math.abs(field.pos[i * 3 + 1]!) / z > halfY) continue;
        candidates.push([i, loudness(f, field.band[i]!) + 1 / z]);
      }
      candidates.sort((a, b) => b[1] - a[1]);
      for (const [i] of candidates.slice(0, FIRE_COUNT)) {
        swell[i] = 1;
        fire(field, signals, i, FIRE_HOPS, rand);
      }
    };

    /** Writes every node and signal into the point buffer; returns how many points. */
    const fillPoints = (): number => {
      if (!field) return 0;
      const { pos, band, count } = field;
      for (let i = 0; i < count; i++) points.set([pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, band[i]!, swell[i]!], i * POINT);
      let n = count;
      for (const s of signals) {
        const za = pos[s.from * 3 + 2]!;
        const zb = pos[s.to * 3 + 2]!;
        // Across the wrap the short way, so a signal never jumps the box.
        const dz = Math.abs(zb - za) > DEPTH / 2 ? Math.sign(za - zb) * wrapGap(za, zb) : zb - za;
        const t = Math.min(1, s.t);
        points.set(
          [pos[s.from * 3]! + (pos[s.to * 3]! - pos[s.from * 3]!) * t, pos[s.from * 3 + 1]! + (pos[s.to * 3 + 1]! - pos[s.from * 3 + 1]!) * t, za + dz * t, band[s.from]!, 1.2],
          n * POINT,
        );
        n++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points.subarray(0, n * POINT), gl.DYNAMIC_DRAW);
      return n;
    };

    const engine: SceneEngine = {
      draw(f) {
        // A new shape (a resize, fullscreen): a field for it.
        const shape = f.w / Math.max(1, f.h);
        if (!field || Math.abs(shape - aspect) / aspect > 0.01) build(shape);
        const sig = f.signal;
        const flow = sig[OFFSET.scalars + SCALAR.flow]!;
        const camZ = ((flow * FLIGHT_SPEED) % DEPTH + DEPTH) % DEPTH;
        const scale = f.h * SCALE_OF_HEIGHT * f.zoom;

        // Beats: a new beat count fires.
        const beats = sig[OFFSET.scalars + SCALAR.beatCount]!;
        if (lastBeat >= 0 && beats > lastBeat) onBeat(f, camZ, scale);
        lastBeat = beats;
        const fade = Math.exp(-f.dt / SWELL_S);
        for (let i = 0; i < swell.length; i++) swell[i]! *= fade;
        if (field) stepSignals(field, signals, f.dt, rand, (n) => (swell[n] = Math.max(swell[n]!, 0.8)));
        const pointCount = fillPoints();

        // 1. The trail (or black).
        gl.disable(gl.BLEND);
        f.bind(trailProgram);
        drawFullscreen(gl);

        // 2–3. Links, then nodes and signals: light, added.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        for (const [program, vao, count] of [
          [linkProgram, linkVao, field ? field.links.length / 2 : 0],
          [nodeProgram, nodeVao, pointCount],
        ] as const) {
          f.bind(program);
          const l = camOf(program);
          gl.uniform1f(l.camZ, camZ);
          gl.uniform1f(l.depth, DEPTH);
          gl.uniform1f(l.scale, scale);
          gl.bindVertexArray(vao);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
        }
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      },
      destroy() {
        for (const p of [linkProgram, nodeProgram, trailProgram]) gl.deleteProgram(p);
        gl.deleteBuffer(linkBuffer);
        gl.deleteBuffer(nodeBuffer);
        gl.deleteVertexArray(linkVao);
        gl.deleteVertexArray(nodeVao);
      },
    };
    return engine;
  },
};
