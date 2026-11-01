/**
 * src/lib/scenes.ts: the scenes the page knows, as data: names, default
 * settings and how each reacts.
 *
 * Layer: pure lib. The page (the HUD, settings, the signal engine's profile)
 * needs to know the scenes without loading their drawing code, which lives
 * in the worker (scene/registry.ts maps these ids to engines). This is
 * cyberdeck's catalog.ts / registry.ts split.
 *
 * PLEXUS (0.4.0, S4) is the first real scene: a flight through a plexus
 * (the user's pick of the mock-ups: B2 FLIGHT). TEST, SIGNAL drawn plainly,
 * stays as a development scene, listed last. CODE RAIN EQ and CYMATIC PLATE
 * come next.
 */
import { DEFAULT_PALETTE, type PaletteId } from './palettes';
import { BALANCED, type ReactProfile } from './signal/signal';

/** The glow levels, as cyberdeck's (LOW … MAX). */
export const GLOW_LEVELS = ['low', 'medium', 'high', 'max'] as const;
/** A glow level. */
export type GlowLevel = (typeof GLOW_LEVELS)[number];

/** One scene's own settings (R13: kept per scene). */
export interface SceneSettings {
  palette: PaletteId;
  glow: GlowLevel;
  /** How strongly it reacts, on top of auto-gain (×, SENSITIVITY_STEPS). */
  sensitivity: number;
  /** How long trails last, 0 (none) .. 1 (long), for scenes that draw them. */
  trails: number;
  /** Its ZOOM (ZOOM_STEPS, 1 = as designed). */
  zoom: number;
}

/** A scene, as the page knows it. */
export interface SceneInfo {
  id: string;
  /** Its name in the HUD. */
  name: string;
  /** Its settings until the user changes them. */
  defaults: SceneSettings;
  /** How the music moves it (R20). */
  profile: ReactProfile;
  /** Does it draw trails (the feedback pass)? TRAILS shows only for those. */
  trails: boolean;
  /** A development scene (TEST): listed after the others. */
  dev?: boolean;
}

/** Chrome's own zoom steps, 50% to 200% (cyberdeck's ZOOM). */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
/** SENSITIVITY's steps (×). */
export const SENSITIVITY_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Every scene, in the order ← / → step through them. */
export const SCENES: readonly SceneInfo[] = [
  {
    id: 'plexus',
    name: 'PLEXUS',
    // Trails off by default: the pulse and its marks read clearest without them (the user: "too chaotic / busy").
    defaults: { palette: DEFAULT_PALETTE, glow: 'high', sensitivity: 1, trails: 0, zoom: 1 },
    profile: BALANCED,
    trails: true,
  },
  {
    id: 'test',
    name: 'TEST',
    defaults: { palette: DEFAULT_PALETTE, glow: 'high', sensitivity: 1, trails: 0.5, zoom: 1 },
    profile: BALANCED,
    trails: true,
    dev: true,
  },
];

/** The scene a first visit opens with. */
export const DEFAULT_SCENE = SCENES[0]!.id;

/** The scene with `id`, or the first if it's unknown (settings from a newer build). */
export function findScene(id: string): SceneInfo {
  return SCENES.find((s) => s.id === id) ?? SCENES[0]!;
}

/** The scene `step` places after (or before, negative) `id`, wrapping round. */
export function stepScene(id: string, step: number): string {
  const i = SCENES.findIndex((s) => s.id === id);
  const n = SCENES.length;
  return SCENES[(((i < 0 ? 0 : i) + step) % n + n) % n]!.id;
}
