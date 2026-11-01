/**
 * src/scene/scenes/plexus/engine.ts: PLEXUS, the first scene (S4): a pulse
 * travelling forward through a neural net that grows and shrinks with the
 * music, the camera following it.
 *
 * Layer: scene (worker; WebGL 2). Third design, from the user's answers of
 * 2026-11-01 (the second build was "too chaotic / busy"): keep the view
 * (looking forward down the net, as B2 FLIGHT); "a central pulse that
 * travels from node to node, branching off into small pulses but the main
 * one stays in focus"; the net "grows and shrinks" and the "pulse leaves a
 * mark". Each frame:
 *   1. presence: the music's loudness (eased over DENSITY_S, so the net
 *      changes calmly) sets how much of the net is there (field.ts density);
 *      each node fades toward it, in over PRESENCE_IN_S, out over
 *      PRESENCE_OUT_S;
 *   2. the main pulse runs along its link at a speed set by the loudness
 *      (MAIN_SPEED), marking it; at each node it picks the next one ahead,
 *      near the centre (field.ts nextForward), and the node swells;
 *   3. the camera sits FOLLOW behind the pulse and eases sideways after it,
 *      so it stays in focus at the centre;
 *   4. on a beat, branches split off the main pulse along other links,
 *      more for a stronger beat, each running a few links and marking them;
 *   5. marks fade (MARK_S): the paths glow, then go;
 *   6. drawing: links, then nodes, branches and the main pulse, additively,
 *      into the scene's own buffer (fresh); trail.frag adds that to the
 *      trail history (two buffers of the scene's own, swapped each frame:
 *      warp streaks, kept at full strength); compose.frag lays the fresh
 *      light onto the scene's target with the history behind it, dimmed
 *      ("The trails are still too intense when activated").
 * The net itself holds still: no wander, no rewiring.
 */
import { OFFSET, SCALAR } from '@/lib/signal/layout';

import { drawFullscreen, sceneGeometryProgram, sceneProgram } from '../../gl/program';
import { createTarget, deleteTarget, floatTargets, type Target } from '../../gl/targets';
import type { SceneEngine, SceneFactory, SceneFrame } from '../../types';
import cameraGlsl from './camera.glsl?raw';
import { branch, buildField, density, DEPTH, distance, type Field, MAX_BRANCHES, nextForward, pairOf, presenceTarget, type Pulse, seeded, stepBranches, wrapStep } from './field';
import linkFrag from './link.frag?raw';
import linkVert from './link.vert?raw';
import nodeFrag from './node.frag?raw';
import composeFrag from './compose.frag?raw';
import nodeVert from './node.vert?raw';
import trailFrag from './trail.frag?raw';

/** The main pulse's speed (world units a second): this when silent, up to this much more at full loudness. */
const MAIN_SPEED_QUIET = 0.45;
const MAIN_SPEED_LOUD = 1.9;
/** How far behind the main pulse the camera sits (world units), and how fast it eases sideways after it (s). */
const FOLLOW = 1.7;
const FOLLOW_S = 0.6;
/** Branches on a beat: this many, plus up to this many more for a full-strength beat; how far they run; how fast. */
const BRANCHES = 2;
const BRANCHES_STRONG = 3;
const BRANCH_HOPS_MIN = 2;
const BRANCH_HOPS_MAX = 5;
const BRANCH_SPEED = 3.2;
/** How strongly a pulse marks its link (the main pulse fully, branches less), and how fast a mark fades (s). */
const MAIN_MARK = 1;
const BRANCH_MARK = 0.55;
const MARK_S = 3.5;
/** How calmly the net grows and shrinks: the loudness eased over DENSITY_S; nodes fading in and out. */
const DENSITY_S = 1.2;
const PRESENCE_IN_S = 0.5;
const PRESENCE_OUT_S = 1.4;
/** How fast a node's swell fades (s). */
const SWELL_S = 0.35;
/** Device px per world unit at depth 1, as a share of the canvas height. */
const SCALE_OF_HEIGHT = 0.39;
/** Floats per link (two ends' x, y, z, band; presence; mark) and per point (x, y, z, band; swell; presence). */
const LINK = 10;
const POINT = 6;

