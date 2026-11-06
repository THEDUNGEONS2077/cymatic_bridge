// src/scene/scenes/coderain/beam.frag: the scan's beam and its point (the
// user's pick, SCAN, bouncing: monitor.ts).
//
// A full-screen pass scissored to the beam's strip (engine.ts). The beam: a
// soft column of light up and down the view at the scan, brightest at the
// horizon (the mock-ups' glow, stretched tall: an ellipse uBeam.y wide and
// 0.62 of the view tall), brighter while the heartbeat spikes. The point: a
// bright spark where the trace is being written, a near-white middle and a
// body in the beam's colour. Drawn additively, dithered.

uniform vec2 uCentre;   // the vanishing point, on the horizon (device px)
uniform vec3 uBeam;     // x, half-width (device px), brightness
uniform float uBand;    // the band under the scan (its colour)
uniform vec3 uSpark;    // x, y, radius (device px)
out vec4 outColor;

void main() {
  vec2 p = gl_FragCoord.xy;
  vec3 tint = freqColor(uBand, 0.25);
  vec2 u = vec2((p.x - uBeam.x) / uBeam.y, (p.y - uCentre.y) / (0.62 * uRes.y));
  float r2 = dot(u, u);
  vec3 col = tint * (uBeam.z * 0.85 * exp(-r2 / (2.0 * 0.28 * 0.28)) * (1.0 - smoothstep(0.8, 1.0, sqrt(r2))));
  vec2 s = (p - uSpark.xy) / uSpark.z;
  float s2 = dot(s, s);
  col += (mix(tint, vec3(1.0), 0.5) * exp(-s2 * 50.0) + tint * 0.9 * exp(-s2 * 8.0)) * (0.9 * (1.0 - smoothstep(0.8, 1.0, sqrt(s2))));
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
