/**
 * src/scene/gl/signalTexture.ts: SIGNAL on the graphics card: one small
 * texture, written a row or two a frame.
 *
 * Layer: scene (worker; WebGL 2). 64 texels wide (the bands), two channels
 * (RG16F: left and right), HISTORY_ROWS + 2 tall:
 *   - row 0: the bands now (written every frame);
 *   - row 1: the waveform in R (every frame);
 *   - rows 2..: the history ring, one row every 1/HISTORY_HZ s, the newest
 *     at `head`. A fixed rate, not one per frame, so a scene's history looks
 *     the same on a 60 Hz screen and a 144 Hz one.
 * About 33 KB on the card; a frame uploads 512 bytes, plus 256 when a
 * history row is due. Filtering is linear across (bands blend smoothly into
 * each other); signal.glsl reads every row at its centre, so rows never
 * blend.
 */
import { BANDS, OFFSET, type Signal, WAVE_POINTS } from '@/lib/signal/layout';

/** How many past frames the ring holds. */
export const HISTORY_ROWS = 128;
/** How many history rows a second: 128 rows = 2 s. */
export const HISTORY_HZ = 64;
/** The texture's height. */
const ROWS = HISTORY_ROWS + 2;

/** The signal texture: upload a frame, and where the ring's newest row is. */
export interface SignalTexture {
  texture: WebGLTexture;
  /** The ring's newest row (0..HISTORY_ROWS - 1). */
  readonly head: number;
  /** Writes frame `s`; adds history rows for `dt` seconds of time passed. */
  upload(s: Signal, dt: number): void;
  destroy(): void;
}

/** Makes the texture (all zero: silence, nothing in the history yet). */
export function createSignalTexture(gl: WebGL2RenderingContext): SignalTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, BANDS, ROWS, 0, gl.RG, gl.FLOAT, new Float32Array(BANDS * ROWS * 2));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Rows to upload, made once (interleaved L, R).
  const bands = new Float32Array(BANDS * 2);
  const waveRow = new Float32Array(BANDS * 2);
  let head = 0;
  let due = 0;

  return {
    texture,
    get head() {
      return head;
    },
    upload(s, dt) {
      for (let i = 0; i < BANDS; i++) {
        bands[i * 2] = s[OFFSET.bandsL + i]!;
        bands[i * 2 + 1] = s[OFFSET.bandsR + i]!;
      }
      // The waveform has as many points as there are bands (64), so it fits one row.
      for (let i = 0; i < Math.min(BANDS, WAVE_POINTS); i++) waveRow[i * 2] = s[OFFSET.wave + i]!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BANDS, 1, gl.RG, gl.FLOAT, bands);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, BANDS, 1, gl.RG, gl.FLOAT, waveRow);
      // History rows at a fixed rate; after a long gap (a hidden tab) at most a ring's worth.
      due = Math.min(due + dt * HISTORY_HZ, HISTORY_ROWS);
      while (due >= 1) {
        due -= 1;
        head = (head + 1) % HISTORY_ROWS;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 2 + head, BANDS, 1, gl.RG, gl.FLOAT, bands);
      }
    },
    destroy() {
      gl.deleteTexture(texture);
    },
  };
}
