// src/scene/scenes/coderain/view.glsl: CODE RAIN EQ's camera, put in front of
// its vertex shaders (after signal.glsl; engine.ts).
//
// The camera looks down a tunnel of code from its vanishing point, which sits
// on the horizon (the middle of the view): a point at angle a, distance r from
// the axis and depth z ahead lands at uCentre + (cos a, sin a) · r / z ·
// uFocal (device px). Things fade in over the tunnel's far third and out just
// before they reach the camera (fogOf), so nothing pops in or out.

uniform vec2 uCentre;  // the vanishing point (device px)
uniform float uFocal;  // device px per unit at depth 1 (ZOOM included)

// The nearest depth drawn (rain.ts NEAR): closer, a thing has passed the camera.
const float NEAR = 0.3;

// How visible a point at depth z is in a tunnel `deep` units deep.
float fogOf(float z, float deep) {
  return clamp((deep - z) / (deep * 0.35), 0.0, 1.0) * clamp((z - NEAR) / 0.6, 0.0, 1.0);
}

// Where a point at `angle`, `r` from the axis, depth z ahead lands (device px).
vec2 project(float angle, float r, float z) {
  return uCentre + vec2(cos(angle), sin(angle)) * (r / z * uFocal);
}

// Device px to clip space.
vec4 clipOf(vec2 px) {
  return vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}

// Off screen: a vertex placed where nothing is drawn (a hidden instance).
const vec4 HIDDEN = vec4(2.0, 2.0, 2.0, 1.0);
