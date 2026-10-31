/**
 * src/app/TopBar.tsx: the HUD: one thin full-width bar along the top (R11).
 *
 * Layer: UI. Left: the brand, then LISTEN (or SWITCH and STOP while
 * listening). Middle: the shared tab's title (R9; filled by the title bridge
 * in S2, empty until then). Right: the scene, with ‹ › to step through them.
 * SETTINGS joins on the right in S3. Every control is a real button with a
 * name a screen reader reads, at least 24 px tall (cyberdeck's axe rules).
 */
import { listen, stopListening } from '@/audio/listen';
import { findScene } from '@/lib/scenes';
import { useSettings } from '@/store/instance';

import { useLive } from './useLive';

/** The top bar. */
export function TopBar() {
  const capture = useLive((s) => s.capture);
  const title = useLive((s) => s.title);
  const scene = useSettings((s) => s.settings.scene);
  const stepScene = useSettings((s) => s.stepScene);
  const name = findScene(scene).name;

  return (
    <header className="topbar" role="banner">
      <div className="topbar-left">
        <span className="brand">&lt;cymatic_bridge&gt;</span>
        {capture === 'live' ? (
          <>
            <button type="button" className="btn" onClick={() => void listen()} title="Share another tab instead">
              SWITCH
            </button>
            <button type="button" className="btn" onClick={stopListening} title="Stop listening">
              STOP
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void listen()} disabled={capture === 'asking'} title="Share a tab’s sound: pick the YouTube tab">
            {capture === 'asking' ? 'PICK A TAB…' : 'LISTEN'}
          </button>
        )}
      </div>
      <div className="topbar-title" aria-live="polite">
        {title ? <span className="title">{title}</span> : null}
      </div>
      <div className="topbar-right">
        <button type="button" className="btn btn-icon" onClick={() => stepScene(-1)} aria-label="Previous scene" title="Previous scene (←)">
          ‹
        </button>
        <span className="scene-name" aria-label={`Scene: ${name}`}>
          {name}
        </span>
        <button type="button" className="btn btn-icon" onClick={() => stepScene(1)} aria-label="Next scene" title="Next scene (→)">
          ›
        </button>
      </div>
    </header>
  );
}
