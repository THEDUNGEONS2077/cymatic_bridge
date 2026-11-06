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
- **2026-10-31/11-01: 0.1.1 (build 2).** Timing: the user found the visuals lagged the sound. They kept the sound playing from the tab. A shorter spectrum window, a fast beat analyser, drawing as the signal arrives and quicker level attacks fixed it: the user said "it's good, let's move forward". The audio context is also now made inside the click.
- **2026-11-01: S2 built as 0.2.0 (build 3).** The capture-handle probe passed first: a content script can set it, and the page sees every change.
  - The bridge is 1.0.0, with no permissions.
  - Changes from the plan:
    - `permittedOrigins` is the page's own origins, not `*`;
    - the fallback (externally_connectable) wasn't needed;
    - signal frames are now flow-controlled (one in flight), fixing a pile-up 0.1.1 allowed.
  - 38 unit tests; the walk (10 paths) and `e2e:bridge` (4 paths) pass headless. The headed sound paths need the window uncovered.
- **2026-11-01: S3 built as 0.3.0 (build 4).** It has SETTINGS (scene look per scene, BACKUP, DIAGNOSTICS).
  - **Change to R21:** eight palettes, not four. The user kept all eight offered: "Can't we keep all the palettes?"
  - 43 unit tests; the walk (11 paths) passes headless.
- **2026-11-01: S4 built as 0.4.0 (build 5), PLEXUS.**
  - **How it was found:**
    - Mock-ups round 1 (A/B/C): B, DEPTH.
    - Round 2 (four DEPTH variations): B2, FLIGHT.
    - Three builds. The third was the user's rethink: a main pulse travelling forward, the camera following it, branches on beats, marks on the links it ran, a net that grows and shrinks; calm.
  - The user: "This is perfect". Trails were then fixed twice: no longer added onto the picture, and shown dimmed.
  - **Change to R24's PLEXUS:** "nodes swell" and "signals race" became the main pulse and its branches; "network flash" stays as the accent.
  - 53 unit tests; the walk (11 paths) passes headless, now with music made in the page.
- **2026-11-01: 0.4.1 (build 6).** "More of the net": it fills the screen (about 1,100 nodes), the same quiet stage, and "the smoothest it can be". Visibility culling, packed buffers, strips, a slim glow for quiet links and a direct draw without trails keep 3× the net as fast as the old (measured).
- **2026-11-01: 0.4.2 (build 7).** "Refine and optimize": the camera glides (no steps at nodes), and PLEXUS draws direct onto the canvas, dithering its own light (+30% measured). The look is unchanged.
- **2026-11-01: 0.4.3 (build 8):** the MIT licence, a one-time tip about Chrome's sharing bar (it can't be hidden by the page), and the first push to GitHub (public repo THEDUNGEONS2077/cymatic_bridge; the user: "let's push to github for what's been done so far"). Not deployed to Pages yet.
- **2026-11-01: deployed** (0.4.3, build of 7f27356). Then 0.4.4 removes 0.4.3's wrong "Hide button" tip: the tab-sharing bar can't be closed at all. The title bridge was checked on real YouTube with the live site (the label arrives); the user's report that it isn't working is being looked into.
- **2026-11-01: S5 started.** CODE RAIN EQ mock-ups (`mockups/code-rain/`), published at https://claude.ai/artifact/Ac7By3GeBJzZwBc4vqTNra:
  - A CASCADE: flat rain;
  - B STRATA: three depth layers;
  - C TUNNEL: streams rushing from a core, PLEXUS's flight as rain.

  The user leaned to C: "Let's try 6 different mock ups for TUNNEL".
