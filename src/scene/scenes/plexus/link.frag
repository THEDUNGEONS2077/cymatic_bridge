// src/scene/scenes/plexus/link.frag: a link's smooth glowing line.
//
// The pixel's distance to the segment (so both ends are round), in CSS px,
// shaped as cyberdeck's glowing lines are (draw.glsl glowLine): a bell-shaped
// core and a Gaussian glow, its width from link.vert (slim for a quiet link,
// GLOW's for a marked or loud one). Drawn additively: crossing links add
// their light, as light does.

in vec2 vPix;
flat in vec2 vPa;
flat in vec2 vPb;
flat in float vCore;
flat in float vGlowSigma;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  vec2 ab = vPb - vPa;
  float t = clamp(dot(vPix - vPa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vPix - (vPa + ab * t)) / uDpr;
  float c = d / max(vCore * 0.5, 0.35);
  float g = d / vGlowSigma;
  float core = exp(-0.5 * c * c);
  float glow = exp(-0.5 * g * g) * (0.12 + 0.35 * uGlow);
  vec3 col = vColor * vAlpha * (core + glow);
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  // Dithered here: PLEXUS draws straight onto the canvas (stage.ts direct).
  outColor = vec4(ditherOut(col), 1.0);
}
