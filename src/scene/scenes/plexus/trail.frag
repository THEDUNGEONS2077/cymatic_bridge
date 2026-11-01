// src/scene/scenes/plexus/trail.frag: TRAILS as warp streaks.
//
// The first pass of each frame: the last frame, pushed outward from the
// centre (as things fly past a camera moving forward: more when the music
// is loud, since the camera is faster then) and faded by TRAILS
// (signal.glsl trailKeep). The links and nodes are then added on top. With
// TRAILS off, this clears to black.

in vec2 vUv;
out vec4 outColor;

void main() {
  float push = exp(-uDt * (0.3 + 1.6 * uLevel));
  vec2 uv = 0.5 + (vUv - 0.5) * push;
  outColor = vec4(texture(uPrev, uv).rgb * trailKeep(), 1.0);
}
