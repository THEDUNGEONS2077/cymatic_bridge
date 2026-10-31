#version 300 es
// src/scene/shaders/composite.frag: the scene's target onto the canvas.
// During a crossfade (stage.ts) uA is the new scene and uB the old, mixed by
// uMix; otherwise both are the same. Dithered last (±half an 8-bit step), so
// the faint fades scenes draw in half-float never band on the canvas.
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
in vec2 vUv;
out vec4 outColor;

// Interleaved gradient noise: an even, fine pattern with no visible structure.
float noise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec3 c = mix(texture(uB, vUv).rgb, texture(uA, vUv).rgb, uMix);
  c += (noise(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
