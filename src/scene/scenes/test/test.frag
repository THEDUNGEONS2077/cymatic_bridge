// src/scene/scenes/test/test.frag: TEST, every part of SIGNAL drawn plainly.
//
// Layer: scene shader (signal.glsl is put in front). Laid out on the screen,
// top to bottom:
//   - the waveform, a thin scope line near the top;
//   - the left channel's spectrum, a glowing line rising above the middle,
//     bass at the left; the right channel's mirrored below it;
//   - a ring in the middle that swells with the beat;
//   - the history as a waterfall along the bottom (newest at its top);
//   - the beat accent as a faint flash of the bright colour (limited, R18);
//   - trails: the last frame, drifting outward and fading (TRAILS). The
//     flash goes in before the trail is mixed (max, never added), so flashes
//     fade with the trail instead of stacking frame on frame.
// Colours come from frequency (freqColor) and the palette, nothing else.

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 q = sceneCoord(gl_FragCoord.xy);
  // Half the screen, in the same zoomed CSS px.
  vec2 half_ = 0.5 * uRes / uDpr / uZoom;
  // Band position across the middle 90% of the width (0 = bass at the left).
  float x = q.x / (half_.x * 0.9) * 0.5 + 0.5;
  // The bands end at both ends of their span, softened over a few px (no bend past the end).
  float inside = smoothstep(-0.006, 0.0, x) * smoothstep(1.006, 1.0, x);
  float xc = clamp(x, 0.0, 1.0);
  vec2 lr = bandLR(xc);
  vec3 col = vec3(0.0);

  // The spectrum: left above the middle, right mirrored below.
  float base = 0.1 * half_.y;
  float lift = 0.42 * half_.y;
  float fL = q.y - (base + lr.x * lift);
  float fR = q.y + (base + lr.y * lift);
  col += freqColor(xc, lr.x) * glowLine(fL, 1.6) * inside * (0.55 + 0.45 * lr.x);
  col += freqColor(xc, lr.y) * glowLine(fR, 1.6) * inside * (0.55 + 0.45 * lr.y);
  // A faint fill under each line, so loud bands read as mass, not just an edge.
  float underL = step(base, q.y) * step(q.y, base + lr.x * lift);
  float underR = step(q.y, -base) * step(-(base + lr.y * lift), q.y);
  col += freqColor(xc, 0.0) * (underL * lr.x + underR * lr.y) * 0.07 * inside;

  // The waveform, near the top.
  float wy = 0.78 * half_.y;
  float fw = q.y - (wy + wave(xc) * 0.11 * half_.y);
  col += mix(uColDim, uColText, uLevel) * glowLine(fw, 1.0) * inside * 0.8;

  // The beat ring in the middle.
  float r = 14.0 + 46.0 * uBeat + 20.0 * sens(uGroups.x);
  col += mix(uColAccent, uColBright, uBeat) * glowLine(length(q) - r, 1.2) * (0.25 + 0.75 * uBeat);

  // The waterfall: the bottom 40% of the screen, newest at its top, fading with age.
  float top = -0.6 * half_.y;
  if (q.y < top) {
    float age = (top - q.y) / (half_.y - 0.6 * half_.y);
    float v = past(xc, age);
    col += freqColor(xc, v) * v * v * (1.0 - age) * 0.6 * inside;
  }

  // The beat accent: a faint flash of the bright colour.
  col += accentFlash(0.1);

  // Trails: the last frame, drifting out from the centre (0.35 of the way a second) and fading.
  vec2 drift = (vUv - 0.5) * exp(-0.35 * uDt) + 0.5;
  vec3 prev = texture(uPrev, drift).rgb * trailKeep();
  col = max(col, prev);
  outColor = vec4(col, 1.0);
}
