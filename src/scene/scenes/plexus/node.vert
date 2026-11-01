// src/scene/scenes/plexus/node.vert: a node (or a signal) as a glowing disc.
//
// Each instance is a point (x, y, z, band) and its swell (0..1: a beat or a
// signal reaching it). Its size follows perspective, its band's loudness and
// the swell; its colour its band (freqColor). Signals are drawn with this
// too: a point between two nodes with a swell above 1.

layout(location = 0) in vec4 aNode;  // x, y, z, band
layout(location = 1) in float aSwell;

out vec2 vUv;
flat out vec3 vColor;
flat out float vAlpha;

// The largest a disc gets (CSS px), however near.
const float MAX_SIZE = 90.0;

void main() {
  vec2 q = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0))[gl_VertexID];
  vec3 c = toCamera(aNode.xyz);
  float fog = fogOf(c.z);
  float e = band(aNode.w);
  vAlpha = (0.3 + 0.7 * min(1.0, e + aSwell)) * fog;
  if (vAlpha < 0.003 || c.z < 0.15) {
    gl_Position = HIDDEN;
    return;
  }
  float size = min(MAX_SIZE, (7.0 + 20.0 * e + 22.0 * aSwell) / c.z * (0.8 + 0.4 * uGlow)) * uDpr;
  vUv = q;
  vColor = freqColor(aNode.w, e);
  gl_Position = clipOf(project(c) + q * 0.5 * size);
}
