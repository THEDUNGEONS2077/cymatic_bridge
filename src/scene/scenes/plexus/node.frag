// src/scene/scenes/plexus/node.frag: a node's glow: a near-white core, a
// body in its colour and a soft halo (stronger with GLOW), all smooth
// Gaussians, so a disc has no edge at any size. Drawn additively.

in vec2 vUv;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float core = exp(-r2 / 0.012);
  float body = exp(-r2 / 0.06);
  // The halo reaches the quad's edge at nothing.
  float halo = exp(-r2 / 0.25) * (1.0 - sqrt(r2));
  vec3 col = (mix(vColor, vec3(1.0), 0.5) * core + vColor * (0.9 * body + (0.2 + 0.3 * uGlow) * halo)) * vAlpha;
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  // Dithered here: PLEXUS draws straight onto the canvas (stage.ts direct).
  outColor = vec4(ditherOut(col), 1.0);
}
