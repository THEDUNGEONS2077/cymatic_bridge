// src/scene/scenes/coderain/glyph.frag: a glyph of code.
//
// Its shape from the glyph sheet (glyphs.ts: the shape in R, a soft glow round
// it in G), in its colour, the glow as strong as GLOW makes it. A flaring head
// (its quad 2.8× the glyph) adds a soft light round it: a near-white middle
// and a body in its band's colour (the mock-ups' flare). Drawn additively and
// dithered here: CODE RAIN EQ draws straight onto the canvas (stage.ts direct).

uniform sampler2D uSheetTex;
uniform vec2 uSheet;  // the sheet's cells across and down

in vec2 vUv;
flat in vec2 vCell;
flat in float vScale;
flat in vec3 vColor;
flat in float vAlpha;
flat in float vFlare;
flat in vec3 vFlareColor;
out vec4 outColor;

void main() {
  // Where in the glyph's own cell (-1..1); beyond it (a flaring head's quad), no glyph, only the flare.
  vec2 g = vUv * vScale;
  float inside = step(abs(g.x), 1.0) * step(abs(g.y), 1.0);
  vec2 c = clamp(g, -1.0, 1.0);
  // The sheet's rows run down the image: up on the screen is up in the glyph. Sampled everywhere (then masked), so mipmaps see smooth derivatives.
  vec2 uv = vCell + vec2(c.x * 0.5 + 0.5, 0.5 - c.y * 0.5) / uSheet;
  vec2 t = texture(uSheetTex, uv).rg * inside;
  vec3 col = vColor * vAlpha * (t.r + t.g * (0.12 + 0.45 * uGlow));
  if (vFlare > 0.0) {
    float r2 = dot(vUv, vUv);
    col += (mix(vFlareColor, vec3(1.0), 0.5) * exp(-r2 * 50.0) + vFlareColor * 0.9 * exp(-r2 * 8.0)) * vFlare * (1.0 - smoothstep(0.8, 1.0, sqrt(r2)));
  }
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
