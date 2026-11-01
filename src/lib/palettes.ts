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
 * S3 (0.3.0) audition: eight candidates, UV (0.1.0's, hand-made) and seven
 * derived from their neon pair by a script (each role a fixed mix of the
 * accent over black, text colours lifted toward white until they pass the
 * contrast rule). The user tries them on the music and keeps four; the rest
 * are removed before the release.
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
export type PaletteId = 'uv' | 'laser' | 'acid' | 'solar' | 'aurora' | 'toxic' | 'frost' | 'flare';

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
  {
    // laser red over ice cyan.
    id: 'laser',
    label: 'LASER',
    colors: {
      bg: '#000000',
      surface: '#090203',
      surfaceRaised: '#110305',
      line: '#33090f',
      lineLit: '#59101b',
      wash: '#29070c',
      textDim: '#d34b5f',
      text: '#ee576e',
      accent: '#ff2e4d',
      accentDeep: '#8c192a',
      textBright: '#ffcbd2',
      cool: '#5fe3ff',
    },
  },
  {
    // acid green over ultraviolet.
    id: 'acid',
    label: 'ACID',
    colors: {
      bg: '#000000',
      surface: '#060902',
      surfaceRaised: '#0c1103',
      line: '#253309',
      lineLit: '#405910',
      wash: '#1d2907',
      textDim: '#a4d34b',
      text: '#b3ec45',
      accent: '#b8ff2e',
      accentDeep: '#658c19',
      textBright: '#edffcb',
      cool: '#8a5cff',
    },
  },
  {
    // solar orange over deep blue.
    id: 'solar',
    label: 'SOLAR',
    colors: {
      bg: '#000000',
      surface: '#090501',
      surfaceRaised: '#110902',
      line: '#331c06',
      lineLit: '#59300b',
      wash: '#291605',
      textDim: '#d38641',
      text: '#ec8e39',
      accent: '#ff8a1f',
      accentDeep: '#8c4c11',
      textBright: '#ffe2c7',
      cool: '#3a6dff',
    },
  },
  {
    // aurora mint over magenta.
    id: 'aurora',
    label: 'AURORA',
    colors: {
      bg: '#000000',
      surface: '#020906',
      surfaceRaised: '#04110b',
      line: '#0c3323',
      lineLit: '#15593e',
      wash: '#0a291c',
      textDim: '#54d39f',
      text: '#51ecad',
      accent: '#3dffb0',
      accentDeep: '#228c61',
      textBright: '#ceffeb',
      cool: '#ff4fd8',
    },
  },
  {
    // toxic yellow over violet.
    id: 'toxic',
    label: 'TOXIC',
    colors: {
      bg: '#000000',
      surface: '#090802',
      surfaceRaised: '#110f03',
      line: '#332d09',
      lineLit: '#594f10',
      wash: '#292407',
      textDim: '#d3c04b',
      text: '#ecd645',
      accent: '#ffe32e',
      accentDeep: '#8c7d19',
      textBright: '#fff8cb',
      cool: '#a04dff',
    },
  },
  {
    // frost white-blue over indigo.
    id: 'frost',
    label: 'FROST',
    colors: {
      bg: '#000000',
      surface: '#060809',
      surfaceRaised: '#0a0e11',
      line: '#202b33',
      lineLit: '#384c59',
      wash: '#192329',
      textDim: '#94b9d3',
      text: '#9fcdec',
      accent: '#9fd8ff',
      accentDeep: '#57778c',
      textBright: '#e7f5ff',
      cool: '#5b5bff',
    },
  },
  {
    // hot pink over electric cyan.
    id: 'flare',
    label: 'FLARE',
    colors: {
      bg: '#000000',
      surface: '#090306',
      surfaceRaised: '#11050c',
      line: '#331024',
      lineLit: '#591c3f',
      wash: '#290d1d',
      textDim: '#d360a1',
      text: '#ec5faf',
      accent: '#ff4fb3',
      accentDeep: '#8c2b62',
      textBright: '#ffd3ec',
      cool: '#2ee6ff',
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
