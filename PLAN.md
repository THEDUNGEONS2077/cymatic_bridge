# cymatic_bridge: requirements, the SIGNAL method, roadmap

## Context
A new project: a music visualizer webpage that reacts to music playing in another Chrome tab (YouTube or YouTube Music). It's built the way cyberdeck_terminal is built, with the same stack, layering, rules, docs, testing and release flow, and it borrows from cyberdeck's looks. The requirements below come from 13 rounds of questions with the user (2026-10-31). The build starts with the **bare bones of SIGNAL**: the one lightweight method every visualization is built on.

---

## 1. Requirements (the user's answers)

### Product
- R1. A **webpage** like quest_log_desktop/cyberdeck, hosted on **GitHub Pages**: public repo `THEDUNGEONS2077/cymatic_bridge`, live at `thedungeons2077.github.io/cymatic_bridge/`, MIT. Ask before creating the repo, pushing, deploying or releasing.
- R2. It's a **full-screen visual with a HUD over it**. The visualizer gets **its own tab**, and the music plays in another tab.
- R3. It **only reacts** to the music, with no playback controls.
- R4. Sources: **YouTube and YouTube Music**. Any tab's sound is captured, but titles come only from those two. Chrome is the target. Edge isn't tested, and there's no mic or line-in input.

### Capture
- R5. A **LISTEN** button opens Chrome's share picker, offering **tabs only**. The picker also shows Chrome's **"Share this tab instead"** button, so you can hop tabs without the picker. The HUD offers **SWITCH** (picker again) and **STOP**.
- R6. **Only the shared tab** is heard and titled, so two playing tabs never get mixed.
- R7. When sharing ends (Stop sharing, the tab closes), the visuals **ease back to idle** and LISTEN shows again. No notice.
- R8. If "Share tab audio" was left off, the HUD says so plainly and stays at LISTEN.

