// src/scene/scenes/coderain/speck.vert: one warp speck, a thin streak of light
// behind the code (C5 WARP, as light only).
//
// Each instance is a speck (angle, r, z, band; rain.ts). It reaches from its
// near end (its depth, or 0.45 once it nears the camera) uStretch units back:
// a dot at cruise, a long streak in a surge. Its band's loudness brightens
// it; the far and near fades hide it at the ends. The quad covers the
// projected streak and its width; speck.frag lights it brightest at the near
// end, fading to nothing at the far end. A streak runs straight out from the
// vanishing point, so if its far end is off the screen, all of it is.

layout(location = 0) in vec4 aSpeck;  // angle, r, z, band

uniform float uStretch;    // how far back a speck reaches (units of depth: rain.ts speckStretch)
uniform float uSpeckDeep;  // how deep the specks reach

out vec2 vPix;
flat out vec2 vPa;
flat out vec2 vPb;
flat out float vWidth;  // its width (device px)
flat out vec3 vColor;
flat out float vAlpha;

void main() {
  vec2 q = vec2[4](vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(0.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  float za = max(aSpeck.z, 0.45);
  float zb = min(uSpeckDeep, aSpeck.z + uStretch);
  float e = band(aSpeck.w);
  float a = 0.42 * fogOf(0.5 * (za + zb), uSpeckDeep) * (0.4 + 0.6 * e);
  vec2 pa = project(aSpeck.x, aSpeck.y, za);
  vec2 pb = project(aSpeck.x, aSpeck.y, zb);
  if (zb <= za || a < 0.004 || pb.x < 0.0 || pb.x > uRes.x || pb.y < 0.0 || pb.y > uRes.y) {
    gl_Position = HIDDEN;
    return;
  }
  // Its width: about a sixteenth of a glyph's size at its near end, 0.7..2.5 CSS px.
  float width = clamp(0.006 * uFocal / za / uDpr, 0.7, 2.5) * uDpr;
  float reach = 1.5 * width + uDpr;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec2 p = mix(pa - dir * reach, pb + dir * reach, q.x) + n * (q.y * reach);
  vPix = p;
  vPa = pa;
  vPb = pb;
  vWidth = width;
  vColor = freqColor(aSpeck.w, 0.15);
  vAlpha = a;
  gl_Position = clipOf(p);
}
