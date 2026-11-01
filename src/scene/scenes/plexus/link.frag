// src/scene/scenes/plexus/link.frag: a link's smooth glowing line.
//
// The pixel's distance to the segment (so both ends are round), in CSS px,
// shaped as cyberdeck's glowing lines are (draw.glsl glowLine): a bell-shaped
// core and a Gaussian glow scaled by GLOW. Drawn additively: crossing links
// add their light, as light does.

in vec2 vPix;
flat in vec2 vPa;
flat in vec2 vPb;
flat in float vCore;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  vec2 ab = vPb - vPa;
  float t = clamp(dot(vPix - vPa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vPix - (vPa + ab * t)) / uDpr;
  float core = exp(-0.5 * pow(d / max(vCore * 0.5, 0.35), 2.0));
  float glow = exp(-0.5 * pow(d / (vCore * 3.0 + 6.0 * uGlow), 2.0)) * (0.12 + 0.35 * uGlow);
  outColor = vec4(vColor * vAlpha * (core + glow), 1.0);
}
