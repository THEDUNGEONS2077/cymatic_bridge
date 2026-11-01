# cymatic_bridge

A music visualizer for the YouTube tab you share. Open the page, press **LISTEN**, pick the tab playing YouTube (or YouTube Music) in Chrome's picker, and keep **"Also share tab audio"** on. The visuals react to that tab's sound. Nothing leaves your browser.

## The title
To show the shared tab's video title in the bar, add the small **CYMATIC TITLE BRIDGE** extension. While listening, press **GET TITLE BRIDGE** in the bar for the zip and the steps (load it unpacked in chrome://extensions). It has no permissions and only labels YouTube and YouTube Music tabs with their title, for this page to read.

## Keys
| Key | What it does |
|---|---|
| F | Fullscreen, with only the visual |
| H | Hide or show the top bar |
| ← / → | The previous or next scene |
| D | The signal meter (bands, beats, frames a second) |

## Status
0.2.0 has **S1, the bare bones of SIGNAL** (the capture, the analysis, the drawing stage and one plain development scene, TEST) and **S2, the title bridge**. The roadmap is in [PLAN.md](PLAN.md). The palettes and settings come next, then the scenes PLEXUS, CODE RAIN EQ and CYMATIC PLATE.

## Development
```bash
npm install
npm run dev                   # http://127.0.0.1:5173
npm run check                 # typecheck, lint, unit tests
npm run build && npm run e2e  # the browser walk (opens a Chromium window: headless capture is silent)
```
Needs a current Chrome (tab audio sharing, WebGL 2 in a worker).

Read [CLAUDE.md](CLAUDE.md), [WORKING.md](WORKING.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN.md](DESIGN.md) and [PLAYBOOK.md](PLAYBOOK.md) for how it's built.
