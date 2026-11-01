// src/scene/scenes/plexus/trail.frag: the frame onto the scene's target,
// with TRAILS as warp streaks.
//
// The engine draws each frame's light (links, nodes, signals: additive)
// into a buffer of its own, uFresh; this lays it onto the scene's target,
// together with the last frame (uPrev) pushed outward from the centre (as
// things fly past a camera moving forward: more when the music is loud,
// since the camera is faster then) and faded by TRAILS (signal.glsl
// trailKeep). The brighter of the two wins: a trail is a streak behind the
// net, never added onto it. (0.4.0's first build added the frame onto the
// trail, and at a high frame rate a still part of the picture added up to
// some 30 times its brightness: "When the trails are on not much is
// visible".) With TRAILS off, it's the fresh frame alone.

uniform sampler2D uFresh;

in vec2 vUv;
out vec4 outColor;

void main() {
  float push = exp(-uDt * (0.3 + 1.6 * uLevel));
  vec3 trail = texture(uPrev, 0.5 + (vUv - 0.5) * push).rgb * trailKeep();
  outColor = vec4(max(texture(uFresh, vUv).rgb, trail), 1.0);
}