### Title
- R9. Show the **video title only**, with YouTube's " - YouTube" / " - YouTube Music" suffix and the "(N) " notification prefix stripped. It sits **inside the top HUD bar**, not as a separate readout. It follows song changes, including YouTube's in-page navigation.
- R10. The title comes from a small **separate extension**, the "title bridge" (cyberdeck's bridge is untouched). It runs only on youtube.com and music.youtube.com and is **downloaded as a zip from the page**, then loaded unpacked; the page offers an update when the bridge is older. Without it, everything works except the title.

### HUD and keys
- R11. **One thin full-width bar at the top**, holding LISTEN / SWITCH / STOP, the title, the scene picker and SETTINGS.
- R12. **Minimal keys**: **F** fullscreen (as in cyberdeck), **H** hides or shows the HUD, **← / →** change scene, **D** toggles the signal meter. Everything else is by mouse.
- R13. A **settings drop-down** under the top bar, with cyberdeck SYSTEM-style folds.
  - Per scene: PALETTE, GLOW (LOW/MEDIUM/HIGH/MAX), SENSITIVITY, TRAILS, ZOOM (50–200%, Chrome's steps).
  - Global: EXPORT / IMPORT.
  - No SYNC offset.

### Behaviour
- R14. **Idle** (before LISTEN, or silence): the scene keeps **breathing slowly at low energy**.
- R15. **Scene changes**: manual only, with a **~0.6 s crossfade**.
- R16. **Every screen frame is drawn** (no ~72 fps cap). The sharpness guard and adaptive supersampling step down if frames get slow.
- R17. **Nothing is drawn while the tab is hidden**; the stream stays open and drawing resumes at once.
- R18. **No fast strobing**: at most 3 big flashes a second, with the flash brightness capped.
- R19. Reduce Motion is **ignored**: a visualizer is motion by nature. The strobe cap still applies.
- R20. Response is **balanced, tuned per scene**. The frequency range is weighted **evenly**. **Stereo is available** in the signal.

### Look
- R21. A **fresh palette set**: neon pairs on true black (an accent + a second, cool hue, cyberdeck's structure). **Start with 4** and add more later, some made for specific scenes. Each passes the contrast test.
- R22. Colour: **frequency → colour** (a band's place in the spectrum sets its spot between the palette's hues), plus **beat accents** (brief flashes in the brightest colour, under R18).
- R23. cyberdeck's look rules carry over: seamless gradients, smooth glowing lines (distance from the gradient's length, a bell core plus a Gaussian glow), no MSAA, small crisp text, colours only from the palette.
- R24. **Scenes** (each built on SIGNAL):
  - **PLEXUS** (first; from NEURAL NET, **bolder for music**: bigger, brighter nodes, more links, stronger glow). Nodes are **scattered**, each listening to a random band, with the colour showing which. On a beat: **signals race along links**, **nodes swell**, and the **network flashes**.
  - **CODE RAIN EQ** (from MATRIX RAIN and QUANTUM KERNEL): **scattered columns**, each listening to one band, with the colour showing which. The band's energy sets drop speed and length, and heads flare on beats.
  - **CYMATIC PLATE** (the namesake): a **square Chladni plate**. The dominant frequencies pick its standing-wave figure; the figure morphs and ripples on beats.
- R25. New scenes start from **a reference image or my 2–3 mock-up directions**, whichever fits. **PLEXUS gets 2–3 animated mock-up directions** to pick from before it's built.

### Engineering (as in cyberdeck)
- R26. **Data safety, light version**: a versioned settings document, defaults normalized, migrations with fixture tests, damaged data kept under `corrupt.*`, plus EXPORT/IMPORT JSON. No snapshots or profiles.
- R27. **Diagnostics**: COPY DIAGNOSTICS in settings, plus the **D signal meter** (bands L/R, level, beat flashes, flow, fps, capture state).
- R28. Comments are required: file headers, export doc comments, *why* comments. TS strict, React Compiler lint rules, imports go downward (`app → store → lib`), `lib` pure. Docs ship with each change: CLAUDE.md, WORKING.md, ARCHITECTURE.md (with measurements), DESIGN.md, PLAYBOOK.md, CHANGELOG.md (in the user's words), README.md.
- R29. Storage names: the shared origin means IndexedDB `cymatic_bridge`, localStorage prefix `cymatic_bridge:`, cache prefix `cymatic_bridge-`. Never touch cyberdeck's or quest_log's storage.
- R30. No network code and no analytics. The bridge is read-only and has no permissions beyond its two content-script hosts.

---

## 2. SIGNAL: the core method

Every scene is "one fragment shader reading one small signal". The audio side boils the sound down to a fixed, tiny feature set each frame. The drawing side gets it as one texture plus a uniform block. Scenes never touch audio.

### 2.1 Data flow
```
PAGE (main thread)                           WORKER (OffscreenCanvas, WebGL 2)
getDisplayMedia (tab audio) ─► AudioContext
  ChannelSplitter ─► AnalyserNode L, R  (fftSize 2048, smoothing 0)
  each rAF: getFloatFrequencyData + getFloatTimeDomainData
  ─► lib/signal (PURE, unit-tested):
     64 log bands 20 Hz–16 kHz, L and R
     per-band auto-gain (slow peak follower) ─► 0..1
     attack/release envelopes (per-scene profile)
     level, 4 groups (bass / low-mid / high-mid / treble)
     beat: spectral flux, adaptive threshold, 120 ms refractory
     flow: t += dt·(0.25 + 1.75·level)  (speed follows energy, never jumps)
     idle: silent > 1.5 s ─► blend to a synthetic slow "breath"
     strobe limiter on the beat accent (R18)
  ─► Signal (Float32Array, ~0.6 KB) ──postMessage──► scene host
                                                     uploads:
                                                     uSignal  RG16F 64 × 129 texture
                                                       row 0 = now (R=L, G=R)
                                                       rows 1–128 = history ring (~2 s)
                                                       + uHead (ring position)
                                                     uniforms: uLevel, uGroups(vec4),
                                                       uBeat (pulse), uBeatCount,
                                                       uAccent (limited), uFlow, uTime,
                                                       uBalance, uIdle, uSensitivity,
                                                       palette roles, uGlow, uZoom
```
- The worker doesn't wait for the signal: it draws each frame with the latest one it has. (SharedArrayBuffer needs COOP/COEP headers, which GitHub Pages can't set; copying ~0.6 KB per frame costs next to nothing.)
- Analysis stops while the page is hidden (R17).
- getDisplayMedia doesn't mute the source tab, so the page plays nothing back: it only listens.

### 2.2 The scene side
- `scene/shaders/signal.glsl`, a shared include with these helpers:
  - `band(x)` / `bandLR(x)`: the spectrum now, at x in 0..1;
  - `past(x, age)`: the spectrum from the history ring, `age` 0..1 = 0 to ~2 s ago;
  - `group(i)`;
  - `glowLine(dist, gradLen, width)`: cyberdeck's bell core plus Gaussian glow;
  - `freqColor(x)`: frequency → palette hue (R22);
  - `accent()`: the limited beat flash;
  - `dither()`: so faint gradients don't band.
- **Feedback pass** (optional per scene, R13 TRAILS): a ping-pong texture of the last frame. The scene samples it with its own warp and fade (`uTrails`), which gives trails and smears for one extra cheap pass.
- **Instanced geometry** where a scene needs many objects (PLEXUS's links and nodes, as NEURAL NET draws them). The positions and band assignments are made once by pure, seeded code, and the signal only changes light, size and motion.
- **The scene contract** extends cyberdeck's `WallpaperInstance` (resize/start/stop/setGlow/setPalette/destroy) with `setSignal(signal)`, `setSettings(sceneSettings)` and webglcontextlost/restored handling. A `SceneDef` holds the id, name, defaults (palette, glow, sensitivity, trails, zoom) and a **react profile** (attack/release and beat weight per group), which is how each scene gets its own feel (R20).
- **Crossfade** (R15): during the 0.6 s both scenes draw into their targets, and a blit pass mixes them. Only one scene runs outside a crossfade.

### 2.3 What "lightweight" means
These are targets, measured from the first build and recorded in ARCHITECTURE § Measurements:
- analysis ≤ 0.15 ms a frame on the main thread;
- the signal message ≤ 1 KB;
- a scene ≤ 4 ms of GPU a frame at 2560×1440, PLEXUS included;
- no allocation per frame (reused arrays).

---

## 3. Architecture (cyberdeck's skeleton, copied and renamed)
- Stack: Vite + React 19 + TS strict + zustand + idb-keyval; Vitest + Playwright + axe.
- Two-stage start: a tiny `src/main.tsx` (styles, palette, scene canvas), with the app in `src/start.tsx`.
- Layers:
  - `src/lib/`: pure. `signal/` (bands.ts, gain.ts, envelope.ts, beat.ts, flow.ts, idle.ts, strobe.ts, signal.ts), `palettes.ts`, `settings.ts`, `migrations.ts`, `title.ts` (suffix and prefix stripping), `versions.ts`.
  - `src/audio/`: browser code. `capture.ts` (getDisplayMedia, tracks, the capture handle), `analyser.ts`.
  - `src/scene/`: canvas code, no DOM. `host.ts`, `worker.ts`, `types.ts`, `catalog.ts`/`registry.ts`, `gl/` (signal texture, feedback, crossfade), `shaders/signal.glsl`, and `scenes/<id>/`.
  - `src/store/`: kv.ts, idbKV.ts, persist.ts.
  - `src/app/`: TopBar.tsx, Settings.tsx, Meter.tsx, Recovery-lite.
  - `bridge/`: the title extension.
- Copied from cyberdeck and adapted:
  - `src/wallpaper/{host,worker,types,probe}.ts`
  - `src/lib/sharpness.ts`
  - `src/wallpaper/neural-net/tuner.ts` (adaptive supersampling)
  - `src/lib/palettes.ts` with its contrast test (new hues)
  - `src/styles/theme.css` + `app.css` tokens
  - `src/store/{kv,idbKV,persist}.ts`
  - the `src/lib/migrations.ts` pattern
  - `e2e/walk.mjs` `path()`, its server handling and axe
  - `e2e/bridge.mjs` (loading an unpacked extension)
  - `scripts/deploy.sh`
  - the Vite plugins
  - the PLAYBOOK § 6 shader techniques
- Capture options:
  ```
  getDisplayMedia({
    video: { frameRate: 1 },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      suppressLocalAudioPlayback: false,
    },
    displaySurface: 'browser',
    monitorTypeSurfaces: 'exclude',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: 'exclude',
    preferCurrentTab: false,
  })
  ```
  The video track is kept, because it carries the capture handle, but nothing draws it.
- **How the title bridge works:** an MV3 content script on `*://www.youtube.com/*` and `*://music.youtube.com/*` calls
  ```
  navigator.mediaDevices.setCaptureHandleConfig({
    handle: JSON {app, v, title},
    permittedOrigins: ['*'],
  })
  ```
  It calls it again when the title changes (a MutationObserver on `<title>`, plus `yt-navigate-finish`). The page reads `videoTrack.getCaptureHandle()` and listens for `capturehandlechange`. This ties the title to **exactly the shared tab** (R6) and needs no messaging or extra permissions.
  - **Risk:** the call is untested from a content script's isolated world. Phase S2 starts with a probe of that.
  - **Fallback:** `externally_connectable` plus `tabs.query({audible, url: youtube})`. That only works with a single audible YouTube tab, so the HUD would say so when it's ambiguous.

---

## 4. Roadmap (each phase is its own release, built in this order)
- **S1. SIGNAL bare bones (0.1.0):**
  - the scaffold from cyberdeck's skeleton;
  - LISTEN/SWITCH/STOP capture (R5–R8);
  - `lib/signal`, fully unit-tested;
  - the worker scene host with the signal texture, `signal.glsl`, feedback and crossfade;
  - one plain **TEST** scene, glowing band lines plus a history waterfall, to see the signal (kept as a dev scene);
  - the D meter;
  - idle breath and the strobe limiter;
  - the top bar with F/H/←/→;
  - stopping while hidden;
  - storage names and the settings document v1;
  - all the docs started;
  - the first measurements.
- **S2. Title bridge (0.2.0 + bridge 1.0.0):** the capture-handle probe, then the content script, the title in the top bar, the zip download and update check, `e2e:bridge`.
- **S3. Palettes and settings (0.3.0):** 4 neon pairs (I propose them and the user picks), the contrast test, the per-scene settings drop-down, EXPORT/IMPORT, COPY DIAGNOSTICS.
- **S4. PLEXUS (0.4.0):** 2–3 animated mock-up directions published, the user picks, then the build and the user's tweaks.
- **S5. CODE RAIN EQ (0.5.0):** mock-ups or a reference, the build, the tweaks.
- **S6. CYMATIC PLATE (0.6.0):** mock-ups or a reference, the build, the tweaks.
- **S7. 1.0:** polish, the docs pass, the MIT licence, a tag and a GitHub release with the bridge zip.

---

## 5. Verification
- `npm run check`: typecheck, lint and Vitest. `lib/signal` is tested on synthetic buffers:
  - a sine lands in the right band, and L/R balance comes out right;
  - kicks at 120 BPM are detected and a steady tone isn't;
  - auto-gain brings quiet and loud tracks to the same range;
  - the strobe limiter never passes more than 3 flashes a second;
  - idle starts after 1.5 s of silence;
  - flow time never goes backward.
- Settings migrations get fixture tests, and the palettes the contrast test.
- `npm run build && npm run e2e`: Playwright Chromium with `--auto-select-tab-capture-source-by-title=CB-TEST` opens a local test tab that plays a WebAudio kick-and-tone loop.
  - It walks LISTEN → signal → the meter shows bass beats → STOP → idle, then F/H/←/→, the crossfade, and the hidden tab (no frames drawn).
  - axe stays clean, and screenshots go in `e2e/screenshots/`.
- `e2e:bridge` (S2): the unpacked bridge plus a mock youtube.com page served by routing; the title appears and follows a title change.
- `e2e:motion` / `e2e:perf`: frame gaps, per-frame analysis time, and GPU time in the page. Before/after numbers are reported.
- The user checks by eye on real YouTube mixes; screenshots and their words are the spec. I screenshot every build myself first.
- Servers run on 127.0.0.1 only and are stopped by PID; I check `ss -ltnp` and report the ports.

---

## Status
- **2026-10-31: S1 built as 0.1.0 (build 1)**, committed locally (no GitHub repo yet).
  - `npm run check`: 29 tests. `npm run e2e`: 9 paths, headed.
  - Changes from the plan:
    - one auto-gain for the whole spectrum plus a tilt, not one per band (per-band gain lifts hiss to full);
    - fftSize 4096, not 2048 (bass resolution);
    - the accent's gap is 0.34 s (exactly 1/3 s lets a closed second hold four flashes);
    - no page fallback for the stage (WebGL 2 in a worker is required);
    - the walk runs headed (headless tab capture is silent).
- **Next:** S2, the title bridge (it starts with the capture-handle probe). Ask the user before starting.
