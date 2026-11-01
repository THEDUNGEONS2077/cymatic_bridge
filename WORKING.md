# How we work

How cymatic_bridge is built: the user's method and their choices, each with where it came from, so it can be weighed rather than just followed. Read it with [CLAUDE.md](CLAUDE.md) (the hard rules), [PLAN.md](PLAN.md) (the full requirements) and cyberdeck_terminal's WORKING.md, whose method this project inherits.

## The method
- **Planned in full first.** The project began with 13 rounds of questions, every branch covered before any code (2026-10-31). In the user's words: "I want us to do extensive planning. Ask me all question branches, I want this to be specific to how I want it." The outcome is PLAN.md: requirements R1–R30, the SIGNAL method, and the S1–S7 roadmap.
- **cyberdeck_terminal is the reference** "for how everything in this project will be done": the stack, layering, rules, docs, tests and release flow. The scenes are inspired by its wallpapers.
- **One phase at a time, each its own release**, starting with "the bare bones of signal" (S1). The user is asked before each phase starts.
- **Scenes start from a reference image or from my 2–3 mock-up directions** (R25). PLEXUS gets animated mock-ups to pick from before it's built.
- **Screenshots, then the user's tweaks.** I check every build by eye first (the walk's screenshots), then the user looks at it on real YouTube music. Their words are the spec: quote them in CHANGELOG and DESIGN.md.
- **Ask before anything public:** the repo's creation, every push, deploy, tag or release. Committing locally is fine.

## The user's choices (2026-10-31)
| Topic | Choice |
|---|---|
| What it is | A webpage like quest_log_desktop, with a LISTEN button; the visual in its own tab |
| Sources | YouTube and YouTube Music; titles from those only |
| Playback | React only: no controls |
| Capture | Chrome's tab picker, tabs only, with "Share this tab instead"; only the shared tab is heard |
| Two tabs playing | Only the shared one counts |
| Share ends | Back to idle and LISTEN, no notice |
| Title | Video title only, inside the top bar, from a separate title bridge extension (zip from the page) |
| HUD | One thin full-width bar at the top |
| Keys | Minimal: F fullscreen (visual only, as cyberdeck), H hide HUD, ← / → scenes, D signal meter |
| Settings | Per scene (palette, glow, sensitivity, trails, zoom), in a drop-down under the bar; no SYNC offset |
| Idle | A calm breath, never a dead page |
| Scene change | Manual only, ~0.6 s crossfade |
| Frame rate | Every frame (no cap) |
| Flashes | No fast strobing (at most 3 a second) |
| Reduce Motion | Ignored (a visualizer is motion), but the strobe cap holds |
| Response | Balanced, tuned per scene; the frequency range weighed evenly; stereo available |
| Palettes | A fresh set: neon pairs on black. 8 proposed, all kept ("Can't we keep all the palettes?", 0.3.0); more can come with scenes |
| Colour | Frequency → colour, plus beat accents |
| Scenes | PLEXUS (first: bolder than NEURAL NET, nodes scattered with colour showing band; beats race signals, swell nodes, flash the net), CODE RAIN EQ (scattered columns), CYMATIC PLATE (square Chladni plate) |
| Data safety | Light: versioned settings, migrations, damaged data kept, EXPORT/IMPORT |
| Diagnostics | COPY DIAGNOSTICS and the D signal meter |
| Hosting | GitHub Pages, public repo THEDUNGEONS2077/cymatic_bridge, MIT |

## Speed: the bar (cyberdeck's)
- **Smoothness first, then sharpness, then detail.**
- **Measure before and after**, and report the numbers (ARCHITECTURE.md § 9). The meter (D) shows fps, drawing time and SIGNAL's cost on the user's own machine. The walk's numbers come from software rendering (no GPU here), so only the user's meter readings say how fast it really is.
- **Nothing runs while it can't be seen:** the stage stops, the listen loop stops, the audio context sleeps.
- **No WebGL multisampling**; smooth lines in the shader.

## The quality bar
- `npm run check` before every commit; `npm run build && npm run e2e` for anything on the page.
- axe stays clean (WCAG 2.2 A/AA); click targets stay at least 24 px.
- Comments and docs as in CLAUDE.md.
