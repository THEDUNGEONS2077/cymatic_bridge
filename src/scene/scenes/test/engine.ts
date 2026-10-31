/**
 * src/scene/scenes/test/engine.ts: TEST, SIGNAL drawn plainly.
 *
 * Layer: scene (worker). The development scene of S1: one full-screen pass
 * (test.frag) showing every part of the signal, so the method can be seen
 * working and tuned by eye: the spectrum as two glowing lines (left above,
 * right below the middle), the history as a waterfall, the waveform as a
 * scope line, the four groups, the beat and the limited accent, trails
 * through the feedback pass. It's also the smallest example of a scene: a
 * factory, a program, a draw.
 */
import { drawFullscreen, sceneProgram } from '../../gl/program';
import type { SceneFactory } from '../../types';
import frag from './test.frag?raw';

/** TEST's factory. */
export const testScene: SceneFactory = {
  id: 'test',
  create(gl) {
    const program = sceneProgram(gl, frag);
    return {
      draw(f) {
        f.bind(program);
        drawFullscreen(f.gl);
      },
      destroy() {
        gl.deleteProgram(program);
      },
    };
  },
};
