/**
 * src/scene/gl/targets.ts: off-screen targets: a texture with a framebuffer
 * to draw into.
 *
 * Layer: scene (worker; WebGL 2). Every scene draws into its own target, and
 * the stage lays the targets onto the canvas (crossfades, dither). A scene
 * with trails has two and swaps them each frame (the feedback pass: it reads
 * its last frame while drawing the next).
 *
 * Half-float (RGBA16F) where the card can draw into it
 * (EXT_color_buffer_float): trails fade by multiplying, and in 8 bits a slow
 * fade sticks at a dim floor (0.95 × 3 rounds back to 3) and leaves ghosts.
 * 8-bit RGBA is the fallback.
 */

/** A texture and the framebuffer that draws into it. */
export interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  w: number;
  h: number;
}

/** Can this context draw into half-float textures? (Asked once per context.) */
export function floatTargets(gl: WebGL2RenderingContext): boolean {
  return !!gl.getExtension('EXT_color_buffer_float');
}

/** A new `w` × `h` target, cleared to black. */
export function createTarget(gl: WebGL2RenderingContext, w: number, h: number, float: boolean): Target {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer, w, h };
}

/** Releases a target. */
export function deleteTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteTexture(t.texture);
  gl.deleteFramebuffer(t.framebuffer);
}

/** A 1 × 1 black texture: uPrev for a scene without trails. */
export function blackTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  return texture;
}
