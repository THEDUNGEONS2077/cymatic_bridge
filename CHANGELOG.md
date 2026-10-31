# Changelog

Each release, in the user's words where they gave them. The build number counts every release.

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
