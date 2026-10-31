#version 300 es
// src/scene/shaders/fullscreen.vert: the full-screen triangle, from gl_VertexID alone
// (corners at (-1,-1), (3,-1) and (-1,3): it covers the screen with no seam).
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
