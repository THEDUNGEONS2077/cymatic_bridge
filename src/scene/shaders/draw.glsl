// src/scene/shaders/draw.glsl: drawing helpers for fragment shaders, put
// after signal.glsl in front of every scene's fragment shader
// (scene/gl/program.ts). They use screen-space derivatives (dFdx) or
// gl_FragCoord, which only a fragment shader has.

// A smooth glowing line (cyberdeck's, PLAYBOOK 6.2): `f` is a field that's 0
// on the line, `width` its core in CSS px. Its distance in device px comes
// from the field's gradient length, so the line keeps its width at any
// angle. Returns the core plus a Gaussian glow scaled by GLOW.
float glowLine(float f, float width) {
  float g = length(vec2(dFdx(f), dFdy(f)));
  float d = abs(f) / max(g, 1e-6) / uDpr;           // CSS px from the line
  float core = exp(-0.5 * pow(d / max(width * 0.5, 0.35), 2.0));
  float glow = exp(-0.5 * pow(d / (width * 3.0 + 6.0 * uGlow), 2.0));
  return core + glow * (0.18 + 0.5 * uGlow);
}

// A tiny ordered noise (±0.5 of one 8-bit step), added last, so faint fades don't band.
vec3 dither(vec2 fragCoord) {
  float n = fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
  return vec3((n - 0.5) / 255.0);
}
