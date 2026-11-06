/**
 * src/scene/scenes/coderain/engine.ts: CODE RAIN EQ, the second scene (S5):
 * a tunnel of code rushing out of a vanishing point on the horizon, a warp
 * behind it, and a heart monitor scanning the horizon.
 *
 * Layer: scene (worker; WebGL 2). The user's picks of the S5 mock-ups, in
 * order: C TUNNEL; a blend of C1 RUSH and C5 WARP; C8 LAYERS (C1's code in
 * front, C5's warp behind it); "a dynamic horizon instead of the light
 * beaming in the centre"; "keep the straight line … have the horizon
 * straight line react by how it glows"; the horizon "as if it's a heartbeat
 * pattern line"; MONITOR; its SCAN; and that scan's S5 BOUNCE. Each frame:
 *   1. the music: the level (eased for the horizon), each stream's and
 *      speck's band, the treble (glyph flicker), and a new beat (beatCount):
 *      a beat surges the flight, writes a heartbeat (stronger beat, taller
 *      spike), and flares the bass streams' heads;
 *   2. the flight eases, the streams and specks move (rain.ts), and the
 *      monitor's scan bounces on, writing the heartbeat (monitor.ts);
 *   3. uploads: the streams (each a run of TRAIL instances: its state with
 *      divisor TRAIL, each glyph's cell with divisor 1), the specks, and the
 *      trace's columns written this frame (a sub-range of a texture);
 *   4. drawing, additively, straight onto the canvas (direct: no trails;
 *      every shader dithers its own light): the specks (behind); the horizon
 *      (haze, glow, line and trace: one pass scissored to a band round it);
 *      the beam and its spark (a pass scissored to the beam's strip); then
 *      the code, lit where the beam is.
 * The glyph sheet (glyphs.ts) is drawn once per worker and uploaded with
 * mipmaps, so small far glyphs don't shimmer.
 */
import { OFFSET, SCALAR } from '@/lib/signal/layout';

import { drawFullscreen, sceneGeometryProgram, sceneProgram } from '../../gl/program';
import type { SceneEngine, SceneFactory } from '../../types';
import beamFrag from './beam.frag?raw';
import glyphFrag from './glyph.frag?raw';
import glyphVert from './glyph.vert?raw';
import { glyphSheet } from './glyphs';
import horizonFrag from './horizon.frag?raw';
import { COLS, createMonitor, monitorBeat, NEVER, stepMonitor } from './monitor';
import {
  bandOf,
  createFlight,
  createSpecks,
  createStreams,
  FLARE_BAND,
  FLICKER,
  FLICKER_TREBLE,
  flightBeat,
  GAP,
  glyphPicker,
  seeded,
  SPECK_DEEP,
  SPECKS,
  speckStretch,
  stepFlight,
  stepSpeck,
  stepStream,
  STREAM_DEEP,
  STREAMS,
  streamPace,
  TRAIL,
} from './rain';
import speckFrag from './speck.frag?raw';
import speckVert from './speck.vert?raw';
import viewGlsl from './view.glsl?raw';

/** The focal length (device px per unit at depth 1), as a share of the view: of its width, or of 1.6 × its height if that's less. */
const FOCAL_SHARE = 0.42;
/** A glyph's size at depth 1 (units); its quad over that (a sheet cell is half again a glyph: room for its glow); the biggest a glyph gets (CSS px). */
const GLYPH_UNITS = 0.1;
const GLYPH_QUAD = 1.25;
const GLYPH_MAX_CSS = 72;
/** A spike's height, as a share of the view's height. */
const TRACE_SHARE = 0.12;
/** The horizon pass's band: this share of the height below the horizon and above it (the trace reaches up). */
const BAND_BELOW = 0.1;
const BAND_ABOVE = 0.17;
/** The beam's half-width, as a share of the view's width. */
const BEAM_SHARE = 0.03;
/** The spark's radius, as a share of the view's height. */
const SPARK_SHARE = 0.031;
/** How fast the horizon's level follows the music (s). */
const LEVEL_S = 0.25;
/** Floats per stream (angle, r, z, band; length, loudness, flare, spare) and per speck (angle, r, z, band). */
const STREAM = 8;
const SPECK = 4;
/** Texture units: the stage binds the signal to 0 and the last frame to 1; the glyph sheet and the trace take the next two. */
const UNIT_SHEET = 2;
const UNIT_TRACE = 3;

