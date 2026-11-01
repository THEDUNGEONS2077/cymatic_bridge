// src/scene/scenes/plexus/link.vert: one link as a screen-space quad.
//
// Each instance is a link (its two nodes' x, y, z and band); its six
// vertices (gl_VertexID) make a quad around the projected segment, wide
// enough for the glow and capped at both ends (link.frag rounds them). The
// link's loudness is its two bands' mean: it thickens, brightens and lifts
// toward the palette's bright colour with them, and the beat accent flashes
// it, near links most. A link across the depth wrap (one end at the far
// end, the other at the camera) is hidden: both ends are fogged out there
// anyway.

layout(location = 0) in vec4 aA; // node A: x, y, z, band
layout(location = 1) in vec4 aB; // node B

out vec2 vPix;
flat out vec2 vPa;
flat out vec2 vPb;
flat out float vCore;
flat out vec3 vColor;
flat out float vAlpha;

// The widest a link's core gets (CSS px), however near.
const float MAX_CORE = 4.0;

void main() {
  vec2 q = vec2[6](vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 1.0), vec2(0.0, 1.0))[gl_VertexID];
  vec3 ca = toCamera(aA.xyz);
  vec3 cb = toCamera(aB.xyz);
  float fog = min(fogOf(ca.z), fogOf(cb.z));
  float e = 0.5 * (band(aA.w) + band(aB.w));
  vAlpha = (0.14 + 0.6 * e + 0.5 * uAccent * fog) * fog;
  if (abs(ca.z - cb.z) > 0.5 * uDepth || vAlpha < 0.003) {
    gl_Position = HIDDEN;
    return;
  }
  vec2 pa = project(ca);
  vec2 pb = project(cb);
  // The core's width in CSS px: nearer is wider (perspective), louder is wider.
  float core = min(MAX_CORE, (0.5 + 1.4 * e) * 0.5 * (1.0 / ca.z + 1.0 / cb.z));
  // How far the glow reaches (device px): three of its Gaussian's widths (draw.glsl glowLine).
  float reach = 3.0 * (core * 3.0 + 6.0 * uGlow) * uDpr;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec2 p = mix(pa - dir * reach, pb + dir * reach, q.x) + n * q.y * reach;
  vPix = p;
  vPa = pa;
  vPb = pb;
  vCore = core;
  vColor = freqColor(0.5 * (aA.w + aB.w), e);
  gl_Position = clipOf(p);
}
