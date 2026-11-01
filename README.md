# cymatic_bridge

**Live:** https://thedungeons2077.github.io/cymatic_bridge/ (Chrome)

A music visualizer for the YouTube tab you share. Open the page, press **LISTEN**, pick the tab playing YouTube (or YouTube Music) in Chrome's picker, and keep **"Also share tab audio"** on. The visuals react to that tab's sound. Nothing leaves your browser.

## Chrome's sharing bar
While you listen, Chrome shows a bar on the music tab saying it's being shared. That's Chrome's own security indicator: no page or extension can hide it. Its **Hide** button can, until the next share. The visualizer reminds you once per visit.

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
0.3.0 has:
- **S1, the bare bones of SIGNAL:** the capture, the analysis, the drawing stage and one plain development scene, TEST;
- **S2, the title bridge;**
- **S3, eight palettes and SETTINGS:** palette, glow, sensitivity, trails and zoom per scene, export/import and diagnostics.

- **S4, PLEXUS:** a pulse travelling forward through a neural net that grows and shrinks with the music, branching on the beat and leaving glowing marks.

The roadmap is in [PLAN.md](PLAN.md). The scenes CODE RAIN EQ and CYMATIC PLATE come next.

## Development
```bash
npm install
npm run dev                   # http://127.0.0.1:5173
npm run check                 # typecheck, lint, unit tests
npm run build && npm run e2e  # the browser walk (opens a Chromium window: headless capture is silent)
```
Needs a current Chrome (tab audio sharing, WebGL 2 in a worker).

Read [CLAUDE.md](CLAUDE.md), [WORKING.md](WORKING.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN.md](DESIGN.md) and [PLAYBOOK.md](PLAYBOOK.md) for how it's built.
