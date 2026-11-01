/**
 * src/scene/gl/program.ts: building shader programs, and the one
 * full-screen triangle every pass draws.
 *
 * Layer: scene (worker; WebGL 2, no DOM). A scene's shaders are written
 * without the version line or the includes: these put `#version 300 es`
 * and signal.glsl in front of each (so every scene reads the music the same
 * way, in either stage), and draw.glsl after it in front of the fragment
 * shader (its helpers need a fragment shader's derivatives).
 */
import drawGlsl from '../shaders/draw.glsl?raw';
import signalGlsl from '../shaders/signal.glsl?raw';
import fullscreenVert from '../shaders/fullscreen.vert?raw';

/** Compiles one shader, or throws with its log. */
function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader: ${log}`);
  }
  return shader;
}

/** Links a program from a vertex and a fragment shader's sources, or throws with its log. */
export function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  // The shaders stay inside the program: they can go.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`program: ${gl.getProgramInfoLog(program)}`);
  return program;
}

/** The fragment shader `frag` with the includes in front. */
const withFragIncludes = (frag: string) => `#version 300 es\n${signalGlsl}\n${drawGlsl}\n${frag}`;

/** A full-screen pass's program: the full-screen triangle and `frag` with the includes in front. */
export function sceneProgram(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  return linkProgram(gl, fullscreenVert, withFragIncludes(frag));
}

/** A scene's own geometry program: `vert` with signal.glsl in front, `frag` with both includes. */
export function sceneGeometryProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  return linkProgram(gl, `#version 300 es\n${signalGlsl}\n${vert}`, withFragIncludes(frag));
}

/** A full-screen pass's program without the SIGNAL include (the stage's own passes). */
export function plainProgram(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  return linkProgram(gl, fullscreenVert, frag);
}

/**
 * Draws the full-screen triangle (one triangle bigger than the screen: no
 * seam down the diagonal, as two triangles can show). The vertex shader
 * makes its corners from gl_VertexID, so no buffer is bound.
 */
export function drawFullscreen(gl: WebGL2RenderingContext): void {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
