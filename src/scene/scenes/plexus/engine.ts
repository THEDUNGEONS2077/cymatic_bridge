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
 * mark". "This is perfect" (0.4.0). Then "I would like there to be more of
 * the net … Fills the screen", the same quiet stage, and "the main goal is
 * for it to be the smoothest it can be" (0.4.1): a net three times the size
 * (field.ts), drawn with less work per node. Each frame:
 *   1. presence: the music's loudness (eased over DENSITY_S, so the net
 *      changes calmly) sets how much of the net is there (field.ts density);
 *      each node fades toward it, in over PRESENCE_IN_S, out over
 *      PRESENCE_OUT_S;
 *   2. the main pulse runs along its link at a speed set by the loudness,
 *      marking it; at each node it picks the next one ahead, near the centre
 *      (field.ts nextForward), and the node swells;
 *   3. the camera sits FOLLOW behind the pulse and eases sideways after it,
 *      so it stays in focus at the centre. Forward, it glides at the pulse's
 *      forward speed smoothed over CAM_SPEED_S, gently pulled back to FOLLOW
 *      over CAM_HOLD_S (0.4.2): following the pulse's depth exactly, the
 *      flight stepped at every node, since each link points another way and
 *      the forward share of the pulse's speed jumps there;
 *   4. on a beat, branches split off the main pulse along other links,
 *      more for a stronger beat, each running a few links and marking them;
 *   5. marks fade (MARK_S): the paths glow, then go;
 *   6. drawing: every link, then every node, then the branches and the main
 *      pulse, additively. With TRAILS off, straight onto the scene's target
 *      (one pass of light, nothing else). With TRAILS on, into a buffer of
 *      the scene's own (fresh); trail.frag adds that to the trail history
 *      (two buffers, swapped each frame: warp streaks at full strength);
 *      compose.frag lays fresh onto the target with the history dimmed
 *      behind it ("The trails are still too intense when activated").
 * Only what can be seen is drawn (0.4.1, measured: links were most of a
 * frame's cost, mostly their vertices): each frame the CPU skips links and
 * nodes that are absent (a quiet net is a third present), out of view to
 * the sides, or within the near and far fades, and writes the rest, packed,
 * into buffers made once per field (bufferSubData: no allocation). A quad is
 * a four-vertex strip.
 */
import { OFFSET, SCALAR } from '@/lib/signal/layout';

import { drawFullscreen, sceneGeometryProgram, sceneProgram } from '../../gl/program';
import { createTarget, deleteTarget, floatTargets, type Target } from '../../gl/targets';
import type { SceneEngine, SceneFactory, SceneFrame } from '../../types';
import cameraGlsl from './camera.glsl?raw';
import composeFrag from './compose.frag?raw';
import { branch, buildField, density, DEPTH, distance, type Field, glide, type Glide, MAX_BRANCHES, nextForward, pairOf, presenceTarget, type Pulse, seeded, stepBranches, wrapStep } from './field';
import linkFrag from './link.frag?raw';
import linkVert from './link.vert?raw';
import nodeFrag from './node.frag?raw';
import nodeVert from './node.vert?raw';
import trailFrag from './trail.frag?raw';

/** The main pulse's speed (world units a second): this when silent, up to this much more at full loudness. */
const MAIN_SPEED_QUIET = 0.45;
const MAIN_SPEED_LOUD = 1.9;
/** How far behind the main pulse the camera sits (world units), and how fast it eases sideways after it (s). */
const FOLLOW = 1.7;
const FOLLOW_S = 0.6;
/** The camera's forward glide: the pulse's forward speed smoothed over CAM_SPEED_S; drift from FOLLOW corrected over CAM_HOLD_S. */
const CAM_SPEED_S = 0.5;
const CAM_HOLD_S = 1.5;
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
/** Floats per drawn link (two ends' x, y, z, band; presence; mark) and per drawn point (x, y, z, band; swell; presence). */
const LINK = 10;
const POINT = 6;
/** The depths ahead that can be seen (camera.glsl fogOf: gone nearer than 0.35, all but gone beyond 7.6). */
const SEEN_NEAR = 0.35;
const SEEN_FAR = 7.6;
/** A margin round the screen's edges (world units at depth 1) before a thing counts as out of view: glows reach past their centres. */
const SEEN_MARGIN = 0.25;

/** PLEXUS's factory. */
export const plexusScene: SceneFactory = {
  id: 'plexus',
  // It reads no last frame from the stage (its trails are its own) and dithers its own light: straight onto the canvas.
  direct: true,
  create(gl) {
    const linkProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${linkVert}`, linkFrag);
    const nodeProgram = sceneGeometryProgram(gl, `${cameraGlsl}\n${nodeVert}`, nodeFrag);
    const trailProgram = sceneProgram(gl, trailFrag);
    const composeProgram = sceneProgram(gl, composeFrag);
    const float = floatTargets(gl);
    const buf = { links: gl.createBuffer()!, points: gl.createBuffer()! };
    const linkVao = gl.createVertexArray()!;
    const pointVao = gl.createVertexArray()!;

    /** Points a per-instance attribute at a buffer: location, size, stride and offset in floats. */
    const attr = (buffer: WebGLBuffer, loc: number, size: number, stride: number, offset: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    gl.bindVertexArray(linkVao);
    attr(buf.links, 0, 4, LINK, 0);
    attr(buf.links, 1, 4, LINK, 4);
    attr(buf.links, 2, 2, LINK, 8);
    gl.bindVertexArray(pointVao);
    attr(buf.points, 0, 4, POINT, 0);
    attr(buf.points, 1, 2, POINT, 4);
    gl.bindVertexArray(null);

    let field: Field | null = null;
    let aspect = 0;
    let presence = new Float32Array(0);
    let swell = new Float32Array(0);
    let mark = new Float32Array(0);
    let links = new Float32Array(0);
    let points = new Float32Array(0);
    // Each link's B depth, placed next to A's (the short way across the wrap), worked out once per field.
    let linkZb = new Float32Array(0);
    const branches: Pulse[] = [];
    const rand = seeded(7);
    const present = (n: number) => presence[n] ?? 0;
    let main: Pulse = { from: 0, to: 0, t: 1, hops: 0, pair: -1 };
    let mainLength = 1;
    let loudness = 0;
    let lastBeat = -1;
    let camXY: [number, number] = [0, 0];
    // The forward glide, all in unwrapped depth (wrapped only when drawn): the pulse's depth, the camera's, and its speed.
    let pulseDepth = 0;
    let lastPulseZ = 0;
    const cam: Glide = { depth: -FOLLOW, speed: 0 };
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

    /**
     * Builds the field for the canvas's shape: sizes the per-frame buffers
     * (on the CPU and the GPU, once), and starts the main pulse at the
     * present node nearest the axis.
     */
    const build = (shape: number) => {
      aspect = shape;
      const f = (field = buildField(shape));
      const linkCount = f.pairs.length / 2;
      presence = Float32Array.from({ length: f.count }, (_, i) => presenceTarget(f, i, density(0)));
      swell = new Float32Array(f.count);
      mark = new Float32Array(linkCount);
      links = new Float32Array(linkCount * LINK);
      points = new Float32Array((f.count + MAX_BRANCHES + 1) * POINT);
      branches.length = 0;
      linkZb = new Float32Array(linkCount);
      for (let k = 0; k < linkCount; k++) {
        const za = f.pos[f.pairs[k * 2]! * 3 + 2]!;
        linkZb[k] = za + wrapStep(za, f.pos[f.pairs[k * 2 + 1]! * 3 + 2]!);
      }
      for (const [b, data] of [
        [buf.links, links],
        [buf.points, points],
      ] as const) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      }

      let start = 0;
      for (let i = 0; i < f.count; i++) {
        if (presence[i]! > 0.5 && Math.hypot(f.pos[i * 3]!, f.pos[i * 3 + 1]!) < Math.hypot(f.pos[start * 3]!, f.pos[start * 3 + 1]!)) start = i;
      }
      main = { from: start, to: start, t: 1, hops: 0, pair: -1 };
      mainLength = 1;
      camXY = [f.pos[start * 3]!, f.pos[start * 3 + 1]!];
      lastPulseZ = f.pos[start * 3 + 2]!;
      pulseDepth = lastPulseZ;
      cam.depth = pulseDepth - FOLLOW;
      cam.speed = 0;
    };

    /** Where pulse `p` is now (x, y, z; z not wrapped, so the camera never jumps). */
    const pulseAt = (p: Pulse): [number, number, number] => {
      const pos = field!.pos;
      const t = Math.min(1, p.t);
      const za = pos[p.from * 3 + 2]!;
      return [pos[p.from * 3]! + (pos[p.to * 3]! - pos[p.from * 3]!) * t, pos[p.from * 3 + 1]! + (pos[p.to * 3 + 1]! - pos[p.from * 3 + 1]!) * t, za + wrapStep(za, pos[p.to * 3 + 2]!) * t];
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

    /**
     * Writes and sends what can be seen this frame, packed: the links (present
     * or marked, in view), the nodes (present, in view), the branches and the
     * main pulse. Returns how many links and points.
     */
    const sendVisible = (camZ: number, halfX: number, halfY: number): [number, number] => {
      const { pairs, pos, band, count } = field!;
      const [cx, cy] = camXY;
      /** Depth ahead of the camera, wrapped. */
      const ahead = (z: number) => (((z - camZ) % DEPTH) + DEPTH) % DEPTH;
      /** Is a point at x, y, depth z ahead in view (inside the screen, with a margin, between the fades)? */
      const inView = (x: number, y: number, z: number) =>
        z > SEEN_NEAR && z < SEEN_FAR && Math.abs(x - cx) < (halfX + SEEN_MARGIN) * z && Math.abs(y - cy) < (halfY + SEEN_MARGIN) * z;
      let nl = 0;
      for (let k = 0; k < mark.length; k++) {
        const a = pairs[k * 2]!;
        const b = pairs[k * 2 + 1]!;
        const present = Math.min(presence[a]!, presence[b]!);
        if (present < 0.01 && mark[k]! < 0.01) continue;
        const za = pos[a * 3 + 2]!;
        const zb = linkZb[k]!;
        const aheadA = ahead(za);
        // B's depth ahead, from A's (so a link across the wrap stays whole: link.vert hides one that straddles the camera).
        const aheadB = aheadA + (zb - za);
        if (!inView(pos[a * 3]!, pos[a * 3 + 1]!, aheadA) && !inView(pos[b * 3]!, pos[b * 3 + 1]!, aheadB)) continue;
        const o = nl++ * LINK;
        links[o] = pos[a * 3]!;
        links[o + 1] = pos[a * 3 + 1]!;
        links[o + 2] = za;
        links[o + 3] = band[a]!;
        links[o + 4] = pos[b * 3]!;
        links[o + 5] = pos[b * 3 + 1]!;
        links[o + 6] = zb;
        links[o + 7] = band[b]!;
        links[o + 8] = present;
        links[o + 9] = mark[k]!;
      }
      let np = 0;
      const put = (x: number, y: number, z: number, b: number, s: number, p: number) => {
        const o = np++ * POINT;
        points[o] = x;
        points[o + 1] = y;
        points[o + 2] = z;
        points[o + 3] = b;
        points[o + 4] = s;
        points[o + 5] = p;
      };
      for (let i = 0; i < count; i++) {
        if (presence[i]! < 0.01 || !inView(pos[i * 3]!, pos[i * 3 + 1]!, ahead(pos[i * 3 + 2]!))) continue;
        put(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, band[i]!, swell[i]!, presence[i]!);
      }
      for (const b of branches) {
        const [x, y, z] = pulseAt(b);
        put(x, y, z, band[b.from]!, 1, 1);
      }
      // The main pulse: band -1 (node.vert draws it large, in the bright colour).
      const [x, y, z] = pulseAt(main);
      put(x, y, z, -1, 1, 1);
      for (const [b, data] of [
        [buf.links, links.subarray(0, nl * LINK)],
        [buf.points, points.subarray(0, np * POINT)],
      ] as const) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      }
      return [nl, np];
    };

    /** The music's loudness with SENSITIVITY, from the signal's level. */
    const levelOf = (f: SceneFrame) => Math.min(1, f.signal[OFFSET.scalars + SCALAR.level]! * f.sensitivity);

    /** Binds texture `t` to unit `unit` as sampler `name` of `program`. */
    const sampler = (program: WebGLProgram, name: string, unit: number, t: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(loc(program, name), unit);
    };

    const engine: SceneEngine = {
      draw(f) {
        const shape = f.w / Math.max(1, f.h);
        if (!field || Math.abs(shape - aspect) / aspect > 0.01) build(shape);
        const fld = field!;
        const target = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        const sig = f.signal;
        const dt = f.dt;

        // 1. How much of the net is there: the loudness, eased, sets the density; nodes fade toward it.
        loudness += (levelOf(f) - loudness) * (1 - Math.exp(-dt / DENSITY_S));
        const d = density(loudness);
        const kIn = 1 - Math.exp(-dt / PRESENCE_IN_S);
        const kOut = 1 - Math.exp(-dt / PRESENCE_OUT_S);
        for (let i = 0; i < fld.count; i++) {
          const want = presenceTarget(fld, i, d);
          const p = presence[i]!;
          presence[i] = p + (want - p) * (want > p ? kIn : kOut);
        }
        // The main pulse's own nodes stay (it never runs through nothing).
        presence[main.from] = 1;
        presence[main.to] = 1;

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

        // The camera: easing sideways after the pulse; forward, gliding at its smoothed speed, held FOLLOW behind it.
        const [mx, my, mz] = pulseAt(main);
        const kFollow = 1 - Math.exp(-dt / FOLLOW_S);
        camXY = [camXY[0] + (mx - camXY[0]) * kFollow, camXY[1] + (my - camXY[1]) * kFollow];
        const step = wrapStep(lastPulseZ, mz);
        lastPulseZ = mz;
        pulseDepth += step;
        glide(cam, pulseDepth, step, dt, FOLLOW, CAM_SPEED_S, CAM_HOLD_S);
        const camZ = ((cam.depth % DEPTH) + DEPTH) % DEPTH;
        const scale = f.h * SCALE_OF_HEIGHT * f.zoom;
        const [linkCount, pointCount] = sendVisible(camZ, (0.5 * f.w) / scale, (0.5 * f.h) / scale);

        // 6. Where the light goes: straight onto the target without trails; into the fresh buffer with them.
        const withTrails = f.trails > 0.001;
        if (withTrails && (!fresh || fresh.w !== f.w || fresh.h !== f.h)) {
          if (fresh) deleteTarget(gl, fresh);
          for (const t of trails) deleteTarget(gl, t);
          fresh = createTarget(gl, f.w, f.h, float);
          trails = [createTarget(gl, f.w, f.h, float), createTarget(gl, f.w, f.h, float)];
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, withTrails ? fresh!.framebuffer : target);
        gl.viewport(0, 0, f.w, f.h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        for (const [program, vao, count] of [
          [linkProgram, linkVao, linkCount],
          [nodeProgram, pointVao, pointCount],
        ] as const) {
          f.bind(program);
          gl.uniform1f(loc(program, 'uCamZ'), camZ);
          gl.uniform2f(loc(program, 'uCamXY'), camXY[0], camXY[1]);
          gl.uniform1f(loc(program, 'uDepth'), DEPTH);
          gl.uniform1f(loc(program, 'uScale'), scale);
          gl.bindVertexArray(vao);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        }
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
        if (!withTrails || !fresh) return;

        // The trail history: last frame's, pushed and faded, against this frame's light.
        const write = trails[trailTurn]!;
        const read = trails[1 - trailTurn]!;
        trailTurn = 1 - trailTurn;
        gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
        f.bind(trailProgram);
        sampler(trailProgram, 'uFresh', 2, fresh.texture);
        sampler(trailProgram, 'uTrailPrev', 3, read.texture);
        drawFullscreen(gl);

        // Onto the scene's target: the fresh light, the history dimmed behind it.
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
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
        for (const b of Object.values(buf)) gl.deleteBuffer(b);
        for (const v of [linkVao, pointVao]) gl.deleteVertexArray(v);
        if (fresh) deleteTarget(gl, fresh);
        for (const t of trails) deleteTarget(gl, t);
      },
    };
    return engine;
  },
};
