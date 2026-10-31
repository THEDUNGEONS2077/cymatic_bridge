/**
 * src/audio/capture.ts: asking Chrome for a tab's sound.
 *
 * Layer: audio (browser APIs; no React, no stores). A webpage can't read
 * another tab's audio by itself, and YouTube's player gives no sound data,
 * so LISTEN uses Chrome's share picker (getDisplayMedia): the user picks the
 * YouTube tab, and the page gets that tab's audio as a stream (R5). Only the
 * shared tab is heard (R6). The options:
 *   - tabs only: no screens, no windows (`displaySurface: 'browser'`,
 *     `monitorTypeSurfaces: 'exclude'`), not this page itself
 *     (`selfBrowserSurface: 'exclude'`), no system audio;
 *   - `surfaceSwitching: 'include'`: Chrome shows "Share this tab instead"
 *     on other tabs, so the user can move the capture without the picker
 *     (the stream's tracks stay the same, so nothing here changes);
 *   - the audio raw: no echo cancelling, noise suppression or auto gain
 *     (SIGNAL does its own gain), and the tab keeps playing its own sound
 *     (`suppressLocalAudioPlayback: false`): the page only listens, it never
 *     plays the music back.
 * Chrome always captures video with it. The video track is kept, not drawn:
 * it carries the capture handle the title bridge will use (S2), and stopping
 * it would end the share.
 */

/** Why asking failed. */
export type CaptureFailure =
  /** The user closed the picker: nothing to say. */
  | 'cancelled'
  /** A tab was shared without "Share tab audio" (R8). */
  | 'no-audio'
  /** The browser can't share tabs at all. */
  | 'unsupported'
  /** Anything else (the browser's message). */
  | 'failed';

/** The result of asking: a stream with an audio track, or why not. */
export type CaptureResult = { ok: true; stream: MediaStream } | { ok: false; why: CaptureFailure; message?: string };

/** The options Chrome's picker is opened with (exported for the tests). */
export const CAPTURE_OPTIONS = {
  // A video track is required; one frame a second at most keeps it nearly free.
  video: { frameRate: 1, width: { max: 320 }, height: { max: 180 } },
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
  displaySurface: 'browser',
  monitorTypeSurfaces: 'exclude',
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  systemAudio: 'exclude',
  preferCurrentTab: false,
} as const;

/** Opens Chrome's picker for a tab's sound. Must run inside a click (the browser requires one). */
export async function captureTab(): Promise<CaptureResult> {
  if (!navigator.mediaDevices?.getDisplayMedia) return { ok: false, why: 'unsupported' };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia(CAPTURE_OPTIONS as DisplayMediaStreamOptions);
  } catch (e) {
    // NotAllowedError: the picker was closed (or sharing is blocked by policy).
    if (e instanceof DOMException && e.name === 'NotAllowedError') return { ok: false, why: 'cancelled' };
    return { ok: false, why: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
  if (!stream.getAudioTracks().length) {
    // Shared without its sound: let it go at once (Chrome's sharing bar disappears).
    stopStream(stream);
    return { ok: false, why: 'no-audio' };
  }
  return { ok: true, stream };
}

/** Ends a share: stops every track (Chrome's sharing bar goes). */
export function stopStream(stream: MediaStream): void {
  for (const t of stream.getTracks()) t.stop();
}
