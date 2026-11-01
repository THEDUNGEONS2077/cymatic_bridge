// src/scene/scenes/plexus/trail.frag: PLEXUS's trail history (TRAILS as
// warp streaks), kept in a buffer of the scene's own.
//
// Each frame: the history so far (uTrailPrev), pushed outward from the
// centre (as things fly past a camera moving forward: more when the music
// is loud) and faded, against this frame's light (uFresh): the brighter
// wins. The history is kept at full strength, so a streak keeps its length
// and shape; compose.frag shows it dimmed (0.4.0: "The trails are still too
// intense when activated": shown at full strength, a streak began as
// bright as what left it).
//
// How long a streak lasts follows TRAILS: a third of its light is left
// after 0.05 s (lowest) to 0.6 s (highest), per second, not per frame.

uniform sampler2D uFresh;
uniform sampler2D uTrailPrev;

in vec2 vUv;
out vec4 outColor;

void main() {
  float keep = uTrails < 0.001 ? 0.0 : exp(-uDt / mix(0.05, 0.6, uTrails));
  float push = exp(-uDt * (0.3 + 1.6 * uLevel));
  vec3 trail = texture(uTrailPrev, 0.5 + (vUv - 0.5) * push).rgb * keep;
  outColor = vec4(max(texture(uFresh, vUv).rgb, trail), 1.0);
}
