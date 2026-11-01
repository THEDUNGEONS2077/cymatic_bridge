// src/scene/scenes/plexus/compose.frag: the frame onto the scene's target:
// this frame's light (uFresh), with the trail history (uTrail, trail.frag)
// behind it, shown at TRAIL_SHOW of its strength. The brighter wins, never
// added: added, trails washed the picture out at high frame rates (0.4.0's
// first build). Shown dimmed, a trail is a soft afterglow behind the net,
// never as bright as what left it.

uniform sampler2D uFresh;
uniform sampler2D uTrail;

in vec2 vUv;
out vec4 outColor;

const float TRAIL_SHOW = 0.4;

void main() {
  outColor = vec4(max(texture(uFresh, vUv).rgb, texture(uTrail, vUv).rgb * TRAIL_SHOW), 1.0);
}
