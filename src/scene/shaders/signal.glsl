// src/scene/shaders/signal.glsl: the SIGNAL include, put in front of every
// scene shader, vertex and fragment alike (scene/gl/program.ts).
//
// Layer: scene shaders (GLSL ES 3.00). Everything a scene needs from the
// music, and the helpers that work in either stage (the fragment-only
// drawing helpers, glowLine and dither, are in draw.glsl):
//   - the signal texture (scene/gl/signalTexture.ts), 64 bands wide:
//       row 0     the bands now (R = left, G = right), 0..1;
//       row 1     the waveform (R), -1..1;
//       rows 2..  the history ring: HISTORY_ROWS past frames of the bands,
//                 the newest at uHead;
//   - the scalars as uniforms (lib/signal/layout.ts SCALAR);
//   - the scene's settings (palette, glow, sensitivity, trails, zoom);
//   - freqColor (frequency → the palette's pair, R22) and accentFlash (the
//     limited beat flash, R18).
// A vertex shader may read the signal too (PLEXUS sizes its links and nodes
// by their bands there): texture reads work in both stages.

precision highp float;
precision highp int;

// The signal.
uniform sampler2D uSignal;
uniform float uHead;
uniform vec4 uGroups;      // bass, low mids, high mids, treble (0..1)
uniform float uLevel;      // overall loudness (0..1)
uniform float uBeat;       // the beat pulse (0..1, decays)
uniform float uBeatCount;  // beats so far
uniform float uAccent;     // the beat accent, already limited (0..0.8)
uniform float uFlow;       // the flow clock (s): faster when loud
uniform float uBalance;    // stereo balance (-1..1)
uniform float uIdle;       // how idle (0..1)
uniform float uTime;       // real time (s)
uniform float uDt;         // this frame's step (s): fades and drifts per second, not per frame

// The canvas and the scene's settings.
uniform vec2 uRes;         // the target's size in device px
uniform float uDpr;        // device px per CSS px (lines are sized in CSS px)
uniform float uZoom;       // ZOOM (1 = as designed)
uniform float uGlow;       // GLOW: 0.25 (LOW) .. 1 (MAX)
uniform float uSensitivity;// SENSITIVITY (×)
uniform float uTrails;     // TRAILS (0..1)
uniform sampler2D uPrev;   // the scene's last frame (black without trails)

// The palette (lib/palettes.ts), sRGB 0..1.
uniform vec3 uColBg;
uniform vec3 uColLine;
uniform vec3 uColDim;
uniform vec3 uColText;
uniform vec3 uColAccent;
uniform vec3 uColBright;
uniform vec3 uColCool;

const float SIG_BANDS = 64.0;
const float HISTORY_ROWS = 128.0;
const float SIG_ROWS = HISTORY_ROWS + 2.0;

// The texture's u for band position x (0 = bass .. 1 = treble): band centres, interpolated between.
float sigU(float x) {
  return (clamp(x, 0.0, 1.0) * (SIG_BANDS - 1.0) + 0.5) / SIG_BANDS;
}

// The v of row r's centre (rows are never blended: always read at a centre).
float sigV(float r) {
  return (r + 0.5) / SIG_ROWS;
}

// Both channels at x now, after SENSITIVITY.
vec2 bandLR(float x) {
  return min(texture(uSignal, vec2(sigU(x), sigV(0.0))).rg * uSensitivity, vec2(1.0));
}

// The mean of both channels at x now.
float band(float x) {
  vec2 lr = bandLR(x);
  return (lr.x + lr.y) * 0.5;
}

// The waveform at x (0..1 across its window), -1..1.
float wave(float x) {
  return texture(uSignal, vec2(sigU(x), sigV(1.0))).r;
}

// Both channels at x, `age` ago (0 = the newest history row .. 1 = the oldest, ~2 s), eased between rows.
vec2 pastLR(float x, float age) {
  float r = clamp(age, 0.0, 1.0) * (HISTORY_ROWS - 1.0);
  float i = floor(r);
  float r0 = 2.0 + mod(uHead - i + HISTORY_ROWS, HISTORY_ROWS);
  float r1 = 2.0 + mod(uHead - i - 1.0 + HISTORY_ROWS, HISTORY_ROWS);
  vec2 a = texture(uSignal, vec2(sigU(x), sigV(r0))).rg;
  vec2 b = texture(uSignal, vec2(sigU(x), sigV(r1))).rg;
  return min(mix(a, b, r - i) * uSensitivity, vec2(1.0));
}

// The mean of both channels at x, `age` ago.
float past(float x, float age) {
  vec2 lr = pastLR(x, age);
  return (lr.x + lr.y) * 0.5;
}

// A level with SENSITIVITY applied.
float sens(float v) {
  return min(v * uSensitivity, 1.0);
}

// Frequency → colour (R22): the bass at the accent, the treble at the cool hue,
// through their mix, lifted a little toward bright where loud (energy 0..1).
vec3 freqColor(float x, float energy) {
  vec3 c = mix(uColAccent, uColCool, smoothstep(0.0, 1.0, clamp(x, 0.0, 1.0)));
  return mix(c, uColBright, 0.35 * energy * energy);
}

// The beat accent as a flash colour (R18: already limited to 3 a second, at most 0.8).
vec3 accentFlash(float strength) {
  return uColBright * uAccent * strength;
}

// How much of the last frame a trail keeps this frame: TRAILS sets how long
// a trail lasts (0.05 s .. 0.8 s to fade to a third), per second, so a 144 Hz
// screen trails as long as a 60 Hz one. 0 when TRAILS is off.
float trailKeep() {
  if (uTrails < 0.001) return 0.0;
  return exp(-uDt / mix(0.05, 0.8, uTrails));
}

// Screen position in CSS px, centred, zoomed (ZOOM: as if the screen were 1/zoom as big).
vec2 sceneCoord(vec2 fragCoord) {
  return (fragCoord - 0.5 * uRes) / uDpr / uZoom;
}
