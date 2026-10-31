/**
 * src/app/App.tsx: the page above the visual: the HUD, the meter, notices,
 * and the link from the settings to the stage.
 *
 * Layer: UI. The visual itself is drawn by the stage (scene/host.ts) on the
 * canvas under #root; this keeps it in step with the settings: whenever the
 * scene or its settings change, the stage, the SIGNAL engine's react profile,
 * the HUD's palette and the start-up hint follow.
 *
 * What shows: the top bar, unless the HUD is hidden (H) or the page is
 * fullscreen (F: only the visual, R12). The meter (D) and a notice show
 * either way. With the HUD out of sight the pointer hides when still.
 */
import { useEffect } from 'react';

import { setReactProfile } from '@/audio/listen';
import { findScene } from '@/lib/scenes';
import { sceneSettings } from '@/lib/settings';
import { saveSceneHint } from '@/hint';
import { applyPalette } from '@/palette';
import { showScene } from '@/scene/host';
import { useSettings } from '@/store/instance';

import { useFullscreenSync, useIdleCursor } from './fullscreen';
import { Meter } from './Meter';
import { TopBar } from './TopBar';
import { useKeys } from './useKeys';
import { useLive } from './useLive';

/** The app. */
export function App() {
  const settings = useSettings((s) => s.settings);
  const immersive = useLive((s) => s.immersive);
  const meter = useLive((s) => s.meter);
  const notice = useLive((s) => s.notice);
  const hudShown = !settings.hudHidden && !immersive;

  useKeys();
  useFullscreenSync();
  useIdleCursor(!hudShown);

  // The scene and its settings → the stage, the engine's profile, the HUD's palette, the hint.
  const scene = findScene(settings.scene);
  const own = sceneSettings(settings, scene.id);
  useEffect(() => {
    showScene(scene.id, own);
    setReactProfile(scene.profile);
    applyPalette(own.palette);
    saveSceneHint(scene.id, own);
  }, [scene, own]);

  return (
    <>
      {hudShown ? <TopBar /> : null}
      {notice ? (
        <p className={`notice${hudShown ? '' : ' notice-top'}`} role="status">
          {notice}
        </p>
      ) : null}
      {meter ? <Meter /> : null}
      {/* The page's one heading, for screen readers (the brand is drawn in the bar). */}
      <h1 className="sr-only">cymatic_bridge music visualizer</h1>
    </>
  );
}
