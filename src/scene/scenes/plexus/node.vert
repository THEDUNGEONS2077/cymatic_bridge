// src/scene/scenes/plexus/node.vert: a node, a branch pulse or the main
// pulse, as a glowing disc.
//
// Each instance is a point (x, y, z, band), its swell (0..1: a pulse
// reached it lately; branches are drawn at 1) and its presence (the net
// grows and shrinks with the music: a node fades in and out). The main
// pulse comes with band -1: it's drawn larger, in the palette's bright
// colour, always fully present: the one thing always in focus.

layout(location = 0) in vec4 aNode;  // x, y, z, band (-1: the main pulse)
layout(location = 1) in vec2 aState; // swell, presence

out vec2 vUv;
flat out vec3 vColor;
flat out float vAlpha;

// The largest a disc gets (CSS px), however near.
const float MAX_SIZE = 120.0;

void main() {
  vec2 q = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0))[gl_VertexID];
  vec3 c = toCamera(aNode.xyz);
  float fog = fogOf(c.z);
  bool isMain = aNode.w < 0.0;
  float e = isMain ? uLevel : band(aNode.w);
  float swell = aState.x;
  float present = aState.y;
  vAlpha = isMain ? 1.0 : (0.22 + 0.45 * e + 0.6 * swell) * fog * present;
  if (vAlpha < 0.003 || c.z < 0.15) {
    gl_Position = HIDDEN;
    return;
  }
  // The main pulse: big, breathing with the level and flaring on the beat.
  float css = isMain ? 26.0 + 30.0 * uLevel + 26.0 * uBeat : 4.0 + 12.0 * e + 22.0 * swell;
  float size = min(MAX_SIZE, css / c.z * (0.8 + 0.4 * uGlow)) * uDpr;
  vUv = q;
  vColor = isMain ? uColBright : freqColor(aNode.w, e);
  gl_Position = clipOf(project(c) + q * 0.5 * size);
}