/** CODE RAIN EQ's factory. */
export const codeRainScene: SceneFactory = {
  id: 'coderain',
  // No trails, and every shader dithers its own light: straight onto the canvas.
  direct: true,
  create(gl) {
    const glyphProgram = sceneGeometryProgram(gl, `${viewGlsl}\n${glyphVert}`, glyphFrag);
    const speckProgram = sceneGeometryProgram(gl, `${viewGlsl}\n${speckVert}`, speckFrag);
    const horizonProgram = sceneProgram(gl, horizonFrag);
    const beamProgram = sceneProgram(gl, beamFrag);

    // The per-frame buffers, made once (bufferSubData each frame: no allocation).
    const streamData = new Float32Array(STREAMS * STREAM);
    const glyphIds = new Uint8Array(STREAMS * TRAIL);
    const speckData = new Float32Array(SPECKS * SPECK);
    const buf = { streams: gl.createBuffer()!, glyphs: gl.createBuffer()!, specks: gl.createBuffer()! };
    for (const [b, data] of [
      [buf.streams, streamData],
      [buf.glyphs, glyphIds],
      [buf.specks, speckData],
    ] as const) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    }
    // The code: each stream's state advances once a run of TRAIL instances (its glyphs); each glyph's cell once an instance.
    const glyphVao = gl.createVertexArray()!;
    gl.bindVertexArray(glyphVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.streams);
    for (const [at, offset] of [
      [0, 0],
      [1, 4],
    ] as const) {
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, STREAM * 4, offset * 4);
      gl.vertexAttribDivisor(at, TRAIL);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.glyphs);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribIPointer(2, 1, gl.UNSIGNED_BYTE, 1, 0);
    gl.vertexAttribDivisor(2, 1);
    const speckVao = gl.createVertexArray()!;
    gl.bindVertexArray(speckVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.specks);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, SPECK * 4, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.bindVertexArray(null);

    // The glyph sheet: two channels (shape, glow), mipmapped.
    const sheet = glyphSheet();
    const sheetTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + UNIT_SHEET);
    gl.bindTexture(gl.TEXTURE_2D, sheetTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, sheet.w, sheet.h, 0, gl.RG, gl.UNSIGNED_BYTE, sheet.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    // The trace: per column its height and when it was written (read with texelFetch: no filtering).
    const traceData = new Float32Array(COLS * 2);
    for (let c = 0; c < COLS; c++) traceData[c * 2 + 1] = NEVER;
    const traceTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + UNIT_TRACE);
    gl.bindTexture(gl.TEXTURE_2D, traceTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, COLS, 1, 0, gl.RG, gl.FLOAT, traceData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0 + UNIT_SHEET);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);

    // The rain, the flight and the monitor (the same seed: the same rain each time the scene starts).
    const rand = seeded(19);
    const pick = glyphPicker(sheet.kana, sheet.count - sheet.kana, rand);
    const streams = createStreams(rand, pick, glyphIds);
    const specks = createSpecks(rand);
    const flight = createFlight();
    const monitor = createMonitor();
    let lvl = 0.3;
    let lastBeat = -1;

    const locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
    const loc = (p: WebGLProgram, name: string) => {
      let m = locs.get(p);
      if (!m) locs.set(p, (m = new Map()));
      if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
      return m.get(name)!;
    };
    /** Binds texture `t` to `unit` as sampler `name` of `program` (in use). */
    const sampler = (program: WebGLProgram, name: string, unit: number, t: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(loc(program, name), unit);
    };

    const engine: SceneEngine = {
      draw(f) {
        const sig = f.signal;
        const dt = f.dt;
        const sens = f.sensitivity;
        const at = (k: keyof typeof SCALAR) => sig[OFFSET.scalars + SCALAR[k]]!;
        const level = Math.min(1, at('level') * sens);

        // 1. A new beat: the flight surges, the monitor writes a heartbeat (a stronger beat, a taller spike), the bass heads flare.
        const beats = at('beatCount');
        if (lastBeat >= 0 && beats > lastBeat) {
          flightBeat(flight);
          monitorBeat(monitor, 0.65 + 0.7 * (Math.max(0.5, at('beat')) - 0.5));
          for (const s of streams) if (s.band < FLARE_BAND) s.flare = 1;
        }
        lastBeat = beats;

        // 2. The flight, the code, the warp, the monitor.
        stepFlight(flight, level, dt);
        const pace = streamPace(flight.speed);
        const flicker = FLICKER + FLICKER_TREBLE * Math.min(1, at('treble') * sens);
        for (const s of streams) stepStream(s, bandOf(sig, s.band, sens), dt, pace, flicker, rand, pick);
        for (const d of specks) stepSpeck(d, bandOf(sig, d.band, sens), flight.speed, dt, rand);
        stepMonitor(monitor, dt);
        lvl += (level - lvl) * (1 - Math.exp(-dt / LEVEL_S));

        // 3. Uploads: the streams and their glyphs, the specks, the trace's new columns.
        streams.forEach((s, i) => {
          const o = i * STREAM;
          streamData[o] = s.angle;
          streamData[o + 1] = s.r;
          streamData[o + 2] = s.z;
          streamData[o + 3] = s.band;
          streamData[o + 4] = s.len;
          streamData[o + 5] = s.e;
          streamData[o + 6] = s.flare;
        });
        specks.forEach((d, i) => {
          const o = i * SPECK;
          speckData[o] = d.angle;
          speckData[o + 1] = d.r;
          speckData[o + 2] = d.z;
          speckData[o + 3] = d.band;
        });
        for (const [b, data] of [
          [buf.streams, streamData],
          [buf.glyphs, glyphIds],
          [buf.specks, speckData],
        ] as const) {
          gl.bindBuffer(gl.ARRAY_BUFFER, b);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
        }
        if (monitor.hi >= monitor.lo) {
          for (let c = monitor.lo; c <= monitor.hi; c++) {
            traceData[c * 2] = monitor.trace[c]!;
            traceData[c * 2 + 1] = monitor.wrote[c]!;
          }
          gl.activeTexture(gl.TEXTURE0 + UNIT_TRACE);
          gl.bindTexture(gl.TEXTURE_2D, traceTex);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, monitor.lo, 0, monitor.hi - monitor.lo + 1, 1, gl.RG, gl.FLOAT, traceData, monitor.lo * 2);
        }

        // 4. Drawing.
        const { w, h } = f;
        const focal = FOCAL_SHARE * Math.min(w, 1.6 * h) * f.zoom;
        const cx = w / 2;
        const cy = h / 2;
        const traceA = TRACE_SHARE * h;
        const live = Math.abs(monitor.live);
        const beamX = monitor.head * w;
        const beamW = BEAM_SHARE * w;
        const scanAt = monitor.head * 2 - 1;
        const sparkY = cy + traceA * monitor.trace[Math.round(monitor.head * (COLS - 1))]!;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        // The warp, behind.
        f.bind(speckProgram);
        gl.uniform2f(loc(speckProgram, 'uCentre'), cx, cy);
        gl.uniform1f(loc(speckProgram, 'uFocal'), focal);
        gl.uniform1f(loc(speckProgram, 'uStretch'), speckStretch(flight.speed));
        gl.uniform1f(loc(speckProgram, 'uSpeckDeep'), SPECK_DEEP);
        gl.bindVertexArray(speckVao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, SPECKS);
        gl.bindVertexArray(null);

        // The horizon and its trace, in a band round it.
        gl.enable(gl.SCISSOR_TEST);
        const y0 = Math.max(0, Math.floor(cy - BAND_BELOW * h));
        const y1 = Math.min(h, Math.ceil(cy + BAND_ABOVE * h));
        gl.scissor(0, y0, w, y1 - y0);
        f.bind(horizonProgram);
        sampler(horizonProgram, 'uTrace', UNIT_TRACE, traceTex);
        gl.uniform1f(loc(horizonProgram, 'uCols'), COLS);
        gl.uniform1f(loc(horizonProgram, 'uNow'), monitor.now);
        gl.uniform1f(loc(horizonProgram, 'uTraceA'), traceA);
        gl.uniform2f(loc(horizonProgram, 'uCentre'), cx, cy);
        gl.uniform1f(loc(horizonProgram, 'uLvl'), lvl);
        gl.uniform1f(loc(horizonProgram, 'uAt'), scanAt);
        gl.uniform1f(loc(horizonProgram, 'uLive'), live);
        drawFullscreen(gl);

        // The beam and its spark, in the beam's strip.
        const strip = Math.max(beamW, SPARK_SHARE * h);
        const x0 = Math.max(0, Math.floor(beamX - strip));
        gl.scissor(x0, 0, Math.max(1, Math.min(w, Math.ceil(beamX + strip)) - x0), h);
        f.bind(beamProgram);
        gl.uniform2f(loc(beamProgram, 'uCentre'), cx, cy);
        gl.uniform3f(loc(beamProgram, 'uBeam'), beamX, beamW, 0.25 + 0.6 * live);
        gl.uniform1f(loc(beamProgram, 'uBand'), Math.pow(Math.min(1, Math.abs(scanAt)), 1.4));
        gl.uniform3f(loc(beamProgram, 'uSpark'), beamX, sparkY, SPARK_SHARE * h);
        drawFullscreen(gl);
        gl.disable(gl.SCISSOR_TEST);

        // The code, in front, lit where the beam is.
        f.bind(glyphProgram);
        sampler(glyphProgram, 'uSheetTex', UNIT_SHEET, sheetTex);
        gl.uniform2f(loc(glyphProgram, 'uCentre'), cx, cy);
        gl.uniform1f(loc(glyphProgram, 'uFocal'), focal);
        gl.uniform1f(loc(glyphProgram, 'uTrail'), TRAIL);
        gl.uniform1f(loc(glyphProgram, 'uGap'), GAP);
        gl.uniform1f(loc(glyphProgram, 'uDeep'), STREAM_DEEP);
        gl.uniform1f(loc(glyphProgram, 'uGlyphPx'), GLYPH_QUAD * GLYPH_UNITS * focal);
        gl.uniform1f(loc(glyphProgram, 'uMaxPx'), GLYPH_QUAD * GLYPH_MAX_CSS * f.dpr);
        gl.uniform2f(loc(glyphProgram, 'uSheet'), sheet.cols, sheet.rows);
        gl.uniform3f(loc(glyphProgram, 'uBeam'), beamX, beamW, 0.6 + 0.9 * live);
        gl.bindVertexArray(glyphVao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, STREAMS * TRAIL);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);

        // Unbind ours, so nothing is left bound for the stage's next pass.
        for (const unit of [UNIT_SHEET, UNIT_TRACE]) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
        gl.activeTexture(gl.TEXTURE0);
      },
      destroy() {
        for (const p of [glyphProgram, speckProgram, horizonProgram, beamProgram]) gl.deleteProgram(p);
        for (const b of Object.values(buf)) gl.deleteBuffer(b);
        for (const v of [glyphVao, speckVao]) gl.deleteVertexArray(v);
        for (const t of [sheetTex, traceTex]) gl.deleteTexture(t);
      },
    };
    return engine;
  },
};
