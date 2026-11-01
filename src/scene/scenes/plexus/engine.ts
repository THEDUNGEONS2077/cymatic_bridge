/**
 * src/scene/scenes/plexus/engine.ts: PLEXUS, the first scene (S4): a flight
 * through a living plexus of glowing nodes and links, on SIGNAL.
 *
 * Layer: scene (worker; WebGL 2). The user's choices (R24, then the mock-up
 * rounds of 2026-11-01): nodes scattered, each listening to one band, its
 * colour showing which; bolder than cyberdeck's NEURAL NET; on each beat
 * signals race along links, nodes swell and the net flashes; seen as B2
 * FLIGHT: the camera flies forward through an endless field. After the
 * first build: "I want the neural net to shift and form new connections and
 * be way more reactive to the music". So, each frame:
 *   1. the nodes move (field.ts placeNodes): their wander, pushed out from
 *      the axis by their band's loudness and by the beat's shockwave;
 *   2. each candidate link eases toward how linked it should be now (its
 *      ends' distance against a reach that grows with their loudness), in
 *      over LINK_IN_S, out over LINK_OUT_S: the net rewires as it plays;
 *   3. the camera flies on SIGNAL's flow clock, plus a surge on each beat;
 *   4. on a beat, the loudest bass nodes in view swell and fire signals
 *      along live links, and every node in view gets a kick outward;
 *   5. drawing: links (instanced glowing lines) and then nodes and signals
 *      (instanced glowing discs), additively, into a buffer of the scene's
 *      own, then trail.frag lays that onto the scene's target with the
 *      warp-streak trail behind it (the brighter wins, never added: added,
 *      trails washed the picture out at high frame rates).
 * The per-frame upload is the live links (9 floats each) and the points
 * (5 floats each): a few tens of KB.
 */
import { BANDS, OFFSET, SCALAR } from '@/lib/signal/layout';

import { drawFullscreen, sceneGeometryProgram, sceneProgram } from '../../gl/program';
import { createTarget, deleteTarget, floatTargets, type Target } from '../../gl/targets';
import type { SceneEngine, SceneFactory, SceneFrame } from '../../types';
import cameraGlsl from './camera.glsl?raw';
import { ahead, buildField, DEPTH, distanceAt, type Field, fire, KICK, linkTarget, MAX_SIGNALS, placeNodes, seeded, type Signal, stepSignals, wrapStep } from './field';
import linkFrag from './link.frag?raw';
import linkVert from './link.vert?raw';
import nodeFrag from './node.frag?raw';
import nodeVert from './node.vert?raw';
import trailFrag from './trail.frag?raw';

/** World units the camera flies per second of flow (flow runs 0.25–2× real time with the loudness). */
export const FLIGHT_SPEED = 0.6;
/** A beat's surge: extra speed (world units/s) at a full-strength beat, fading over SURGE_S. */
const SURGE = 1.4;
const SURGE_S = 0.3;
/** Device px per world unit at depth 1, as a share of the canvas height (B2's look). */
const SCALE_OF_HEIGHT = 0.39;
/** How many of the loudest bass nodes in view fire on a beat, and how far their signals run. */
const FIRE_COUNT = 5;
const FIRE_HOPS = 4;
/** Nodes below this band position count as bass for firing. */
const BASS_BAND = 0.3;
/** How fast a swell and a kick fade (s). */
const SWELL_S = 0.25;
const KICK_S = 0.35;
/** How fast a link forms and dissolves (s). */
const LINK_IN_S = 0.12;
const LINK_OUT_S = 0.4;
/** Floats per live link (two ends' x, y, z, band, and its strength) and per point (x, y, z, band, swell). */
const LINK = 9;
const POINT = 5;

