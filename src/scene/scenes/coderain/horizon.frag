// src/scene/scenes/coderain/horizon.frag: the horizon: one straight line of
// light through the vanishing point, its glow following the music, and the
// heart monitor's trace on it.
//
// A full-screen pass scissored to a band round the horizon (engine.ts), so
// only those pixels run. Its light, from the user's picks (S5 mock-ups):
//   - the haze: a faint band of light along the horizon, stronger as the
//     music gets louder;
//   - the glow ("the horizon straight line react by how it glows"): a halo
//     along the line, taller and brighter where its band is loud (bass in the
//     middle, treble toward the edges: bandAlong), lifted by the level, and
//     round the scan (brighter while it writes a spike);
//   - the flat horizon, faint, fading out past the edges;
//   - the trace (monitor.ts: "as if it's a heartbeat pattern line"): the
//     heartbeat the bouncing scan has written, one height per column (uTrace:
//     R the height, G when written). It's drawn as a fine glowing line from
//     the pixel's distance to the nearest of the polyline's segments near it:
//     the nearest, not the sum, so the line is even along its length and the
//     sharp spikes stay sharp. Neighbours written on different passes aren't
//     joined, and a stretch fades as it ages.

uniform sampler2D uTrace;  // COLS × 1, RG32F: R the height (spike heights), G when written (uNow's clock)
uniform float uCols;       // COLS
uniform float uNow;        // the monitor's clock (s)
uniform float uTraceA;     // a spike's height (device px)
uniform vec2 uCentre;      // the vanishing point, on the horizon (device px)
uniform float uLvl;        // the level, eased
uniform float uAt;         // the scan: half-widths from the centre (-1..1)
uniform float uLive;       // how high the heartbeat is at the scan now (|height|)
out vec4 outColor;

// The band shown `a` half-widths from the centre: bass in the middle, treble at the edges. The power gives the bass
// and mids more room and joins the mirrored halves smoothly at the centre.
float bandAlong(float a) {
  return pow(min(a, 1.0), 1.4);
}

// A fine glowing line's light `d` CSS px from it: a bright core and two softer layers round it (the mock-ups' three
// strokes), the outer ones stronger and wider with GLOW.
float lineLight(float d) {
  float g = 0.6 + 0.6 * uGlow;
  float wide = 3.0 + 2.0 * uGlow;
  return exp(-0.5 * (d / 0.6) * (d / 0.6)) + 0.3 * g * exp(-0.5 * (d / 1.5) * (d / 1.5)) + 0.08 * g * exp(-0.5 * (d / wide) * (d / wide));
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float x = (p.x - uCentre.x) / (0.5 * uRes.x);
  float a = abs(x);
  float fade = 1.0 - smoothstep(0.9, 1.12, a);
  float b = bandAlong(a);
  float e = band(b);
  float q = (x - uAt) / 0.05;
  // The glow: its band's loudness (squared: quiet stays calm, loud blooms), lifted by the level, plus the scan's own.
  float glow = min(1.4, 1.6 * e * e * (0.7 + 0.9 * uLvl) + (0.25 + 0.8 * uLive) * exp(-q * q));
  float dy = p.y - uCentre.y;
  float h = uRes.y;
  float k = 0.6 + 0.55 * uGlow;
  // The haze.
  float hh = 0.23 * h * (0.06 + 0.06 * uLvl);
  vec3 col = freqColor(0.5, 0.2) * (0.55 * exp(-0.5 * (dy / hh) * (dy / hh)) * min(1.0, 0.22 + 0.5 * uLvl) * k);
  // The glow's halo.
  float gh = 0.28 * h * (0.008 + 0.055 * glow);
  col += freqColor(b, 0.25) * (1.1 * exp(-0.5 * (dy / gh) * (dy / gh)) * min(1.0, 0.16 + 0.7 * glow) * fade * k);
  // The flat horizon.
  vec3 lineCol = freqColor(b, min(1.0, glow));
  float lineA = fade * min(1.0, 0.45 + 0.6 * glow);
  col += lineCol * (lineA * 0.3 * lineLight(abs(dy) / uDpr));
  // The trace: the nearest segment among the columns within reach of this pixel.
  float reach = 12.0 * uDpr;
  if (dy > -0.4 * uTraceA - reach && dy < 1.1 * uTraceA + reach) {
    float perPx = (uCols - 1.0) / uRes.x;
    float first = floor((p.x - reach) * perPx);
    float last = (p.x + reach) * perPx;
    float best = 1e9;
    float age = 1e9;
    for (int n = 0; n < 48; n++) {
      float c = first + float(n);
      if (c > last) break;
      if (c < 0.0 || c > uCols - 2.0) continue;
      vec2 s0 = texelFetch(uTrace, ivec2(int(c), 0), 0).rg;
      vec2 s1 = texelFetch(uTrace, ivec2(int(c) + 1, 0), 0).rg;
      // Not written yet, or written on different passes (the scan turned between them): not joined.
      if (s0.g < -1e8 || s1.g < -1e8 || abs(s0.g - s1.g) > 0.25) continue;
      vec2 pa = vec2(c / perPx, uCentre.y + s0.r * uTraceA);
      vec2 pb = vec2((c + 1.0) / perPx, uCentre.y + s1.r * uTraceA);
      vec2 ab = pb - pa;
      float t = clamp(dot(p - pa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float d = length(p - (pa + ab * t));
      if (d < best) {
        best = d;
        age = uNow - max(s0.g, s1.g);
      }
    }
    if (best < reach) col += lineCol * (lineA * exp(-age) * lineLight(best / uDpr));
  }
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
