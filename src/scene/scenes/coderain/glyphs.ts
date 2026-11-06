/**
 * src/scene/scenes/coderain/glyphs.ts: CODE RAIN EQ's glyph sheet: every
 * glyph drawn once, white, into a grid of cells; its shape in one channel,
 * a soft glow round it in another, for glyph.frag to colour.
 *
 * Layer: scene (worker: OffscreenCanvas 2D, no DOM). The set is cyberdeck's
 * MATRIX RAIN's (its glyphAtlas.ts): half-width katakana, drawn mirrored as
 * in the film, when a system font has them (canDraw: MS Gothic on Windows),
 * then digits, a few Latin letters and symbols, which every computer can
 * draw. Text is the slow part, so the sheet is built once per worker and
 * kept: a scene change or a lost context only uploads it again.
 */

/** Half-width katakana (drawn mirrored). They need a system font. */
export const KATAKANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
/** Digits, a few Latin letters and symbols (cyberdeck's set). */
export const BASE_GLYPHS = '0123456789ZTHEMXAKR:.=*+-<>¦|"';
/** System fonts that have katakana, then any monospace. */
const FONT_STACK = '"MS Gothic", "Yu Gothic", "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans Mono CJK JP", monospace';
/** A cell's size (px) and how many cells across. Glyphs are drawn 0.66 of a cell, leaving room for the glow and for mipmaps not to bleed. */
export const CELL = 64;
const ACROSS = 16;
/** The glow's blur (px): the soft light round each glyph. */
const GLOW_BLUR = 6;

/** The glyph sheet: two channels a pixel (shape, glow), its size, its grid, and which glyphs are where. */
export interface GlyphSheet {
  /** RG8 pixels, top row first: R the glyph's shape, G its glow. */
  data: Uint8Array;
  w: number;
  h: number;
  /** Cells across and down. */
  cols: number;
  rows: number;
  /** How many glyphs, and how many of them (the first) are katakana. */
  count: number;
  kana: number;
}

let sheet: GlyphSheet | null = null;

/** The glyph sheet, built on first use and kept for the worker's life. */
export function glyphSheet(): GlyphSheet {
  sheet ??= buildSheet();
  return sheet;
}

/**
 * Can this computer draw `char`? Draws it beside a code point no font has
 * (U+0378, unassigned) and compares: the same (both blank, or both the
 * "missing glyph" box) means it can't (cyberdeck's canDraw).
 */
function canDraw(char: string): boolean {
  const size = 24;
  const ctx = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const pixels = (c: string) => {
    ctx.clearRect(0, 0, size, size);
    ctx.font = `16px ${FONT_STACK}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(c, size / 2, size / 2);
    return ctx.getImageData(0, 0, size, size).data;
  };
  const a = pixels(char);
  const missing = pixels('͸');
  let blank = true;
  let same = true;
  for (let i = 3; i < a.length; i += 4) {
    if (a[i]) blank = false;
    if (a[i] !== missing[i]) same = false;
  }
  return !blank && !same;
}

/** Draws the sheet: katakana (if this computer can) then the base glyphs, shape and glow, packed into two channels. */
function buildSheet(): GlyphSheet {
  const kana = canDraw('ｱ') ? [...KATAKANA] : [];
  const glyphs = [...kana.map((char) => ({ char, mirrored: true })), ...[...BASE_GLYPHS].map((char) => ({ char, mirrored: false }))];
  const cols = ACROSS;
  const rows = Math.ceil(glyphs.length / cols);
  const w = cols * CELL;
  const h = rows * CELL;
  const data = new Uint8Array(w * h * 2);
  /** The sheet drawn once, white, with a blur of `blur` px round each glyph (0: the bare shapes): its alpha a pixel. */
  const draw = (blur: number): Uint8ClampedArray | null => {
    const ctx = new OffscreenCanvas(w, h).getContext('2d');
    if (!ctx) return null;
    ctx.font = `${Math.round(CELL * 0.66)}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    if (blur) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = blur;
    }
    glyphs.forEach((g, i) => {
      ctx.save();
      ctx.translate(((i % cols) + 0.5) * CELL, (Math.floor(i / cols) + 0.5) * CELL);
      if (g.mirrored) ctx.scale(-1, 1);
      ctx.fillText(g.char, 0, 2);
      ctx.restore();
    });
    return ctx.getImageData(0, 0, w, h).data;
  };
  const shape = draw(0);
  const glow = draw(GLOW_BLUR);
  // Without a 2D context nothing can be drawn: the sheet stays blank (the code is then just light: heads' flares, the warp, the horizon).
  if (shape && glow) {
    for (let i = 0; i < w * h; i++) {
      data[i * 2] = shape[i * 4 + 3]!;
      data[i * 2 + 1] = glow[i * 4 + 3]!;
    }
  }
  return { data, w, h, cols, rows, count: glyphs.length, kana: kana.length };
}
