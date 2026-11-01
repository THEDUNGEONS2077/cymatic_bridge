/**
 * src/app/BridgePanel.tsx: the title bridge's install (or update) steps, in
 * a panel under the bar.
 *
 * Layer: UI. Opened from the bar's GET TITLE BRIDGE / UPDATE TITLE BRIDGE
 * (TopBar.tsx). It says what the bridge does and doesn't do, offers the zip
 * (built next to the page by vite.config.ts), and lists the steps to load
 * it unpacked, as cyberdeck's CONNECT prompt does. DON'T OFFER AGAIN stops
 * the bar from offering it (a setting). Esc or CLOSE closes it.
 */
import { useEffect, useRef } from 'react';

import { useSettings } from '@/store/instance';
import { liveStore } from '@/store/live';

import { useLive } from './useLive';

/** The zip's address, next to the page (vite.config.ts bridgeZip). */
const ZIP_URL = `${import.meta.env.BASE_URL}cymatic-bridge.zip`;

/** The panel. */
export function BridgePanel() {
  const bridge = useLive((s) => s.bridge);
  const setBridgeOffer = useSettings((s) => s.setBridgeOffer);
  const update = bridge === 'old';
  const first = useRef<HTMLAnchorElement>(null);
  const close = () => liveStore.getState().setPanel(null);

  // Focus moves into the panel when it opens; Esc closes it.
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') liveStore.getState().setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="panel" role="dialog" aria-modal="false" aria-labelledby="bridge-title">
      <h2 id="bridge-title" className="panel-title">
        {update ? 'UPDATE THE TITLE BRIDGE' : 'TITLE BRIDGE'}
      </h2>
      <p className="panel-text">
        {update
          ? 'Your title bridge is older than this page expects. The title still shows; the update keeps it working.'
          : 'A webpage can’t read another tab’s title. This small Chrome extension labels YouTube and YouTube Music tabs with their title, so the bar can show the one you share.'}
      </p>
      <p className="panel-text panel-dim">No permissions. It can’t see your other tabs or history, and it sends nothing anywhere.</p>
      <ol className="panel-steps">
        {update ? (
          <>
            <li>Download the zip and unzip it over the old folder.</li>
            <li>In chrome://extensions, press the reload arrow on CYMATIC TITLE BRIDGE.</li>
            <li>Reload your YouTube tab, then SWITCH to it again.</li>
          </>
        ) : (
          <>
            <li>Download the zip and unzip it somewhere you’ll keep it.</li>
            <li>Open chrome://extensions and turn on Developer mode (top right).</li>
            <li>Click Load unpacked and choose the unzipped folder.</li>
            <li>Reload your YouTube tab, then SWITCH to it again.</li>
          </>
        )}
      </ol>
      <div className="panel-actions">
        <a ref={first} className="btn btn-primary btn-link" href={ZIP_URL} download>
          DOWNLOAD ZIP
        </a>
        {update ? null : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setBridgeOffer(false);
              close();
            }}
          >
            DON’T OFFER AGAIN
          </button>
        )}
        <button type="button" className="btn" onClick={close}>
          CLOSE
        </button>
      </div>
    </section>
  );
}
