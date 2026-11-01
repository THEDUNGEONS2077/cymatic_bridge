/**
 * src/lib/settings.ts: the settings document, everything the page keeps
 * between visits.
 *
 * Layer: pure lib (tested). The user chose the light version of cyberdeck's
 * data safety (R26): one versioned document, every field normalized with
 * its default (so a missing or broken field never breaks the page),
 * migrations for shape changes (migrations.ts), damaged data kept aside,
 * and EXPORT / IMPORT (S3). No snapshots or profiles.
 *
 * Shape (version 1):
 *   { v: 1, scene, hudHidden, bridgeOffer, scenes: { [sceneId]: SceneSettings } }
 * `bridgeOffer` came in 0.2.0 without a version bump: a new field is just
 * normalized with its default (cyberdeck's rule), and older documents read
 * as offering.
 * A scene with no entry uses its defaults (lib/scenes.ts); only changed
 * scenes are stored.
 */
import { findPalette } from './palettes';
import { findScene, GLOW_LEVELS, type SceneSettings, SCENES, SENSITIVITY_STEPS, ZOOM_STEPS } from './scenes';

/** The document's current version. A shape change bumps it and adds a step in migrations.ts. */
export const SETTINGS_VERSION = 1;

/** The settings document. */
export interface Settings {
  v: typeof SETTINGS_VERSION;
  /** The scene showing. */
  scene: string;
  /** Is the HUD hidden (H)? */
  hudHidden: boolean;
  /** Does the bar offer the title bridge when a shared tab has none? (DON'T OFFER AGAIN turns it off.) */
  bridgeOffer: boolean;
  /** Each scene's own settings, where changed. */
  scenes: Record<string, SceneSettings>;
}

/** A first visit's settings. */
export function defaultSettings(): Settings {
  return { v: SETTINGS_VERSION, scene: SCENES[0]!.id, hudHidden: false, bridgeOffer: true, scenes: {} };
}

/** The value in `steps` nearest to `v` (a number from an older or edited file). */
export function nearestStep(steps: readonly number[], v: number): number {
  return steps.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), steps[0]!);
}

/** Scene `id`'s settings from whatever was stored (each field checked, its default where it doesn't fit). */
export function normalizeSceneSettings(id: string, raw: unknown): SceneSettings {
  const d = findScene(id).defaults;
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    palette: typeof r.palette === 'string' ? findPalette(r.palette).id : d.palette,
    glow: GLOW_LEVELS.find((g) => g === r.glow) ?? d.glow,
    sensitivity: num(r.sensitivity) !== null ? nearestStep(SENSITIVITY_STEPS, num(r.sensitivity)!) : d.sensitivity,
    trails: num(r.trails) !== null ? Math.min(1, Math.max(0, num(r.trails)!)) : d.trails,
    zoom: num(r.zoom) !== null ? nearestStep(ZOOM_STEPS, num(r.zoom)!) : d.zoom,
  };
}

/** A version-1 document from whatever was stored, every field checked. Unknown scenes are kept (a newer build's). */
export function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const scenes: Record<string, SceneSettings> = {};
  if (r.scenes && typeof r.scenes === 'object' && !Array.isArray(r.scenes)) {
    for (const [id, s] of Object.entries(r.scenes as Record<string, unknown>)) {
      if (id && id.length <= 64) scenes[id] = normalizeSceneSettings(id, s);
    }
  }
  return {
    v: SETTINGS_VERSION,
    scene: typeof r.scene === 'string' && r.scene.length <= 64 ? r.scene : d.scene,
    hudHidden: typeof r.hudHidden === 'boolean' ? r.hudHidden : d.hudHidden,
    bridgeOffer: typeof r.bridgeOffer === 'boolean' ? r.bridgeOffer : d.bridgeOffer,
    scenes,
  };
}

/** Scene `id`'s settings in force: its stored ones, or its defaults. */
export function sceneSettings(s: Settings, id: string): SceneSettings {
  return s.scenes[id] ?? findScene(id).defaults;
}
