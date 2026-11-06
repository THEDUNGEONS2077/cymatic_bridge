// src/scene/scenes/coderain/speck.frag: a warp speck's streak: soft across its
// width, brightest at its near end and fading to nothing at its far end (the
// mock-ups' gradient line), its near end rounded. Drawn additively, dithered
// (CODE RAIN EQ draws straight onto the canvas).

in vec2 vPix;
flat in vec2 vPa;
flat in vec2 vPb;
flat in float vWidth;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  vec2 ab = vPb - vPa;
  float t = clamp(dot(vPix - vPa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vPix - (vPa + ab * t)) / (0.5 * vWidth);
  vec3 col = vColor * vAlpha * exp(-0.5 * d * d) * (1.0 - t);
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
