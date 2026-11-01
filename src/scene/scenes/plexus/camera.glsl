// src/scene/scenes/plexus/camera.glsl: PLEXUS's camera, put in front of its
// vertex shaders (after signal.glsl; engine.ts).
//
// The camera flies forward through a box of nodes that wraps round in depth
// (field.ts): a node's depth ahead of it is its z less the camera's, wrapped
// into 0..uDepth. The whole field sways a little, slowly, so the flight
// never looks like a rail. Projection is a plain pinhole: px = centre +
// xy / depth × uScale.

uniform float uCamZ;   // the camera's depth in the box, 0..uDepth (the engine wraps it)
uniform float uDepth;  // the box's depth (field.ts DEPTH)
uniform float uScale;  // device px per world unit at depth 1 (ZOOM included)

// A world point in camera space: x and y swayed, z = depth ahead (never 0).
vec3 toCamera(vec3 p) {
  float z = mod(p.z - uCamZ, uDepth) + 0.05;
  return vec3(p.x + 0.18 * sin(uTime * 0.17), p.y + 0.1 * cos(uTime * 0.13), z);
}

// Camera space to device px.
vec2 project(vec3 c) {
  return 0.5 * uRes + c.xy / c.z * uScale;
}

// How visible at depth z: faded in from the far dark, and out just before
// the camera passes it, so nothing pops in or out. The far fade is long and
// curved (0.4.0's first build faded only the last 2.5 units, and the far
// field, crowded into the centre by perspective, added up to a white knot).
float fogOf(float z) {
  float far = clamp((uDepth - z) / 5.0, 0.0, 1.0);
  return far * far * clamp((z - 0.2) / 0.5, 0.0, 1.0);
}

// Device px to clip space.
vec4 clipOf(vec2 px) {
  return vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}

// Off screen: a vertex placed where nothing is drawn (a hidden instance).
const vec4 HIDDEN = vec4(2.0, 2.0, 2.0, 1.0);
