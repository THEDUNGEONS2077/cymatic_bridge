# Architecture

How cymatic_bridge works, part by part, and why. The look is in [DESIGN.md](DESIGN.md), the requirements (R1–R30) in [PLAN.md](PLAN.md).

1. [Purpose and constraints](#1-purpose-and-constraints)
2. [The code at a glance](#2-the-code-at-a-glance)
3. [Startup](#3-startup)
4. [SIGNAL: the core method](#4-signal-the-core-method)
5. [Capture: LISTEN, SWITCH, STOP](#5-capture-listen-switch-stop)
6. [The stage](#6-the-stage)
7. [The page: HUD, keys, meter](#7-the-page-hud-keys-meter)
8. [Settings and storage](#8-settings-and-storage)
9. [Measurements](#9-measurements)
10. [Testing](#10-testing)
11. [Known limits and next steps](#11-known-limits-and-next-steps)

## 1. Purpose and constraints
A webpage that draws music visuals from the sound of a tab the user shares (R1–R6).
- **A page can't read another tab's sound** on its own, and YouTube's player API gives no audio data. Chrome's share picker (getDisplayMedia) is the only way that needs no install. So LISTEN opens it, tabs only, and the page gets that tab's audio as a stream.
- **An extension could capture without the picker,** but only after a click on the extension icon *on the music tab* (`tabCapture` needs `activeTab` for the target). That doesn't fit a LISTEN button on the page. The title bridge (S2) is the extension's only job.
- **Nothing leaves the browser:** no network code, no analytics.
- **Same origin as cyberdeck_terminal and quest_log_desktop,** so every storage name is this app's own (§ 8).

## 2. The code at a glance
```
src/
  main.tsx          first stage: styles, palette, the stage, the listen loop (tiny)
  start.tsx         second stage: storage, then React and the HUD
  palette.ts        the showing scene's palette onto the page's tokens
  hint.ts           the start-up hint: last scene + settings (localStorage)
  lib/              PURE (tested in Node)
    signal/         SIGNAL: layout, bands, dynamics, beat, strobe, idle, signal (the engine)
    palettes.ts     palettes + WCAG contrast
    scenes.ts       the scene list as data: names, defaults, react profiles
    settings.ts     the settings document; migrations.ts its versions
    sharpness.ts    the pixel-ratio guard (cyberdeck's)
  audio/            browser: capture.ts (the picker), analyser.ts (Web Audio), listen.ts (the loop)
  scene/            canvas code, no DOM in the worker
    host.ts         page side: canvas, worker, size, visibility, the guard, probes
    worker.ts       the worker: messages, frame ring
    stage.ts        WebGL 2: signal texture, scenes, trails, crossfade, composite, lost context
    gl/             program.ts, targets.ts, signalTexture.ts
    shaders/        signal.glsl (the SIGNAL include), fullscreen.vert, composite.frag
    scenes/test/    TEST, the development scene
    registry.ts     scene id → engine
  store/            kv, idbKV, persist (boot), settings (zustand, saved), live (session state), instance
  app/              App, TopBar, Meter, keys, fullscreen
e2e/walk.mjs        the browser walk
```
Imports go downward: `app` → `store` → `lib`. `audio` and `scene` sit beside `store`; only `audio/listen.ts` touches a store (the capture's state).

## 3. Startup
cyberdeck's two stages:
1. **index.html** holds the canvas.
2. **`main.tsx`** (2.5 kB) reads the start-up hint (the last scene and its settings, from localStorage, because IndexedDB answers later). It sets the palette, starts the stage, and starts the listen loop. The idle breath is on screen before React loads.
3. **`start.tsx`** (its own chunk, preloaded by the `preloadApp` Vite plugin) reads the settings from IndexedDB (`store/persist.ts`), makes the store and renders the HUD. App then tells the stage the real scene and settings, which are usually the hint's already.

A service worker (vite.config.ts, cyberdeck's) serves the page from a stored copy of the build, so repeat visits open without the network.

## 4. SIGNAL: the core method
Every scene is "one fragment shader reading one small signal". The audio side reduces the sound to a fixed, tiny feature set each frame. The drawing side gets it as one texture plus a handful of uniforms. Scenes never see audio, and they react the same way on any machine and at any frame rate.

### 4.1 The frame (`lib/signal/layout.ts`)
A `Float32Array` of 204 numbers:
- 64 bands, left channel (0..1, bass first);
- 64 bands, right channel;
- 64 points of waveform (mono, -1..1, scaled to its recent peak);
- 12 scalars:
  - `level`, `bass` (30–150 Hz), `lowMid` (150–600 Hz), `highMid` (600–2500 Hz), `treble` (2.5–16 kHz);
  - `beat`: a pulse that jumps to the beat's strength (0.5..1) and decays over 0.15 s;
  - `beatCount`;
  - `accent`: the limited flash;
  - `flow`: a clock that runs faster when loud;
  - `balance`;
  - `idle`;
  - `cost`: the analysis time, for the meter.

### 4.2 The engine (`lib/signal/signal.ts`), each frame
1. **Bands** (`bands.ts`). The analysers (fftSize 2048: 1024 bins, 23.4 Hz apart at 48 kHz) give decibels per bin. 64 log-spaced bands run from 30 Hz to 16 kHz, each about 1/7 octave. Bands narrower than a bin (below ~400 Hz) read between bins; wider ones average their bins' power. **The tilt:** +3.5 dB an octave above 1 kHz (and less below). Music's spectrum falls about that much, so the tilt levels it: the range weighs evenly (R20).
2. **Gain** (`dynamics.ts`). One peak follower over all bands of both channels: it rises at once and falls 2.5 dB a second, floored at -62 dB. A band reads 0..1 over the 48 dB below the peak. It's one gain, not one per band, because per-band gain lifts the hiss above a bass-heavy track to full. A quiet track still fills the range, and silence stays dark (the floor).
3. **Idle** (`idle.ts`). After 1.5 s with the mean band under 0.02, idle eases to 1 (0.8 s). The bands then blend into a synthetic breath, a 7 s swell drifting across the spectrum (R14). Scenes need no idle code.
4. **Beat** (`beat.ts`). Spectral flux: how much the bands rose since last frame, weighted per group by the scene's profile. The flux is read from a separate short analyser (fftSize 512) as 16 coarse bands with their own gain (§ 4.4); a frame without it (the unit tests) uses the mono bands. It's normalized to a 60th of a second, so a 144 Hz screen finds the same beats. A beat is a flux above max(0.35, mean + 1.6 deviations), with mean and deviation over the last ~1.5 s, at least 0.12 s after the last beat. There are no beats while idle.
5. **Accent** (`strobe.ts`). It fires only on beats of strength 0.6 or more, at least 0.34 s apart, never above 0.8, and decays over 0.2 s. So no closed one-second window can hold more than 3 flashes (WCAG 2.3.1, R18). It's the only value allowed to flash the picture.
6. **Smoothing.** Each band and scalar is eased with the scene's **react profile** (`lib/scenes.ts`: attack/release for bands and for levels, beat weights per group). That's how each scene gets its own feel without code (R20). The balanced default: bands 15 ms up and 140 ms down; levels 10 ms up and 250 ms down; beat weights 1 / 0.6 / 0.35 / 0.25, bass to treble.
7. **Flow.** `flow += dt × (0.25 + 1.75 × level)`. Motion driven by flow speeds up with the music and never jumps or runs backward.

There's no allocation per frame. Before LISTEN, the engine is stepped with silence, so idle takes the same path.

### 4.4 Timing (0.1.1)
The user, on S1: "it doesn't really feel on time". The visuals lagged the sound. The sound plays straight from the tab, while the page's copy comes through Chrome's capture, so some lag can't be removed without playing the sound through the page delayed, which the user declined. Everything else was cut:

| Stage | Before | After |
|---|---|---|
| Spectrum window (an analyser reports about half a window ago) | fftSize 4096, ~43 ms | 2048, ~21 ms |
| Beats | from the spectrum, ~43 ms | a separate fftSize 512 analyser, ~5 ms |
| Levels' attack | 30 ms | 10 ms |
| Page → drawn | the worker's next animation frame (up to one frame later) | drawn as the signal arrives |

### 4.3 On the graphics card (`scene/gl/signalTexture.ts`, `scene/shaders/signal.glsl`)
- **The texture:** RG16F, 64 × 130.
  - Row 0 is the bands now (R = left, G = right).
  - Row 1 is the waveform.
  - Rows 2–129 are a history ring: 128 rows written at a fixed 64 a second (2 s), the newest at `uHead`. A fixed rate keeps history the same speed at any frame rate. After a hidden gap at most a ring's worth is written.
  - Each frame uploads 1 KB.
  - Linear filtering blends neighbouring bands; rows are always read at their centres, so they never blend.
- **The include** (`signal.glsl`) is put in front of every scene's shader:
  - `bandLR(x)`, `band(x)`, `wave(x)`, `pastLR(x, age)`, `past(x, age)`: the signal, with SENSITIVITY applied;
  - `freqColor(x, energy)`: the palette's accent at the bass, the cool hue at the treble, lifted toward bright when loud (R22);
  - `glowLine(f, width)`: cyberdeck's smooth glowing line. Distance in px comes from the field's gradient length, with a bell core and a Gaussian glow scaled by GLOW;
  - `accentFlash`;
  - `trailKeep()`: how much of the last frame a trail keeps, per second;
  - `sceneCoord` (zoomed CSS px) and `dither`.
  - Uniforms: `uGroups`, `uLevel`, `uBeat`, `uBeatCount`, `uAccent`, `uFlow`, `uBalance`, `uIdle`, `uTime`, `uDt`, `uRes`, `uDpr`, `uZoom`, `uGlow`, `uSensitivity`, `uTrails`, `uPrev`, and the palette's `uCol*`.

## 5. Capture: LISTEN, SWITCH, STOP
- **`audio/capture.ts`** opens the picker with these options:
  - tabs only (`displaySurface: 'browser'`, `monitorTypeSurfaces: 'exclude'`, `selfBrowserSurface: 'exclude'`, `systemAudio: 'exclude'`);
  - `surfaceSwitching: 'include'`, so Chrome offers "Share this tab instead" on other tabs. The tracks stay the same, so the page needs no code for it;
  - the audio raw (no echo cancelling, noise suppression or auto gain);
  - `suppressLocalAudioPlayback: false`, so the tab keeps playing its own sound and the page never plays music;
  - a video track, as Chrome requires one. It's kept at ≤1 fps, 320×180, and never drawn. It carries the capture handle for the title bridge, and stopping it would end the share.
  - **Results:** a share without audio is let go at once with a plain notice (R8); a closed picker changes nothing.
- **`audio/analyser.ts`** builds the graph inside the LISTEN click (a context made after the picker's await could start suspended, making the first share silent). The graph: stream → splitter → two AnalyserNodes (left, right, fftSize 2048; smoothing off, since SIGNAL smooths), plus a short mono AnalyserNode for beats (fftSize 512), all → a silent gain → the speakers. The silent gain only makes sure the graph is pulled. A mono stream feeds both analysers.
- **`audio/listen.ts`** runs the loop: read → step → post, every frame while visible.
  - **SWITCH** opens the picker again and reconnects the same graph.
  - **STOP**, or either track ending (Chrome's Stop sharing, the tab closed), goes back to LISTEN while the scene eases into idle (R7).
  - **Hidden:** the loop stops and the context sleeps; the share stays open.

## 6. The stage
- **Page side (`scene/host.ts`).**
  - It sizes the canvas to the window at the screen's pixel ratio, capped by cyberdeck's sharpness guard (`lib/sharpness.ts`): up to 3, stepping back to 2 if the p95 drawing time is over 8 ms after a 1 s settle and a 3 s watch. The guard's verdict is remembered per scene.
  - It stops the worker while hidden.
  - It posts each SIGNAL frame (a structured-clone copy, ~0.8 KB).
  - There's no page fallback: WebGL 2 in a worker is required, and the page says so if it's missing.
- **Worker (`scene/worker.ts`, `scene/stage.ts`).** One WebGL 2 context: no antialias, no alpha, no depth, high-performance. Each frame:
  1. upload the signal;
  2. draw each live scene into its own target. A scene with trails has two half-float targets, swapped each frame: it reads its last frame (`uPrev`) while drawing the next. Half-float because 8-bit fades stick at a dim floor and leave ghosts;
  3. during a crossfade, draw the old scene too (0.6 s, smoothstep, R15);
  4. composite onto the canvas with dither.

  It draws each frame **as the page's SIGNAL frame arrives** (one a screen frame: R16), not at its own next animation frame, which would cost up to a frame of lag. Its own animation frames draw only when no signal has come for 100 ms (before the loop starts, and for probes).
  - **Lost context:** `webglcontextlost` is `preventDefault`ed. On `webglcontextrestored` everything is built again, scenes included.
  - **Frame ring:** each frame's start and drawing time (512 frames), answered at once for the guard and the meter.
- **A scene (`scene/types.ts`)** is a factory: `create(gl)` returns `{ draw(frame), destroy() }`. `frame.bind(program)` sets every uniform the include declares. TEST (`scenes/test/`) is the whole pattern in 30 lines.

## 7. The page: HUD, keys, meter
- **TopBar** (R11): the brand, LISTEN (or SWITCH and STOP), the title (S2), and the scene with ‹ ›. Buttons are real buttons with names, at least 24 px.
- **Keys** (R12, `app/useKeys.ts`): F fullscreen, H HUD, ← / → scenes, D meter. Modifier keys and keys typed into fields are ignored.
- **Fullscreen** follows the browser's own state (`fullscreenchange`). Fullscreen shows the visual only. With the HUD out of sight, the pointer hides after 2 s still.
- **The meter** (D, `app/Meter.tsx`) is a Canvas 2D overlay:
  - bars: the 64 bands (L up, R down), the 4 groups and the level;
  - lights: the beat and the accent;
  - figures, once a second: fps, the draw p95, the SIGNAL cost, flow, idle, balance, beats, the canvas size and the capture state.
- **Notices** show for 6 s under the bar.
- **The HUD's palette** follows the showing scene's palette.

## 8. Settings and storage
- **The document** (`lib/settings.ts`, version 1):
  ```
  { v, scene, hudHidden, scenes: { [id]: { palette, glow, sensitivity, trails, zoom } } }
  ```
  Only changed scenes are stored. Every field is normalized with its default; numbers snap to their steps; a newer build's scenes are kept.
- **Migrations** (`lib/migrations.ts`): a step per version, with a fixture test. Unknown or broken data is refused.
- **Boot** (`store/persist.ts`): refused data is kept under `corrupt.<ms>`, the stored copy is removed, and the defaults are used with a notice. Damaged data is never written over.
- **Saving** (`store/settings.ts`): debounced 300 ms; flushed on `pagehide`.
- **Names:**
  - IndexedDB `cymatic_bridge` (store `kv`, keys `settings.v1` and `corrupt.*`);
  - localStorage `cymatic_bridge:scene` (the start-up hint), `cymatic_bridge:sharp` (the guard's verdicts) and `cymatic_bridge:sharp-budget` (a test knob);
  - caches `cymatic_bridge-*`.

## 9. Measurements
**0.1.0 (2026-10-31).** The walk ran headed on WSLg, which has no GPU, so WebGL is software-rendered. Frame rates here say nothing about the user's machine; use the meter (D) there.

| What | Value |
|---|---|
| First chunk (`main.tsx`) | 2.5 kB (1.2 kB gzipped) |
| Shared chunk (palette, stage host, inlined worker, signal engine) | 33.9 kB (13.7 kB gzipped) |
| App chunk (React, storage, HUD) | 228 kB (72 kB gzipped) |
| SIGNAL analysis | 0.0–0.2 ms a frame (the page's timer is coarse: 0.1 ms steps) |
| Signal upload | 1 KB a frame, plus 256 B per history row (64 a second) |
| Stage drawing, CPU side, p95 | 0.4–0.9 ms a frame |
| TEST, software-rendered, 1600×900 | 14–19 fps (no GPU here; not the user's number) |

## 10. Testing
- **`npm run check`:** typecheck, lint and Vitest. There are 30 tests:
  - SIGNAL on synthetic analyser frames:
    - a sine lands in its band;
    - the tilt;
    - the gain rises at once, falls slowly and keeps its floor;
    - smoothing is the same at 60 and 144 Hz;
    - 120 BPM kicks are found once each (at 60 and 144 Hz, and through the short beat analyser), with none in a steady tone or a slow swell;
    - the strobe never passes 3 flashes in any second at 30, 60 or 144 Hz;
    - idle starts and wakes;
    - the breath stays in range;
    - the engine places a tone, pans and stays in range;
    - flow never goes back.
  - Settings: normalizing, the version-1 fixture, refusals, boot keeping damaged data, the debounced save.
  - The palettes' contrast, and the scene list.
- **`npm run e2e`** (`e2e/walk.mjs`): 9 paths on the built page.
  - Paths:
    - idle before LISTEN;
    - axe;
    - LISTEN then STOP;
    - LISTEN, where the signal wakes, 120 BPM kicks are counted (≥6 in 4 s), bass beats treble, and closing the shared tab ends the share;
    - the meter;
    - H, kept across a reload;
    - ← / →;
    - hidden, where nothing is drawn and it resumes;
    - a lost context restored;
    - the speed report.
  - The music is a routed test tab titled CB-TEST: WebAudio kicks over a 440 Hz tone. The LISTEN path also reports the **beat latency**: each kick's time at the speakers (`getOutputTimestamp`) against when the page saw its beat. `--auto-select-tab-capture-source-by-title` answers the picker.
  - **It runs headed when there's a display.** Headless Chrome captures a tab's sound as silence (PLAYBOOK § 2). Covered by another window on the Windows desktop, WSLg's windows run at about 1 frame a second, and the sound paths fail; run it with nothing in front of it.

## 11. Known limits and next steps
- **There's one scene (TEST) and one palette (UV).** S3 brings the four palettes and the settings drop-down; S4 brings PLEXUS.
- **No title yet:** S2's title bridge sets the shared YouTube tab's capture handle, which the page reads from the video track.
- **GPU time isn't measured** (Chrome hides the timer query); the meter's fps and draw p95 are the guide.
- **Mono tabs:** both analysers hear the one channel, so balance stays centred.
