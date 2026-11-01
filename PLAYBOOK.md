# Playbook

Lessons from cymatic_bridge, written so other projects can reuse them. cyberdeck_terminal's PLAYBOOK has the rest (start pages, workers, WebGL, testing, speed). These are new here.

## 1. A tab's sound in a webpage
**1.1 Only the share picker gets it without an install.** A page can't read another tab's audio, and YouTube's player API gives none. `getDisplayMedia` with tabs only (`displaySurface: 'browser'`, `monitorTypeSurfaces: 'exclude'`, `selfBrowserSurface: 'exclude'`) hands over the chosen tab's audio track. *Where:* `audio/capture.ts`.

**1.2 An extension's `tabCapture` won't fit a button on the page.** It needs `activeTab` on the *target* tab, which only a click on the extension's own icon on that tab grants. A page's button can't capture another tab through it. A `consumerTabId` stream can be used by a web page, but only after that click.

**1.3 Let the tab keep playing.** `suppressLocalAudioPlayback: false` (the default) keeps the tab's own sound, so the page only listens. (`tabCapture`, by contrast, mutes the tab, and the page must play the stream back.)

**1.4 "Share this tab instead" is free.** `surfaceSwitching: 'include'` lets the user move the share to another tab from Chrome's own bar, and the tracks stay the same objects, so the page needs no code for it.

**1.5 Ending a share ends the tracks.** Chrome's Stop sharing and closing the shared tab both fire `ended` on the audio and video tracks: listen on both.

**1.6 Make the AudioContext inside the click, before awaiting the picker.** Made after `await getDisplayMedia`, it can start suspended, and every analyser frame is then silence. The first share was silent in tests until the context moved into the click (0.1.1).

**1.9 Chrome's "sharing this tab" bar can't be hidden at all.** It's Chrome's security indicator on the captured tab: in Chromium's `tab_sharing_infobar_delegate.cc` it's not closeable (`IsCloseable()` returns false) and never expires; its buttons are Stop and "Share this tab instead" (`surfaceSwitching` adds or removes that one). 0.4.3 told users to press a Hide button: that's the *screen*-sharing bar's, not the tab-sharing bar's, and the user found it doesn't exist. Check the browser's own source before telling a user what its UI does (0.4.4).

