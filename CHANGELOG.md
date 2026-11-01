# Changelog

Each release, in the user's words where they gave them. The build number counts every release.

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
