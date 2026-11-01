/**
 * src/app/SettingsPanel.tsx: SETTINGS, a drop-down under the bar (R13).
 *
 * Layer: UI. Opened by the bar's SETTINGS button; folds like cyberdeck's
 * SYSTEM (native <details>, so each fold works by keyboard and screen
 * reader with no code of ours):
 *   - SCENE: the showing scene's own settings (they're kept per scene):
 *     PALETTE (swatches), GLOW, SENSITIVITY, TRAILS (scenes that draw
 *     trails), ZOOM, and RESET SCENE;
 *   - BACKUP: EXPORT (a JSON file) and IMPORT (replaces the settings; the
 *     ones before are kept aside in storage);
 *   - DIAGNOSTICS: COPY DIAGNOSTICS (figures to paste back).
 * Every change applies at once (the visual follows: App.tsx). Esc, CLOSE or
 * SETTINGS again closes it.
 */
import { useEffect, useRef } from 'react';

import { readSettingsFile, settingsFile, settingsFileName } from '@/lib/backup';
import { PALETTES } from '@/lib/palettes';
import { findScene, GLOW_LEVELS, SENSITIVITY_STEPS, ZOOM_STEPS } from '@/lib/scenes';
import { sceneSettings } from '@/lib/settings';
import { settingsStore, useSettings } from '@/store/instance';
import { liveStore } from '@/store/live';

import { copyDiagnostics } from './diagnostics';

/** TRAILS's steps (0: off). */
const TRAILS_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

/** A row of − value + for stepping through `steps`. */
function Stepper({ label, steps, value, show, onChange }: { label: string; steps: readonly number[]; value: number; show: (v: number) => string; onChange: (v: number) => void }) {
  const i = steps.indexOf(value);
  return (
    <div className="setting">
      <span className="setting-label" id={`set-${label}`}>
        {label}
      </span>
      <div className="stepper" role="group" aria-labelledby={`set-${label}`}>
        <button type="button" className="btn btn-icon" disabled={i <= 0} onClick={() => onChange(steps[i - 1]!)} aria-label={`${label}: less`}>
          −
        </button>
        <span className="stepper-value" aria-live="polite">
          {show(value)}
        </span>
        <button type="button" className="btn btn-icon" disabled={i < 0 || i >= steps.length - 1} onClick={() => onChange(steps[i + 1]!)} aria-label={`${label}: more`}>
          +
        </button>
      </div>
    </div>
  );
}

/** The panel. */
export function SettingsPanel() {
  const settings = useSettings((s) => s.settings);
  const setSceneSetting = useSettings((s) => s.setSceneSetting);
  const resetScene = useSettings((s) => s.resetScene);
  const scene = findScene(settings.scene);
  const own = sceneSettings(settings, scene.id);
  const set = (patch: Parameters<typeof setSceneSetting>[1]) => setSceneSetting(scene.id, patch);
  const file = useRef<HTMLInputElement>(null);
  const first = useRef<HTMLElement>(null);
  const close = () => liveStore.getState().setPanel(null);
  const notice = (text: string) => liveStore.getState().showNotice(text);

  // Focus moves into the panel when it opens; Esc closes it.
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') liveStore.getState().setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** EXPORT: the settings as a JSON file, downloaded. */
  const exportFile = () => {
    const now = Date.now();
    const blob = new Blob([JSON.stringify(settingsFile(settings, __APP_VERSION__, __APP_BUILD__, now), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = settingsFileName(now);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notice('SETTINGS EXPORTED');
  };

  /** IMPORT: reads the chosen file and replaces the settings (or says why not). */
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    const r = readSettingsFile(await f.text());
    if (!r.ok) {
      notice(`COULDN’T IMPORT · ${r.reason}`);
      return;
    }
    await settingsStore().getState().replaceSettings(r.settings);
    notice('SETTINGS IMPORTED');
  };

  return (
    <section className="panel panel-right" role="dialog" aria-modal="false" aria-labelledby="settings-title">
      <div className="panel-head">
        <h2 id="settings-title" className="panel-title">
          SETTINGS
        </h2>
        <button type="button" className="btn" onClick={close}>
          CLOSE
        </button>
      </div>

      <details className="fold" open>
        <summary ref={first}>SCENE · {scene.name}</summary>
        <div className="setting setting-wide">
          <span className="setting-label" id="set-palette">
            PALETTE
          </span>
          <div className="swatches" role="group" aria-labelledby="set-palette">
            {PALETTES.map((p) => (
              <button key={p.id} type="button" className="swatch" aria-pressed={own.palette === p.id} onClick={() => set({ palette: p.id })} title={p.label}>
                {/* A swatch previews its own palette: the one place raw colours are drawn (cyberdeck's rule). */}
                <span className="swatch-colors" style={{ background: `linear-gradient(90deg, ${p.colors.accent} 0 50%, ${p.colors.cool} 50% 100%)` }} />
                <span className="swatch-label">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <span className="setting-label" id="set-glow">
            GLOW
          </span>
          <div className="choice" role="group" aria-labelledby="set-glow">
            {GLOW_LEVELS.map((g) => (
              <button key={g} type="button" className="btn" aria-pressed={own.glow === g} onClick={() => set({ glow: g })}>
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Stepper label="SENSITIVITY" steps={SENSITIVITY_STEPS} value={own.sensitivity} show={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ sensitivity: v })} />
        {scene.trails ? (
          <Stepper label="TRAILS" steps={TRAILS_STEPS} value={own.trails} show={(v) => (v === 0 ? 'OFF' : `${Math.round(v * 100)}%`)} onChange={(v) => set({ trails: v })} />
        ) : null}
        <Stepper label="ZOOM" steps={ZOOM_STEPS} value={own.zoom} show={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ zoom: v })} />
        <div className="panel-actions">
          <button type="button" className="btn" onClick={() => resetScene(scene.id)} disabled={!settings.scenes[scene.id]}>
            RESET SCENE
          </button>
        </div>
      </details>

      <details className="fold">
        <summary>BACKUP</summary>
        <p className="panel-text panel-dim">Your settings as a file: keep it, or move it to another browser.</p>
        <div className="panel-actions">
          <button type="button" className="btn" onClick={exportFile}>
            EXPORT
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            IMPORT
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </details>

      <details className="fold">
        <summary>DIAGNOSTICS</summary>
        <p className="panel-text panel-dim">Frames, the signal and your browser, to paste back when something looks wrong. The song title isn’t included.</p>
        <div className="panel-actions">
          <button type="button" className="btn" onClick={() => void copyDiagnostics(settings).then((ok) => notice(ok ? 'DIAGNOSTICS COPIED' : 'THE BROWSER WOULDN’T COPY'))}>
            COPY DIAGNOSTICS
          </button>
        </div>
      </details>
    </section>
  );
}
