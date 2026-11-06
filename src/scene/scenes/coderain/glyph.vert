// src/scene/scenes/coderain/glyph.vert: one glyph of a stream of code, as a quad.
//
// Instances come in runs of uTrail (engine.ts): each run is one stream (aStream
// and aState advance once a run: their divisor is TRAIL), and an instance's
// place in its run is its glyph's place in the stream: 0 the head, nearest the
// camera, then the trail behind it, uGap farther each. A glyph past the
// stream's length, faded out, or off the screen is hidden. The head is
// near-white (the palette's bright colour) and flares on a beat (bass
// streams); the trail is in its band's colour, fading toward its end, brighter
// with its band's loudness. The scan's beam lights the code it passes
// (uBeam): the nearer, the brighter (the user's pick, SCAN).

layout(location = 0) in vec4 aStream;  // angle, r, z (the head's depth), band
layout(location = 1) in vec4 aState;   // length (glyphs), loudness, flare, unused
layout(location = 2) in uint aGlyph;   // the glyph: its cell in the sheet

uniform float uTrail;    // glyphs a stream can show (rain.ts TRAIL)
uniform float uGap;      // depth between a stream's glyphs
uniform float uDeep;     // how deep the streams reach
uniform float uGlyphPx;  // a glyph's quad at depth 1 (device px)
uniform float uMaxPx;    // the biggest a glyph's quad gets (device px)
uniform vec2 uSheet;     // the sheet's cells across and down
uniform vec3 uBeam;      // the scan's beam: x, half-width (device px), how much it lights

out vec2 vUv;            // -1..1 across the quad
flat out vec2 vCell;     // the glyph's cell in the sheet: its top-left corner (0..1)
flat out float vScale;   // the quad's size over the glyph's (2.8 for a flaring head: room for its glow)
flat out vec3 vColor;
flat out float vAlpha;
flat out float vFlare;   // a head's flare (× its fog), drawn as a glow round it
flat out vec3 vFlareColor;

void main() {
  vec2 q = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  float i = float(gl_InstanceID % int(uTrail));
  float len = aState.x;
  float e = aState.y;
  float z = aStream.z + i * uGap;
  float fog = fogOf(z, uDeep);
  bool head = i < 0.5;
  // The head at full strength; the trail fading toward its end, brighter with its band's loudness.
  float a = head ? fog : pow(1.0 - i / (len + 1.0), 1.5) * (0.3 + 0.7 * e) * fog;
  if (i > len || a < 0.004) {
    gl_Position = HIDDEN;
    return;
  }
  vec2 p = project(aStream.x, aStream.y, z);
  float flare = head ? aState.z : 0.0;
  // A flaring head is drawn larger, and its quad 2.8× wider again for the glow round it.
  float glyph = 0.5 * min(uMaxPx, uGlyphPx / z) * (1.0 + 0.6 * flare);
  float scale = flare > 0.05 ? 2.8 : 1.0;
  float reach = glyph * scale;
  if (p.x < -reach || p.x > uRes.x + reach || p.y < -reach || p.y > uRes.y + reach) {
    gl_Position = HIDDEN;
    return;
  }
  // The beam lights the code under it.
  float dx = (p.x - uBeam.x) / uBeam.y;
  vAlpha = a * (1.0 + uBeam.z * exp(-dx * dx));
  vFlare = flare * 0.7 * fog;
  vFlareColor = freqColor(aStream.w, 0.2);
  vColor = head ? mix(uColBright, vec3(1.0), 0.4) : freqColor(aStream.w, 0.15);
  uint across = uint(uSheet.x);
  vCell = vec2(float(aGlyph % across), float(aGlyph / across)) / uSheet;
  vScale = scale;
  vUv = q;
  gl_Position = clipOf(p + q * reach);
}
