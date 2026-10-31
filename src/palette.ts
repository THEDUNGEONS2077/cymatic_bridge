/**
 * src/palette.ts: puts a colour palette on the page (the HUD's colours).
 *
 * Layer: entry point helper (DOM, no React, no stores). cyberdeck's, renamed.
 * The HUD takes the showing scene's palette (R13: palettes are per scene),
 * so the bar always matches the visual under it. A palette (lib/palettes.ts)
 * sets the base colour tokens on <html>; theme.css mixes every other colour
 * from them.
 */
import { findPalette, PALETTE_TOKENS, type PaletteColors, type PaletteId } from '@/lib/palettes';

/** The palette on the page now. */
let current: PaletteId | null = null;

/** Sets palette `id`'s colours on the page. True if that changed the colours. */
export function applyPalette(id: string): boolean {
  const palette = findPalette(id);
  if (palette.id === current) return false;
  current = palette.id;
  const root = document.documentElement;
  for (const [key, token] of Object.entries(PALETTE_TOKENS) as [keyof PaletteColors, string][]) root.style.setProperty(token, palette.colors[key]);
  root.dataset.palette = palette.id;
  return true;
}
