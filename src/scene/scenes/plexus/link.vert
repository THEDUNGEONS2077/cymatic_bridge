// src/scene/scenes/plexus/link.vert: one link as a screen-space quad.
//
// Each instance is a visible link (engine.ts culls the rest on the CPU):
// its two nodes' x, y, z and band, how present it is (the lesser of its
// ends' presence: the net grows and shrinks with the music) and its mark (a
// pulse ran along it lately: it glows, fading). Its four vertices
// (gl_VertexID, a triangle strip) make a quad around the projected segment, wide
// enough for the glow and capped at both ends (link.frag rounds them). Its
// loudness (its bands' mean) brightens and thickens it; a mark makes it
// brighter, thicker and whiter, so the pulses' paths stand out (the main
// pulse's most). A link across the depth wrap is hidden: both ends are
// fogged out there anyway.

layout(location = 0) in vec4 aA;       // node A: x, y, z, band
layout(location = 1) in vec4 aB;       // node B
layout(location = 2) in vec2 aState;   // presence, mark

out vec2 vPix;
flat out vec2 vPa;
flat out vec2 vPb;
flat out float vCore;
flat out float vGlowSigma;
flat out vec3 vColor;
flat out float vAlpha;

// The widest a link's core gets (CSS px), however near.
const float MAX_CORE = 6.0;

void main() {
  vec2 q = vec2[4](vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(0.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  vec3 ca = toCamera(aA.xyz);
  vec3 cb = toCamera(aB.xyz);
  float fog = min(fogOf(ca.z), fogOf(cb.z));
  float e = 0.5 * (band(aA.w) + band(aB.w));
  float present = aState.x;
  float mark = aState.y;
  // The net is the stage, quiet and gently reacting; the marks (the pulses' paths) are the show.
  vAlpha = ((0.08 + 0.38 * pow(e, 1.3) + 0.3 * uAccent * fog) * present + 1.4 * mark) * fog;
  if (abs(ca.z - cb.z) > 0.5 * uDepth || vAlpha < 0.003) {
    gl_Position = HIDDEN;
    return;
  }
  vec2 pa = project(ca);
  vec2 pb = project(cb);
  // The core's width in CSS px: nearer is wider (perspective); louder and marked are wider.
  float core = min(MAX_CORE, ((0.4 + 0.7 * e) * present + 2.2 * mark) * 0.5 * (1.0 / ca.z + 1.0 / cb.z));
  // How far the quad reaches (device px): as far as the line's light is visible (above
  // 1/512), no further. A quiet link's glow fades out within about 2.5 of its widths,
  // a marked one's within about 3.4: most of the net's quads are far smaller than a
  // fixed 3 widths, and overdraw is the cost (0.4.1: "the smoothest it can be").
  // The glow's width follows importance (0.4.1, measured: the links were most of the frame's cost,
  // nearly all of it faint halo on quiet links): a quiet link's glow is slim, a marked or loud
  // one's as wide as GLOW makes it. The quiet stage reads crisper too.
  float wide = clamp(max(mark, 0.6 * e), 0.0, 1.0);
  float glowSigma = core * (1.5 + 1.5 * wide) + (1.5 + 4.5 * wide) * uGlow;
  float coreSigma = max(core * 0.5, 0.35);
  float glowPeak = vAlpha * (0.12 + 0.35 * uGlow);
  float reachCss = max(glowSigma * sqrt(2.0 * log(max(glowPeak * 512.0, 1.0001))), coreSigma * sqrt(2.0 * log(max(vAlpha * 512.0, 1.0001))));
  float reach = (reachCss + 1.0) * uDpr;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec2 p = mix(pa - dir * reach, pb + dir * reach, q.x) + n * q.y * reach;
  vPix = p;
  vPa = pa;
  vPb = pb;
  vCore = core;
  vGlowSigma = glowSigma;
  vColor = mix(freqColor(0.5 * (aA.w + aB.w), e), uColBright, 0.6 * min(1.0, mark));
  gl_Position = clipOf(p);
}