/** PLEXUS's factory. */
export const plexusScene: SceneFactory = {
  id: 'plexus',
  create(gl) {
    const linkProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${linkVert}`, linkFrag);
    const nodeProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${nodeVert}`, nodeFrag);
    const trailProgram = sceneProgram(gl, trailFrag);
    const composeProgram = sceneProgram(gl, composeFrag);
    const float = floatTargets(gl);
    const linkBuffer = gl.createBuffer()!;
    const nodeBuffer = gl.createBuffer()!;
    const linkVao = gl.createVertexArray()!;
    const nodeVao = gl.createVertexArray()!;

    /** Sets up a VAO's per-instance attributes: [location, size, offset in floats]. */
    const instanced = (vao: WebGLVertexArrayObject, buffer: WebGLBuffer, stride: number, attrs: [number, number, number][]) => {
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (const [loc, size, offset] of attrs) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.bindVertexArray(null);
    };
    instanced(linkVao, linkBuffer, LINK, [
      [0, 4, 0],
      [1, 4, 4],
      [2, 2, 8],
    ]);
    instanced(nodeVao, nodeBuffer, POINT, [
      [0, 4, 0],
      [1, 2, 4],
    ]);

    let field: Field | null = null;
    let aspect = 0;
    let presence = new Float32Array(0);
    let swell = new Float32Array(0);
    let mark = new Float32Array(0);
    let links = new Float32Array(0);
    let points = new Float32Array(0);
    const branches: Pulse[] = [];
    const rand = seeded(7);
    const present = (n: number) => presence[n] ?? 0;
    let main: Pulse = { from: 0, to: 0, t: 1, hops: 0, pair: -1 };
    let mainLength = 1;
    let loudness = 0;
    let lastBeat = -1;
    let camXY: [number, number] = [0, 0];
    let fresh: Target | null = null;
    // The trail history: two buffers, swapped each frame (one read, one written).
    let trails: Target[] = [];
    let trailTurn = 0;
    const locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
    const loc = (p: WebGLProgram, name: string) => {
      let m = locs.get(p);
      if (!m) locs.set(p, (m = new Map()));
      if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
      return m.get(name)!;
    };

    /** Builds the field for the canvas's shape; the main pulse starts at the present node nearest the axis. */
    const build = (shape: number) => {
      aspect = shape;
      const f = (field = buildField(shape));
      presence = Float32Array.from({ length: f.count }, (_, i) => presenceTarget(f, i, density(0)));
      swell = new Float32Array(f.count);
      mark = new Float32Array(f.pairs.length / 2);
      links = new Float32Array((f.pairs.length / 2) * LINK);
      points = new Float32Array((f.count + MAX_BRANCHES + 1) * POINT);
      branches.length = 0;
      let start = 0;
      for (let i = 0; i < f.count; i++) {
        if (presence[i]! > 0.5 && Math.hypot(f.pos[i * 3]!, f.pos[i * 3 + 1]!) < Math.hypot(f.pos[start * 3]!, f.pos[start * 3 + 1]!)) start = i;
      }
      main = { from: start, to: start, t: 1, hops: 0, pair: -1 };
      mainLength = 1;
      camXY = [f.pos[start * 3]!, f.pos[start * 3 + 1]!];
    };

    /** Where the main pulse is now (x, y, z; z not wrapped, so the camera never jumps). */
    const mainAt = (): [number, number, number] => {
      const p = field!.pos;
      const t = Math.min(1, main.t);
      const za = p[main.from * 3 + 2]!;
      return [p[main.from * 3]! + (p[main.to * 3]! - p[main.from * 3]!) * t, p[main.from * 3 + 1]! + (p[main.to * 3 + 1]! - p[main.from * 3 + 1]!) * t, za + wrapStep(za, p[main.to * 3 + 2]!) * t];
    };

    /** Moves the main pulse on by `dt` s; at each node, swells it and picks the next. */
    const stepMain = (dt: number) => {
      const f = field!;
      main.t += (dt * (MAIN_SPEED_QUIET + MAIN_SPEED_LOUD * loudness)) / mainLength;
      if (main.pair >= 0) mark[main.pair] = Math.max(mark[main.pair]!, MAIN_MARK);
      while (main.t >= 1) {
        const at = main.to;
        swell[at] = Math.max(swell[at]!, 0.9);
        const next = nextForward(f, at, present, rand);
        main = { from: at, to: next, t: main.t - 1, hops: 0, pair: pairOf(f, at, next) };
        mainLength = Math.max(0.05, distance(f, at, next));
        if (next === at) {
          main.t = 0;
          break;
        }
      }
    };

    /** A beat of `strength` (0.5..1): branches split off the main pulse, more for a stronger beat. */
    const onBeat = (strength: number) => {
      const count = BRANCHES + Math.round(BRANCHES_STRONG * (strength - 0.5) * 2);
      const hops = BRANCH_HOPS_MIN + Math.floor(rand() * (BRANCH_HOPS_MAX - BRANCH_HOPS_MIN + 1));
      branch(field!, branches, main.from, count, hops, main.to, present, rand);
    };

    /** Writes every present link; returns how many. */
    const fillLinks = (): number => {
      const { pairs, pos, band } = field!;
      let n = 0;
      for (let k = 0; k < mark.length; k++) {
        const a = pairs[k * 2]!;
        const b = pairs[k * 2 + 1]!;
        const s = Math.min(presence[a]!, presence[b]!);
        if (s < 0.01 && mark[k]! < 0.01) continue;
        const za = pos[a * 3 + 2]!;
        const o = n * LINK;
        links[o] = pos[a * 3]!;
        links[o + 1] = pos[a * 3 + 1]!;
        links[o + 2] = za;
        links[o + 3] = band[a]!;
        links[o + 4] = pos[b * 3]!;
        links[o + 5] = pos[b * 3 + 1]!;
        // B's depth next to A's (the short way across the wrap), so a link never spans the box.
        links[o + 6] = za + wrapStep(za, pos[b * 3 + 2]!);
        links[o + 7] = band[b]!;
        links[o + 8] = s;
        links[o + 9] = mark[k]!;
        n++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, links.subarray(0, n * LINK), gl.DYNAMIC_DRAW);
      return n;
    };

    /** Writes the nodes, the branches and the main pulse; returns how many points. */
    const fillPoints = (): number => {
      const { pos, band, count } = field!;
      let n = 0;
      const put = (x: number, y: number, z: number, b: number, s: number, p: number) => {
        const o = n++ * POINT;
        points[o] = x;
        points[o + 1] = y;
        points[o + 2] = z;
        points[o + 3] = b;
        points[o + 4] = s;
        points[o + 5] = p;
      };
      for (let i = 0; i < count; i++) if (presence[i]! > 0.01) put(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, band[i]!, swell[i]!, presence[i]!);
      for (const b of branches) {
        const t = Math.min(1, b.t);
        const za = pos[b.from * 3 + 2]!;
        put(pos[b.from * 3]! + (pos[b.to * 3]! - pos[b.from * 3]!) * t, pos[b.from * 3 + 1]! + (pos[b.to * 3 + 1]! - pos[b.from * 3 + 1]!) * t, za + wrapStep(za, pos[b.to * 3 + 2]!) * t, band[b.from]!, 1, 1);
      }
      const [x, y, z] = mainAt();
      put(x, y, z, -1, 1, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points.subarray(0, n * POINT), gl.DYNAMIC_DRAW);
      return n;
    };

    /** The music's loudness with SENSITIVITY, from the signal's level. */
    const levelOf = (f: SceneFrame) => Math.min(1, f.signal[OFFSET.scalars + SCALAR.level]! * f.sensitivity);

    const engine: SceneEngine = {
      draw(f) {
        const shape = f.w / Math.max(1, f.h);
        if (!field || Math.abs(shape - aspect) / aspect > 0.01) build(shape);
        if (!fresh || fresh.w !== f.w || fresh.h !== f.h) {
          if (fresh) deleteTarget(gl, fresh);
          for (const t of trails) deleteTarget(gl, t);
          fresh = createTarget(gl, f.w, f.h, float);
          trails = [createTarget(gl, f.w, f.h, float), createTarget(gl, f.w, f.h, float)];
        }
        const fld = field!;
        const target = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        const sig = f.signal;
        const dt = f.dt;

        // 1. How much of the net is there: the loudness, eased, sets the density; nodes fade toward it.
        const level = levelOf(f);
        loudness += (level - loudness) * (1 - Math.exp(-dt / DENSITY_S));
        const d = density(loudness);
        const kIn = 1 - Math.exp(-dt / PRESENCE_IN_S);
        const kOut = 1 - Math.exp(-dt / PRESENCE_OUT_S);
        for (let i = 0; i < fld.count; i++) {
          const want = presenceTarget(fld, i, d);
          const p = presence[i]!;
          presence[i] = p + (want - p) * (want > p ? kIn : kOut);
        }
        // The main pulse's own nodes stay (it never runs through nothing).
        presence[main.from] = Math.max(presence[main.from]!, 1);
        presence[main.to] = Math.max(presence[main.to]!, 1);

        // 2–5. The main pulse, the beat's branches, the marks and swells fading.
        stepMain(dt);
        const beats = sig[OFFSET.scalars + SCALAR.beatCount]!;
        if (lastBeat >= 0 && beats > lastBeat) onBeat(Math.max(0.5, sig[OFFSET.scalars + SCALAR.beat]!));
        lastBeat = beats;
        const fadeMark = Math.exp(-dt / MARK_S);
        for (let k = 0; k < mark.length; k++) mark[k]! *= fadeMark;
        stepBranches(fld, branches, dt, BRANCH_SPEED, present, rand, (p) => (mark[p] = Math.max(mark[p]!, BRANCH_MARK)));
        const fadeSwell = Math.exp(-dt / SWELL_S);
        for (let i = 0; i < swell.length; i++) swell[i]! *= fadeSwell;

        // The camera: FOLLOW behind the pulse, easing sideways after it.
        const [mx, my, mz] = mainAt();
        const kFollow = 1 - Math.exp(-dt / FOLLOW_S);
        camXY = [camXY[0] + (mx - camXY[0]) * kFollow, camXY[1] + (my - camXY[1]) * kFollow];
        const camZ = (((mz - FOLLOW) % DEPTH) + DEPTH) % DEPTH;
        const scale = f.h * SCALE_OF_HEIGHT * f.zoom;
        const linkCount = fillLinks();
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
          gl.uniform2f(loc(program, 'uCamXY'), camXY[0], camXY[1]);
          gl.uniform1f(loc(program, 'uDepth'), DEPTH);
          gl.uniform1f(loc(program, 'uScale'), scale);
          gl.bindVertexArray(vao);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
        }
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);

        // The trail history: last frame's, pushed and faded, against this frame's light.
        const write = trails[trailTurn]!;
        const read = trails[1 - trailTurn]!;
        trailTurn = 1 - trailTurn;
        /** Binds texture `t` to unit `unit` as sampler `name` of `program`. */
        const sampler = (program: WebGLProgram, name: string, unit: number, t: WebGLTexture) => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.uniform1i(loc(program, name), unit);
        };
        gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
        gl.viewport(0, 0, f.w, f.h);
        f.bind(trailProgram);
        sampler(trailProgram, 'uFresh', 2, fresh.texture);
        sampler(trailProgram, 'uTrailPrev', 3, read.texture);
        drawFullscreen(gl);

        // Onto the scene's target: the fresh light, the history dimmed behind it.
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, f.w, f.h);
        f.bind(composeProgram);
        sampler(composeProgram, 'uFresh', 2, fresh.texture);
        sampler(composeProgram, 'uTrail', 3, write.texture);
        drawFullscreen(gl);
        // Unbind, so no texture is read while it's drawn into next frame.
        for (const unit of [2, 3]) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
        gl.activeTexture(gl.TEXTURE0);
      },
      destroy() {
        for (const p of [linkProgram, nodeProgram, trailProgram, composeProgram]) gl.deleteProgram(p);
        gl.deleteBuffer(linkBuffer);
        gl.deleteBuffer(nodeBuffer);
        gl.deleteVertexArray(linkVao);
        gl.deleteVertexArray(nodeVao);
        if (fresh) deleteTarget(gl, fresh);
        for (const t of trails) deleteTarget(gl, t);
      },
    };
    return engine;
  },
};
