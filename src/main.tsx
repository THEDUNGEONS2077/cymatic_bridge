/**
 * src/main.tsx: the first code to run: the scene, at once.
 *
 * Layer: entry point (first stage). cyberdeck's two-stage start: this holds
 * only the styles, the palette, the stage (scene/host.ts) and the listen
 * loop (audio/listen.ts), so it's small and runs as soon as it arrives. The
 * idle breath is on screen while the rest of the app (React, storage, the
 * HUD: start.tsx) is still loading, in parallel.
 */
import './styles/theme.css';
import './styles/app.css';

import { startListening } from './audio/listen';
import { sceneHint } from './hint';
import { applyPalette } from './palette';
import { startStage } from './scene/host';
import { liveStore } from './store/live';

// The last visit's scene in its colours, then the loop that feeds it (idle until LISTEN).
const hint = sceneHint();
applyPalette(hint.settings.palette);
startStage(hint.id, hint.settings, (message) => liveStore.getState().showNotice(message));
startListening();

// The app: storage, then the HUD (its own chunk, fetched in parallel).
void import('./start');
