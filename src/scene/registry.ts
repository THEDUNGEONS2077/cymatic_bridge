/**
 * src/scene/registry.ts: every scene's engine, by id.
 *
 * Layer: scene (worker). The page knows scenes by lib/scenes.ts (names,
 * defaults, profiles) without loading this; the worker looks up the drawing
 * code here. An unknown id gets the first scene (settings from a newer build).
 */
import { plexusScene } from './scenes/plexus/engine';
import { testScene } from './scenes/test/engine';
import type { SceneFactory } from './types';

/** The engines, in no particular order (lib/scenes.ts has the order). */
const FACTORIES: readonly SceneFactory[] = [plexusScene, testScene];

/** The factory for scene `id` (or the first, if unknown). */
export function findFactory(id: string): SceneFactory {
  return FACTORIES.find((f) => f.id === id) ?? FACTORIES[0]!;
}
