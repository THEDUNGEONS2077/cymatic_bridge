# Changelog

Each release, in the user's words where they gave them. The build number counts every release.

## 0.4.1 (build 6)
**More of the net, smoother.** The user: "I would like there to be more of the net. Take the current design approach and expand/extend it". It should fill the screen, as "the same quiet stage", and "Try to maximise visual performance and keep latency as low as possible, the main goal is for it to be the smoothest it can be".
- **The net fills the screen:**
  - the box grew from 5.2 × 2.8 to 9.2 × 5.2 units: about 1,100 nodes on a 16:9 screen (was 340), at the same density;
  - a quiet net keeps a third spread over the whole screen, not bunched in the middle, plus a thin spine down the centre so the main pulse always has a way through;
  - its brightness is unchanged.
- **Less work per frame:**
  - only what can be seen is drawn: links and nodes that are absent, out of view to the sides, or inside the near and far fades are skipped on the CPU, and the rest are packed into buffers made once;
  - a quad is 4 vertices, not 6;
  - a quiet link's glow is slim, while a marked or loud one keeps GLOW's full width;
  - light too faint to show is not blended;
  - things fade out by depth 0.35 as they near the camera;
  - with TRAILS off, PLEXUS draws straight onto the screen target, skipping three passes;
  - the field is built from a grid (25 ms at the widest screen, not a quadratic search).
- **Measured** (software rendering on the dev machine, 1280×720, under the test music): the 3× net runs as fast as the old one (10.8 fps against 10.5). Drawn naively, it ran at 6.5. Sending each link's loudness from the CPU was tried and measured no faster, so it was left out.

## 0.4.0 (build 5)
**S4: PLEXUS**, the first real scene. The user: "This is perfect".
- **How it was found:**
  - Mock-ups round 1 (three directions): the user picked B, DEPTH.
  - Round 2 (four DEPTH variations): "I like B2 - Flight".
  - The first build flew through a still net.
  - The second made it live ("shift and form new connections and be way more reactive"), but was "too chaotic / busy".
  - The third followed the user's rethink: "a central pulse that travels from node to node, branching off into small pulses but the main one stays in focus".
- **What it is:**
  - **The main pulse** travels forward through the net, in the palette's bright colour. The camera follows it, so it stays in focus at the centre. It moves faster when loud, and breathes with the level and flares on the beat.
  - **Branches:** each beat splits off 2–5 small pulses, which run a few links and end.
  - **Marks:** "pulse leaves a mark". Every link a pulse runs along glows brighter, thicker and whiter, fading over 3.5 s.
  - **The net** "grows and shrinks": loud passages bring nodes in, quiet ones let them fade, and about a third stays, mostly near the centre. Otherwise it holds still and quiet, the stage for the pulse.
- **Trails** (off by default for PLEXUS):
  - "When the trails are on not much is visible": they were added onto the picture, so still parts built up to ~30× their brightness. Now the brighter of the two wins.
  - Then "the trails are still too intense": the history is now kept at full strength and shown at 40%, as a soft afterglow. It also lasts at most 0.6 s.
- **Tests:** a headless walk now hears music: a stream made in the page stands in for the picker, so the sound checks run every time.

## 0.3.0 (build 4)
**S3: palettes and settings.**
- **Eight palettes,** neon pairs on true black (bass → treble): UV, LASER, ACID, SOLAR, AURORA, TOXIC, FROST and FLARE. Eight were offered to choose four from; the user: "Can't we keep all the palettes?" All eight pass the contrast rule.
- **SETTINGS,** a drop-down from the bar's right end (R13). Folds:
  - **SCENE**, kept per scene: PALETTE (it recolours the visual and the bar), GLOW, SENSITIVITY, TRAILS, ZOOM, RESET SCENE;
  - **BACKUP**: EXPORT / IMPORT a settings file (read through the migrations; the settings from before an import are kept aside);
  - **DIAGNOSTICS**: COPY DIAGNOSTICS (frames, the signal and the browser; no title).

## 0.2.0 (build 3)
**S2: the title bridge.** The shared tab's title in the bar (R9, R10).
- **CYMATIC TITLE BRIDGE** (`bridge/`, 1.0.0) is a Chrome extension with no permissions. It runs only on YouTube and YouTube Music. It labels the tab with its title through Chrome's capture handle, readable only by this page's addresses, and labels it again whenever the title changes (the next video, the next song in a mix).
- **The page** reads the label from the shared tab's video track, so the title is always the tab you shared (R6), even after "Share this tab instead". It shows the video title only: YouTube's suffix and the notification count go, and YouTube's home page shows nothing.
- **Without the bridge,** the bar offers **GET TITLE BRIDGE**, which opens the install steps and the zip download. DON'T OFFER AGAIN turns the offer off. An older bridge gets **UPDATE TITLE BRIDGE**.
- **Fix:** at most one SIGNAL frame is now with the drawing worker at a time. Since 0.1.1 (drawn as they arrive), frames could pile up when the worker fell behind. The visuals then lagged more and more, and stop, probes and context restores waited behind them.
- **New tests:** `npm run e2e:bridge` loads the real extension against a fake YouTube page. The walk checks the offer, the panel (axe clean) and the zip.

## 0.1.1 (build 2)
**On time.** The user, trying S1 on YouTube: "it doesn't really feel on time": the visuals lagged the sound. They chose to keep the sound playing from the YouTube tab, rather than routing it through the page with a delay. So every lag the page controls was cut. Afterwards: "it's good".
- **Shorter spectrum window:** fftSize 4096 → 2048, about 21 ms less lag.
- **Beats from a separate short analyser** (fftSize 512, about 5 ms): kicks are caught as they start.
- **Each frame drawn when its signal arrives,** not at the worker's next frame: up to a frame less.
- **Levels rise in 10 ms** (was 30).
- **Fix:** the audio context is now made inside the LISTEN click. Made after the picker, it could start suspended, and the first share would be silent.
- **The walk reports the beat latency** (a kick at the speakers → the beat seen).

## 0.1.0 (build 1)
**S1: the bare bones of SIGNAL** (the user: "first make sure we have covered all possible requirement specifications, then we start with the bare bones of signal"). Planned over 13 rounds of questions (PLAN.md R1–R30).
- **SIGNAL**, the method every scene is built on:
  - 64 log bands per channel (30 Hz–16 kHz, tilted so the range weighs evenly), one auto-gain;
  - per-scene smoothing profiles;
  - beats by spectral flux;
  - the limited beat accent (at most 3 flashes in any second);
  - a flow clock, stereo balance, and an idle breath when silent;
  - on the graphics card as one small texture (the bands now, the waveform, a 2 s history ring) plus uniforms, through the shared `signal.glsl`.
- **LISTEN / SWITCH / STOP:** Chrome's tab picker (tabs only, with "Share this tab instead"). A share without sound says so. When the share ends, the page goes back to LISTEN and the scene to idle.
- **The stage:** WebGL 2 in a worker, every frame drawn, nothing while hidden. Also per-scene trails (half-float feedback), a 0.6 s crossfade between scenes, lost-context recovery, and cyberdeck's sharpness guard.
- **TEST**, the development scene: SIGNAL drawn plainly (the spectrum, the waveform, a beat ring, the waterfall, trails).
- **The HUD:** a thin top bar. Keys: F fullscreen, H hide the HUD, ← / → scenes, D the signal meter.
- **Settings** saved per scene (versioned, damaged data kept aside). One provisional palette, UV, until S3's four.
