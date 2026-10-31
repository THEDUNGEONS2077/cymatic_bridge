# cymatic_bridge

A music visualizer for the YouTube tab you share. Open the page, press **LISTEN**, pick the tab playing YouTube (or YouTube Music) in Chrome's picker, and keep **"Also share tab audio"** on. The visuals react to that tab's sound. Nothing leaves your browser.

## Keys
| Key | What it does |
|---|---|
| F | Fullscreen, with only the visual |
| H | Hide or show the top bar |
| ← / → | The previous or next scene |
| D | The signal meter (bands, beats, frames a second) |

## Status
0.1.0 is **S1, the bare bones of SIGNAL**: the capture, the analysis, the drawing stage, and one plain development scene (TEST). The roadmap is in [PLAN.md](PLAN.md). The title bridge, the palettes and settings, and the scenes PLEXUS, CODE RAIN EQ and CYMATIC PLATE come next.

## Development
```bash
npm install
npm run dev                   # http://127.0.0.1:5173
npm run check                 # typecheck, lint, unit tests
npm run build && npm run e2e  # the browser walk (opens a Chromium window: headless capture is silent)
```
Needs a current Chrome (tab audio sharing, WebGL 2 in a worker).

Read [CLAUDE.md](CLAUDE.md), [WORKING.md](WORKING.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN.md](DESIGN.md) and [PLAYBOOK.md](PLAYBOOK.md) for how it's built.