/** PLEXUS's factory. */
export const plexusScene: SceneFactory = {
  id: 'plexus',
  create(gl) {
    const linkProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${linkVert}`, linkFrag);
    const nodeProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${nodeVert}`, nodeFrag);
    const trailProgram = sceneProgram(gl, trailFrag);
    const float = floatTargets(gl);
    const linkBuffer = gl.createBuffer()!;
    const nodeBuffer = gl.createBuffer()!;
    const linkVao = gl.createVertexArray()!;
    const nodeVao = gl.createVertexArray()!;

    // The links' VAO: two vec4 (each end's x, y, z, band) and the strength, per instance.
    gl.bindVertexArray(linkVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
    for (const [loc, size, offset] of [
      [0, 4, 0],
      [1, 4, 16],
      [2, 1, 32],
    ] as const) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, LINK * 4, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    // The points' VAO: a vec4 (x, y, z, band) and the swell, per instance.
    gl.bindVertexArray(nodeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
    for (const [loc, size, offset] of [
      [0, 4, 0],
      [1, 1, 16],
    ] as const) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, POINT * 4, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);

    let field: Field | null = null;
    let aspect = 0;
    let pos = new Float32Array(0);
    let loud = new Float32Array(0);
    let kick = new Float32Array(0);
    let swell = new Float32Array(0);
    let strength = new Float32Array(0);
    let links = new Float32Array(0);
    let points = new Float32Array(0);
    const signals: Signal[] = [];
    const rand = seeded(7);
    const live = (pair: number) => strength[pair] ?? 0;
    let lastBeat = -1;
    let lastFlow = Number.NaN;
    let camZ = 0;
    let surge = 0;
    // The scene's own buffer for each frame's light (trail.frag lays it onto the target).
    let fresh: Target | null = null;
    // Each program's own uniforms, looked up once.
    const locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
    const loc = (p: WebGLProgram, name: string) => {
      let m = locs.get(p);
      if (!m) locs.set(p, (m = new Map()));
      if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
      return m.get(name)!;
    };

    /** Builds the field for the canvas's shape, and the buffers for it. */
    const build = (shape: number) => {
      aspect = shape;
      field = buildField(shape);
      pos = new Float32Array(field.count * 3);
      loud = new Float32Array(field.count);
      kick = new Float32Array(field.count);
      swell = new Float32Array(field.count);
      strength = new Float32Array(field.pairs.length / 2);
      links = new Float32Array((field.pairs.length / 2) * LINK);
      points = new Float32Array((field.count + MAX_SIGNALS) * POINT);
      signals.length = 0;
    };

    /** Each node's band loudness from the signal (both channels), with SENSITIVITY. */
    const hear = (f: SceneFrame) => {
      if (!field) return;
      for (let i = 0; i < field.count; i++) {
        const b = Math.round(field.band[i]! * (BANDS - 1));
        loud[i] = Math.min(1, 0.5 * (f.signal[OFFSET.bandsL + b]! + f.signal[OFFSET.bandsR + b]!) * f.sensitivity);
      }
    };

    /** A beat of `strength` (0..1): a surge, a shockwave out, and the loudest bass nodes in view swell and fire. */
    const onBeat = (f: SceneFrame, beat: number, scale: number) => {
      if (!field) return;
      surge = Math.max(surge, SURGE * beat);
      const halfX = (0.5 * f.w) / scale;
      const halfY = (0.5 * f.h) / scale;
      const candidates: [number, number][] = [];
      for (let i = 0; i < field.count; i++) {
        const z = ahead(pos[i * 3 + 2]!, camZ);
        if (z < 0.6 || z > DEPTH - 2) continue;
        // The shockwave: every node in sight is kicked out, bass ones hardest.
        kick[i] = Math.max(kick[i]!, KICK * beat * (field.band[i]! < BASS_BAND ? 1 : 0.5));
        if (field.band[i]! >= BASS_BAND) continue;
        if (Math.abs(pos[i * 3]!) / z > halfX || Math.abs(pos[i * 3 + 1]!) / z > halfY) continue;
        candidates.push([i, loud[i]! + 1 / z]);
      }
      candidates.sort((a, b) => b[1] - a[1]);
      for (const [i] of candidates.slice(0, FIRE_COUNT)) {
        swell[i] = 1;
        fire(field, signals, i, FIRE_HOPS, rand, live);
      }
    };

    /** Eases every candidate link toward how linked it should be, and writes the live ones; returns how many. */
    const fillLinks = (dt: number): number => {
      if (!field) return 0;
      const { pairs, band } = field;
      const inK = 1 - Math.exp(-dt / LINK_IN_S);
      const outK = 1 - Math.exp(-dt / LINK_OUT_S);
      let n = 0;
      for (let k = 0; k < strength.length; k++) {
        const a = pairs[k * 2]!;
        const b = pairs[k * 2 + 1]!;
        const want = linkTarget(distanceAt(pos, a, b), loud[a]!, loud[b]!);
        const s = strength[k]!;
        strength[k] = s + (want - s) * (want > s ? inK : outK);
        if (strength[k]! < 0.01) continue;
        // B's depth placed next to A's (the short way across the wrap), so a link never spans the box.
        const za = pos[a * 3 + 2]!;
        const o = n * LINK;
        links[o] = pos[a * 3]!;
        links[o + 1] = pos[a * 3 + 1]!;
        links[o + 2] = za;
        links[o + 3] = band[a]!;
        links[o + 4] = pos[b * 3]!;
        links[o + 5] = pos[b * 3 + 1]!;
        links[o + 6] = za + wrapStep(za, pos[b * 3 + 2]!);
        links[o + 7] = band[b]!;
        links[o + 8] = strength[k]!;
        n++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, links.subarray(0, n * LINK), gl.DYNAMIC_DRAW);
      return n;
    };

    /** Writes every node and signal where it is now; returns how many points. */
    const fillPoints = (): number => {
      if (!field) return 0;
      const { band, count } = field;
      for (let i = 0; i < count; i++) {
        const o = i * POINT;
        points[o] = pos[i * 3]!;
        points[o + 1] = pos[i * 3 + 1]!;
        points[o + 2] = pos[i * 3 + 2]!;
        points[o + 3] = band[i]!;
        points[o + 4] = swell[i]!;
      }
      let n = count;
      for (const s of signals) {
        const t = Math.min(1, s.t);
        const za = pos[s.from * 3 + 2]!;
        const o = n * POINT;
        points[o] = pos[s.from * 3]! + (pos[s.to * 3]! - pos[s.from * 3]!) * t;
        points[o + 1] = pos[s.from * 3 + 1]! + (pos[s.to * 3 + 1]! - pos[s.from * 3 + 1]!) * t;
        points[o + 2] = za + wrapStep(za, pos[s.to * 3 + 2]!) * t;
        points[o + 3] = band[s.from]!;
        points[o + 4] = 1.2;
        n++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points.subarray(0, n * POINT), gl.DYNAMIC_DRAW);
      return n;
    };

    const engine: SceneEngine = {
      draw(f) {
        // A new shape (a resize, fullscreen): a field for it, and a fresh buffer of its size.
        const shape = f.w / Math.max(1, f.h);
        if (!field || Math.abs(shape - aspect) / aspect > 0.01) build(shape);
        if (!fresh || fresh.w !== f.w || fresh.h !== f.h) {
          if (fresh) deleteTarget(gl, fresh);
          fresh = createTarget(gl, f.w, f.h, float);
        }
        const target = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        const sig = f.signal;
        const scale = f.h * SCALE_OF_HEIGHT * f.zoom;

        // The camera: the flow clock's step since last frame (it never goes back), plus the surge; wrapped here in double precision.
        const flow = sig[OFFSET.scalars + SCALAR.flow]!;
        const step = Number.isNaN(lastFlow) ? 0 : Math.max(0, Math.min(1, flow - lastFlow));
        lastFlow = flow;
        surge *= Math.exp(-f.dt / SURGE_S);
        camZ = (camZ + step * FLIGHT_SPEED + surge * f.dt) % DEPTH;

        // Hear, move, beat.
        hear(f);
        const fadeKick = Math.exp(-f.dt / KICK_S);
        const fadeSwell = Math.exp(-f.dt / SWELL_S);
        for (let i = 0; i < kick.length; i++) {
          kick[i]! *= fadeKick;
          swell[i]! *= fadeSwell;
        }
        if (field) placeNodes(field, f.time, loud, kick, pos);
        const beats = sig[OFFSET.scalars + SCALAR.beatCount]!;
        if (lastBeat >= 0 && beats > lastBeat) onBeat(f, Math.max(0.5, sig[OFFSET.scalars + SCALAR.beat]!), scale);
        lastBeat = beats;
        if (field) stepSignals(field, signals, f.dt, rand, live, (n) => (swell[n] = Math.max(swell[n]!, 0.8)));
        const linkCount = fillLinks(f.dt);
        const pointCount = fillPoints();

        // The frame's light, added, into the scene's own buffer.
        gl.bindFramebuffer(gl.FRAMEBUFFER, fresh.framebuffer);
        gl.viewport(0, 0, f.w, f.h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        for (const [program, vao, count] of [
          [linkProgram, linkVao, linkCount],
          [nodeProgram, nodeVao, pointCount],
        ] as const) {
          f.bind(program);
          gl.uniform1f(loc(program, 'uCamZ'), camZ);
          gl.uniform1f(loc(program, 'uDepth'), DEPTH);
          gl.uniform1f(loc(program, 'uScale'), scale);
          gl.bindVertexArray(vao);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
        }
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);

        // Onto the scene's target, with the trail behind it.
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, f.w, f.h);
        f.bind(trailProgram);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, fresh.texture);
        gl.uniform1i(loc(trailProgram, 'uFresh'), 2);
        drawFullscreen(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
      },
      destroy() {
        for (const p of [linkProgram, nodeProgram, trailProgram]) gl.deleteProgram(p);
        gl.deleteBuffer(linkBuffer);
        gl.deleteBuffer(nodeBuffer);
        gl.deleteVertexArray(linkVao);
        gl.deleteVertexArray(nodeVao);
        if (fresh) deleteTarget(gl, fresh);
      },
    };
    return engine;
  },
};