**1.7 A share without "Share tab audio" has no audio track.** Check for one, stop the stream at once (Chrome's sharing bar goes), and say plainly what to tick.

**1.8 The capture handle tells a capturer which tab it has.** A page (or an extension's content script on it: the isolated world can call it) runs `navigator.mediaDevices.setCaptureHandleConfig({ handle, permittedOrigins })`. Whoever captures that tab reads `videoTrack.getCaptureHandle().handle`, and gets `capturehandlechange` each time it's set again. A title bridge needs no permissions and no messaging, and the label is always the captured tab's own. Limit `permittedOrigins` to your own pages. *Where:* `bridge/title.js`, `audio/listen.ts`.

## 2. Testing tab capture in Chromium
**2.1 `--auto-select-tab-capture-source-by-title=<title>` answers the picker,** but only for a tab that existed before the page that asks. A tab opened after it was never picked, and the picker stayed open (2026-10-31). Open the test tabs first.

**2.2 Headless Chrome captures a tab's sound as silence.** The track is live, but every sample is 0 (no audio output to tap). Run headed: on WSL, WSLg's display works. Skip only the sound checks when headless, and say so.

**2.3 Two tabs with the same title: the picker may take either.** Order the paths so it doesn't matter (stop the share before closing tabs, then close all of them).

**2.4 On WSLg, covered windows run at about 1 fps.** Headed test windows are drawn on the Windows desktop; with another window in front of them, `requestAnimationFrame` runs at about 1 Hz, whatever Chrome's anti-throttling flags say. Timing tests need them uncovered.

**2.6 Feed a headless test real music from inside the page.** Replace `navigator.mediaDevices.getDisplayMedia` in an init script with a function returning a WebAudio `MediaStreamDestination`'s audio track (kicks over a tone) plus a canvas's `captureStream` video track. The real analysis, beats and scenes then hear music headless, every run, with no window to be throttled. Only the picker itself goes unchecked. *Where:* `e2e/walk.mjs`.

**2.5 Background tabs' timers run about once a second.** A WebAudio test signal scheduled half a second ahead plays with gaps from a background tab: queue it seconds ahead (`ctx.currentTime + 3`).

## 3. Audio features for visuals
**3.1 One gain for the whole spectrum, plus a tilt.** Per-band auto-gain makes every band look loud, so hiss reads like a kick. One peak follower (up at once, down 2.5 dB/s, with a floor so silence stays dark) keeps the music's shape. A +3.5 dB/octave tilt above 1 kHz levels music's natural fall, so the range weighs evenly. *Where:* `lib/signal/dynamics.ts`, `bands.ts`.

**3.2 Spectral flux with an adaptive threshold finds beats cheaply.** Sum the rises of the bands, scale to a fixed time step (so frame rate doesn't change it), and call it a beat above max(floor, mean + 1.6σ) over ~1.5 s, with a 120 ms refractory. Held notes give no flux. *Where:* `lib/signal/beat.ts`.

**3.3 Make the flash its own, limited channel.** One value (the accent), fired only by strong beats, ≥0.34 s apart (exactly 1/3 s lets a closed second hold four), capped at 0.8. Scenes may flash only with it. Test it with a sliding one-second window at several frame rates. *Where:* `lib/signal/strobe.ts`.

**3.4 A flow clock instead of real time.** `flow += dt × (0.25 + 1.75 × level)`: motion that speeds up with the music, and never jumps or reverses.

**3.5 Idle is a synthetic signal, not a special case.** After 1.5 s of silence, blend the bands into a slow breath; scenes draw it as they draw music.

**3.6 An analyser's lag is about half its window.** Its window weighs the middle most, so fftSize 4096 at 48 kHz reports ~43 ms ago. Use a long window only for spectral detail, and read beats from a short one (fftSize 512, ~5 ms) with a handful of coarse bands and their own gain. Scale flux to a fixed band count, so one threshold fits both (0.1.1).

**3.7 Draw when the data arrives, not on the worker's own frame.** A worker drawing at its own `requestAnimationFrame` uses data posted after it may already have run: up to a frame late. Drawing in the message handler commits with that task (0.1.1).

**3.8 Flow-control a worker you post frames to.** Drawing each posted frame as it arrives (3.7) floods the worker's queue when it's slower than the poster. Then lag grows without end, and every other message waits behind the queue. Have the worker answer each frame, and keep at most one in flight; newer frames wait on the poster, keeping only the newest (0.2.0). *Where:* `scene/host.ts` `postSignal`.

## 4. Feedback trails
**4.1 Add a flash before the trail mix, never after.** `col = max(col + flash, prev × keep)`. Adding the flash after the max stacks it every frame, and the screen settles at flash / (1 − keep): a grey haze (0.1.0's first build).

**4.2 Fade by time, not by frame.** `keep = exp(−dt / τ)` and drift `exp(−k·dt)`, so a 144 Hz screen trails like a 60 Hz one.

**4.3 Half-float targets for fades.** In 8 bits, 0.95 × 3 rounds back to 3: slow fades stick at a dim floor and leave ghosts. RGBA16F (with `EXT_color_buffer_float`) fades to black.

**4.4 Never add a frame onto its own trail.** Drawing new light additively onto the faded last frame adds a still thing to itself every frame: it settles at 1 / (1 − keep) of its brightness, about 30× at 144 Hz, and the picture washes out. Keep the brighter of the two instead (0.4.0).

**4.5 Keep the trail at full strength; show it dimmed.** A trail shown as stored starts as bright as what left it. Keep the history in a buffer of its own (two, ping-ponged), and lay it behind the live picture at a fraction (0.4). Streaks keep their length but never compete with the live picture (0.4.0: "still too intense").

## 5. The SIGNAL texture
**5.1 One small texture carries everything.** RG16F, 64 bands × (now + waveform + a 128-row history ring): 33 KB on the card and 1 KB uploaded a frame. Write history rows at a fixed rate (64 a second), not per frame, so history scrolls the same at any frame rate. Read rows at their centres so linear filtering blends bands but never rows. *Where:* `scene/gl/signalTexture.ts`, `scene/shaders/signal.glsl`.

**4.6 Find a frame's cost by leaving parts out.** Throwaway builds that skip one draw each (no links, no nodes, neither, links as slivers) told PLEXUS's cost in four runs: links, and their vertices more than their pixels. Guessing (fading near things, shrinking quads) had bought almost nothing (0.4.1).

**4.7 When most instances are hidden, send only the visible ones.** A static buffer plus a per-frame state buffer looks cheaper, but every instance still runs its vertices. With two-thirds of a net absent and more out of view, culling on the CPU and packing the visible ones into a buffer made once (bufferSubData) ran 3× the net as fast as the old one (0.4.1).

**4.8 Keep only what measures faster.** Working each link's loudness out on the CPU (so no vertex reads the signal texture) measured no faster, so it was reverted: simpler wins a tie.

**4.9 Let a scene skip the stage's buffer when it can.** A stage that draws every scene into a buffer and composites it onto the canvas pays a full-screen pass a frame. Its share showed in a run that drew nothing: 38 fps of a software frame. A scene that needs no last frame from the stage can draw straight onto the canvas; it must then dither its own output. Rounding each fragment up or down at random (`floor(c × 255 + noise) / 255`) keeps additive glows seamless on 8 bits. +30% for PLEXUS (0.4.2).

**4.10 A camera following a path of straight segments should follow its speed, smoothed, not its position.** Each segment points another way, so the forward component jumps at every corner. Glide at the smoothed speed, and correct the distance slowly. Test it by the largest frame-to-frame change in speed: an average can't tell a jump from the same change spread out (0.4.2).

## 6. Finding a scene with the user
**6.1 Mock-ups first, in rounds.** Three directions on one page, driven by one synthetic track (with optional sound, and the real palettes), published for the user. Then variations of the one they pick. Canvas 2D is enough to judge a direction; the build is the real thing (`mockups/`).

**6.2 When a build is wrong, ask before rebuilding.** PLEXUS's second build, more motion everywhere, was "too chaotic / busy". Four questions (the view, what the pulse is, how the net changes, what felt wrong) gave the third design, which landed: "This is perfect". Motion should have one focus; the rest is the stage.

**6.3 Perspective crowds the far field into the centre.** In a flight, everything far away projects near the middle; additive light piles up into a white knot. Fade the far field over a long curve (the far half), not just its last stretch.
