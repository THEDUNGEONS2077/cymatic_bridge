/**
 * src/lib/palettes.ts: the colour palettes.
 *
 * Layer: lib (pure data and maths). cyberdeck_terminal's structure: a
 * palette is the handful of base colours theme.css's tokens are built from
 * (everything else is mixed from these), and scenes take the same base
 * colours. cymatic_bridge's palettes are its own (R21: a fresh set of neon
 * pairs on true black, an accent and a second, cool hue). Scenes map
 * frequency onto the pair (bass toward the accent, treble toward the cool
 * hue) and flash the bright text colour on beat accents (R22).
 *
 * 0.1.0 has one provisional palette, UV, to build SIGNAL with. Phase S3
 * makes the first four (proposed, the user picks) and adds the per-scene
 * PALETTE setting.
 *
 * The design system's rule holds for every palette: every text colour
 * (dim, text, accent, bright) passes WCAG AA (4.5:1) on every background
 * it's drawn on (bg, surface, raised), and bright text on the wash. A unit
 * test checks it.
 */

/** A palette's base colours (`#rrggbb`), by token. */
export interface PaletteColors {
  /** --bg: the page behind everything. True black in every palette. */
  bg: string;
  /** --surface and --surface-raised: panels, and panels on panels. */
  surface: string;
  surfaceRaised: string;
  /** --line: frames and rules; --line-lit: a lit frame (the accent at ~35% over black, as a solid colour). */
  line: string;
  lineLit: string;
  /** --xp-wash: a selected thing's background. */
  wash: string;
  /** --text-dim, --text, --accent, --text-bright: text, in rising importance. */
  textDim: string;
  text: string;
  accent: string;
  /** --accent-deep: the accent's dark end. */
  accentDeep: string;
  textBright: string;
  /** --cool: the pair's second hue (the treble end of frequency colour). */
  cool: string;
}

/** The palettes' ids. Stored in settings: never change one once released. */
export type PaletteId = 'uv';

/** A palette: its id, its name, its colours. */
export interface Palette {
  id: PaletteId;
  label: string;
  colors: PaletteColors;
}

/** Every palette, in the order the settings list them. */
export const PALETTES: readonly Palette[] = [
  {
    // Provisional (0.1.0): ultraviolet over an acid teal, to build SIGNAL with until S3's four.
    id: 'uv',
    label: 'UV',
    colors: {
      bg: '#000000',
      surface: '#07050d',
      surfaceRaised: '#0e0a18',
      line: '#261a3d',
      lineLit: '#3d1a5c',
      wash: '#1e0838',
      textDim: '#a173e0',
      text: '#bb8ef0',
      accent: '#c25bff',
      accentDeep: '#6a2aa8',
      textBright: '#ecd6ff',
      cool: '#20e0c0',
    },
  },
];

/** The palette ids, in order. */
export const PALETTE_IDS: readonly PaletteId[] = PALETTES.map((p) => p.id);

/** The palette a new scene starts with. */
export const DEFAULT_PALETTE: PaletteId = 'uv';

/** The palette with `id`, or the default one if it's unknown (settings from a newer build, say). */
export function findPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}

/** Each colour and the CSS custom property it sets (theme.css builds the rest from these). */
export const PALETTE_TOKENS: Readonly<Record<keyof PaletteColors, string>> = {
  bg: '--bg',
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  line: '--line',
  lineLit: '--line-lit',
  wash: '--xp-wash',
  textDim: '--text-dim',
  text: '--text',
  accent: '--accent',
  accentDeep: '--accent-deep',
  textBright: '--text-bright',
  cool: '--cool',
};

/** A `#rrggbb` colour's relative luminance (WCAG 2). */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** The WCAG contrast ratio between two `#rrggbb` colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A `#rrggbb` colour as three 0..1 sRGB channels (for shaders). */
export function rgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
