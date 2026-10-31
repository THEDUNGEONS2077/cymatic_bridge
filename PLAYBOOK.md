# Playbook

Lessons from cymatic_bridge, written so other projects can reuse them. cyberdeck_terminal's PLAYBOOK has the rest (start pages, workers, WebGL, testing, speed). These are new here.

## 1. A tab's sound in a webpage
**1.1 Only the share picker gets it without an install.** A page can't read another tab's audio, and YouTube's player API gives none. `getDisplayMedia` with tabs only (`displaySurface: 'browser'`, `monitorTypeSurfaces: 'exclude'`, `selfBrowserSurface: 'exclude'`) hands over the chosen tab's audio track. *Where:* `audio/capture.ts`.

**1.2 An extension's `tabCapture` won't fit a button on the page.** It needs `activeTab` on the *target* tab, which only a click on the extension's own icon on that tab grants. A page's button can't capture another tab through it. A `consumerTabId` stream can be used by a web page, but only after that click.

**1.3 Let the tab keep playing.** `suppressLocalAudioPlayback: false` (the default) keeps the tab's own sound, so the page only listens. (`tabCapture`, by contrast, mutes the tab, and the page must play the stream back.)

**1.4 "Share this tab instead" is free.** `surfaceSwitching: 'include'` lets the user move the share to another tab from Chrome's own bar, and the tracks stay the same objects, so the page needs no code for it.

**1.5 Ending a share ends the tracks.** Chrome's Stop sharing and closing the shared tab both fire `ended` on the audio and video tracks: listen on both.

**1.6 A share without "Share tab audio" has no audio track.** Check for one, stop the stream at once (Chrome's sharing bar goes), and say plainly what to tick.

## 2. Testing tab capture in Chromium
**2.1 `--auto-select-tab-capture-source-by-title=<title>` answers the picker,** but only for a tab that existed before the page that asks. A tab opened after it was never picked, and the picker stayed open (2026-10-31). Open the test tabs first.

**2.2 Headless Chrome captures a tab's sound as silence.** The track is live, but every sample is 0 (no audio output to tap). Run headed: on WSL, WSLg's display works. Skip only the sound checks when headless, and say so.

**2.3 Two tabs with the same title: the picker may take either.** Order the paths so it doesn't matter (stop the share before closing tabs, then close all of them).

**2.4 Background tabs' timers run about once a second.** A WebAudio test signal scheduled half a second ahead plays with gaps from a background tab: queue it seconds ahead (`ctx.currentTime + 3`).

## 3. Audio features for visuals
**3.1 One gain for the whole spectrum, plus a tilt.** Per-band auto-gain makes every band look loud, so hiss reads like a kick. One peak follower (up at once, down 2.5 dB/s, with a floor so silence stays dark) keeps the music's shape. A +3.5 dB/octave tilt above 1 kHz levels music's natural fall, so the range weighs evenly. *Where:* `lib/signal/dynamics.ts`, `bands.ts`.

**3.2 Spectral flux with an adaptive threshold finds beats cheaply.** Sum the rises of the bands, scale to a fixed time step (so frame rate doesn't change it), and call it a beat above max(floor, mean + 1.6σ) over ~1.5 s, with a 120 ms refractory. Held notes give no flux. *Where:* `lib/signal/beat.ts`.

**3.3 Make the flash its own, limited channel.** One value (the accent), fired only by strong beats, ≥0.34 s apart (exactly 1/3 s lets a closed second hold four), capped at 0.8. Scenes may flash only with it. Test it with a sliding one-second window at several frame rates. *Where:* `lib/signal/strobe.ts`.

**3.4 A flow clock instead of real time.** `flow += dt × (0.25 + 1.75 × level)`: motion that speeds up with the music, and never jumps or reverses.

**3.5 Idle is a synthetic signal, not a special case.** After 1.5 s of silence, blend the bands into a slow breath; scenes draw it as they draw music.

## 4. Feedback trails
**4.1 Add a flash before the trail mix, never after.** `col = max(col + flash, prev × keep)`. Adding the flash after the max stacks it every frame, and the screen settles at flash / (1 − keep): a grey haze (0.1.0's first build).

**4.2 Fade by time, not by frame.** `keep = exp(−dt / τ)` and drift `exp(−k·dt)`, so a 144 Hz screen trails like a 60 Hz one.

**4.3 Half-float targets for fades.** In 8 bits, 0.95 × 3 rounds back to 3: slow fades stick at a dim floor and leave ghosts. RGBA16F (with `EXT_color_buffer_float`) fades to black.

## 5. The SIGNAL texture
**5.1 One small texture carries everything.** RG16F, 64 bands × (now + waveform + a 128-row history ring): 33 KB on the card and 1 KB uploaded a frame. Write history rows at a fixed rate (64 a second), not per frame, so history scrolls the same at any frame rate. Read rows at their centres so linear filtering blends bands but never rows. *Where:* `scene/gl/signalTexture.ts`, `scene/shaders/signal.glsl`.