- **2026-11-06: TUNNEL variations** (`mockups/code-rain-tunnel/`), published at https://claude.ai/artifact/RzD8ccGWzYTzoPhKfEUnV4:
  - C1 RUSH: the first TUNNEL, streams scattered round the core (now fading as they pass, not vanishing);
  - C2 SPECTRUM: spokes in spectrum order round a ring, bass at the bottom, treble at the top;
  - C3 TUBE: a slowly bending tube whose walls are glyph columns, drops racing along them, beat rings running out of the core;
  - C4 VORTEX: five spiral arms, the tunnel turning with the level, each beat a smooth push;
  - C5 WARP: glyphs through the whole volume, streaking as the speed (level, beat surges) climbs;
  - C6 ECHO: a ring of glyphs leaves the core every 80 ms, shaped and lit by the spectrum at that moment (SIGNAL's history ring).

  The user: "can you do a combination of C1 and C5?"
- **2026-11-06: RUSH × WARP blends** (`mockups/code-rain-rush-warp/`), published at https://claude.ai/artifact/K26FfP5ugkBJyZPDneT3bH. C1's code round the core with C5's speed (a flight speed that lunges on each beat and glides back, never jumping), three ways:
  - C7 SURGE (by time): C1 without a beat; each beat stretches the trails and brings in C5's streaks, which ease away;
  - C8 LAYERS: C1's code in front, as calm as C1; C5's warp behind it as thin lines over the whole view, specks at cruise and streaks in a surge;
  - C9 STRETCH (by distance): crisp code far off near the core, trails melting into streaks as they near you; surges push the melting further in.

  The user: "can you have there be a dynamic horizon instead of the light beaming in the centre?" The core is replaced (same page, republished) by a horizon through the vanishing point, three ways, switched by HORIZON for all three blends:
  - RIDGE: the horizon is the spectrum, mirrored from the centre (bass in the middle, treble at the edges), rising into peaks where loud, with a body, a flat base line and a faint reflection;
  - PULSE: a straight line of light, lit along its length by the spectrum, brighter with the level;
  - BANK: PULSE's line, and the whole view banks (up to about 6°) and drifts slowly on the flow clock; in the app, the stereo balance could lean it.

  In all three, a soft band of haze follows the level, and each beat sends light running out along the horizon from the centre.

  The user: "keep the straight line and get rid off the bouncing line above it, have the horizon straight line react by how it glows". Now one horizon (the switch, RIDGE and BANK are gone):
  - a straight, fine line through the vanishing point that never moves;
  - its glow reacts: soft lights along it overlap into one halo, taller and brighter where its band is loud (bass in the middle, treble toward the edges; squared, so quiet stays calm);
  - the whole line brightens with the level, under a faint haze;
  - each beat sends a swell of glow running out along it from the centre.
- **2026-11-06: C8 LAYERS picked** ("I like Layers - C8"), and the horizon becomes a heartbeat line ("I want the horizon the change as if it's a heartbeat pattern line"). Mock-ups in `mockups/code-rain-layers/`, published at https://claude.ai/artifact/6F79Lqbg44rLiXj1oSTMGh. The line is flat between beats; each beat draws an ECG heartbeat (a small P bump, the sharp Q-R-S spike and dip, a wider T bump) whose spike lands with the kick and glows; louder kicks draw taller spikes. The glow still follows the bands and the level. With no beat for 1.6 s, a small resting heartbeat every 1.1 s keeps the line from flatlining (the idle breath, R14, as a pulse). Two ways to run it, each on its own canvas:
  - OUTWARD: written at the centre, the trace scrolls out both ways (mirrored), fading toward the edges; the P bump is drawn ahead, all at once, so the spike needs no delay;
  - MONITOR: a heart monitor; a bright point sweeps left to right every 2 s writing the trace, which fades behind it, with a gap just ahead of the point and the flat horizon faintly lit across the view (no P bump: it would come before the beat).

  Test note: this machine was heavily loaded (load ~11 from another session's Java build), so headless frames ran at 2–5 fps and dropped beats; the frames were checked by stepping the page at a steady 60 fps instead.

  The user: "I like monitor, give me more variations of it".
- **2026-11-06: MONITOR variations** (`mockups/code-rain-monitor/`), published at https://claude.ai/artifact/7S7qVcNbyxPamm4kz5nzed. All on C8 LAYERS, all keeping the heartbeat (spike with the kick, taller for louder kicks, the resting beat) and the glow:
  - M1 CLASSIC: the picked MONITOR (a 2 s left-to-right sweep, the trace fading, a gap ahead of the point);
  - M2 LOCKED: a hospital monitor; two bars a sweep, locked to the beat, so eight heartbeats stand still and are redrawn in step; the trace held near full until wiped (the app would need a tempo estimate in SIGNAL);
  - M3 CENTRE: two points sweep out from the centre to both edges, the trace mirrored;
  - M4 SCAN: the point carries a soft vertical beam that lights the code it passes, flaring on spikes;
  - M5 VITALS: a patient monitor's three traces, the heartbeat on the horizon, a pulse wave above (rise, fall, dicrotic notch after each beat) and breathing below (a slow wave on the flow clock, deeper when loud);
  - M6 RACE: the sweep's pace follows the bass (1 s a sweep when it drives, 2.6 s when quiet, eased) and the spikes grow with it.

  The user: "I like M4 SCAN - let's get variations on that".
- **2026-11-06: SCAN variations** (`mockups/code-rain-scan/`), published at https://claude.ai/artifact/Sp3a7NznV19y6TAtUTDhD2. All on C8 LAYERS with the monitor (a 2 s sweep writing the heartbeat, the resting beat, the glow); what changes is the beam and what it does to the code:
  - S1 SCAN: the picked one; a soft beam on the point lights the code under it, flaring on spikes;
  - S2 WAKE: the light lingers on the code behind the beam (fading over 0.7 s), and each spike leaves a brighter stripe;
  - S3 REVEAL: the code rests dark (10%) until the beam finds it, then fades back over 0.6 s, like a radar; the warp is dimmed by half;
  - S4 LINE: a crisp scan line top to bottom; code it crosses flashes white and changes glyphs (decoded);
  - S5 BOUNCE: the beam sweeps across and back like a scanner, writing the heartbeat both ways, with no jump back to the start;
  - S6 SWELL: the beam's width and brightness follow the bass, and each beat bursts it wider; slim in the breakdown.

  First pass: WAKE and REVEAL lingered 0.9 s and 1.6 s against a 2 s sweep, so the whole view stayed lit and they looked alike. Lingering must stay well under the sweep.
- **2026-11-06: S5 built as 0.5.0 (build 10), CODE RAIN EQ.** The user: "Let's go with S5 BOUNCE". In WebGL on SIGNAL (`scene/scenes/coderain/`): C8 LAYERS' code and warp, the straight horizon whose glow reacts, and the heart monitor whose scan bounces, its beam lighting the code (ARCHITECTURE.md § 15, DESIGN.md § 4.3).
  - **Change to R24's CODE RAIN EQ:** "scattered columns" became a tunnel of streams round a vanishing point, each still on its own band, coloured by it, faster and longer when loud, heads flaring on the beat; plus the warp, the horizon and its heart monitor, from the rounds above.
  - No trails (TRAILS is hidden for it). Measured as fast as PLEXUS (software-rendered, under fuller test music).
  - 70 unit tests; the walk (11 paths) passes headless, now through CODE RAIN EQ, including a lost context while it shows.
