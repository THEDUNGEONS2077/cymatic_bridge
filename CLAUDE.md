# cymatic_bridge: notes for Claude Code

Read [WORKING.md](WORKING.md) (how we work: the user's method and choices), [PLAN.md](PLAN.md) (the requirements R1–R30, the SIGNAL method, the S1–S7 roadmap), [ARCHITECTURE.md](ARCHITECTURE.md) (every part and why) and [DESIGN.md](DESIGN.md) (the look) first. [PLAYBOOK.md](PLAYBOOK.md) holds lessons other projects can reuse. cyberdeck_terminal (`~/projects/cyberdeck_terminal`) is the reference for how everything here is done: when in doubt, do it its way.

## What this is
A full-screen music visualizer **webpage**. LISTEN opens Chrome's share picker, the user picks the YouTube tab, and the page reacts to that tab's sound. It only reacts: no playback controls. The optional **title bridge** extension (`bridge/`) labels YouTube tabs with their title through Chrome's capture handle, and the page shows the shared tab's title.

## Rules
- **Comments are required.** Every file gets a header comment (its purpose and layer), shaders too. Every export gets a doc comment. Non-obvious logic gets a short *why* comment.
- **TypeScript** is `strict` with no `any`. ESLint includes the React Compiler rules: no `setState` in effects, no refs or impure calls during render, and no function named `use…` outside hooks.
- **Imports go downward:** `app` → `store` → `lib`. `audio/` and `scene/` are browser code (no React, no stores, except `audio/listen.ts` setting the live store's capture state). `lib` stays pure (no browser APIs, no `performance.now`): it's tested in Node.
- **Every scene is built on SIGNAL** (ARCHITECTURE.md § 4). A scene reads the music only through `scene/shaders/signal.glsl` and the uniforms the stage sets. It never touches audio. A new scene is a folder in `scene/scenes/`, an entry in `scene/registry.ts`, and a card in `lib/scenes.ts` (its defaults and react profile).
- **Colours come from the palette** (`lib/palettes.ts`): no raw colour in CSS, components or shaders. A new palette must pass the contrast test in `src/__tests__/settings.test.ts`.
- **Flashes are limited (R18).** Only `uAccent` (lib/signal/strobe.ts: at most 3 in any second, at most 0.8) may flash the picture. A scene adds its flash *before* mixing in its trail, never after (flashes would stack frame on frame).
- **Time, not frames.** Fades, drifts and smoothing go by seconds (`uDt`, `dt`), so a 144 Hz screen looks like a 60 Hz one.
- **Smoothness first** (cyberdeck's WORKING.md): every frame is drawn (R16), nothing is drawn while hidden (R17), no WebGL `antialias`, smooth lines through `glowLine` (the gradient's length, never `fwidth`), dither on faint fades. Measure before and after any speed work.
- **WebGL** lost contexts: `webglcontextlost` (`preventDefault`) and `webglcontextrestored` (the stage builds everything again, scenes included). The walk loses and restores the context.
- **Settings are recoverable (R26).** One versioned document (`lib/settings.ts`). A shape change bumps `SETTINGS_VERSION` and adds a step and a fixture test in `lib/migrations.ts`. Unreadable data is kept under `corrupt.*`, never written over.
- **The title bridge** (`bridge/`, plain files loaded unpacked):
  - Its version is written in three places: `bridge/manifest.json`, `bridge/title.js` `VERSION` and `src/lib/bridge.ts` `BRIDGE_VERSION`. Bump all three together; a test checks them. The bar then offers the update.
  - It asks for **no permissions** and runs only on `www.youtube.com` and `music.youtube.com`. Keep it that way (a test checks).
  - Only the origins in `title.js` `PERMITTED` can read its label: the published page, the dev server (5173) and the tests (8173, 8175). A new port the page runs on must be added there.
  - The label is JSON `{ app: 'cymatic_bridge', v, title }`. Anything else on a capture handle is ignored.
- **Signal frames are flow-controlled** (`scene/host.ts`): at most one is with the worker; newer ones wait, keeping only the newest. Never post past it: a slow worker would fall behind for good.
- **Shared origin.** cyberdeck_terminal and quest_log_desktop share `thedungeons2077.github.io`. Use only the IndexedDB database `cymatic_bridge`, the localStorage prefix `cymatic_bridge:` and the cache prefix `cymatic_bridge-`.
- **No network code and no analytics.** The page is static files; the sound never leaves the browser.
- **Servers:** start `serve` directly (not `npx serve`), on 127.0.0.1 only. Stop it by PID, check with `ss -ltnp`, and tell the user about any port opened. The walk does this itself.
- **Documentation is part of the change:** ARCHITECTURE.md (with measurements in § 9), DESIGN.md, PLAYBOOK.md, CHANGELOG.md (in the user's words), PLAN.md's status, and the file's own header comment, in the same commit.
- **Publishing is public.** Ask the user before creating the GitHub repo, and before every push, deploy, tag or release.

## Commands
```bash
npm run dev                  # Vite dev server on 127.0.0.1 (stop it when done)
npm run check                # typecheck + lint + Vitest (must pass before every commit)
npm run build && npm run e2e # the browser walk; screenshots in e2e/screenshots/
CB_HEADLESS=1 npm run e2e    # the walk headless (the sound checks are skipped: headless capture is silent)
npm run build && npm run e2e:bridge  # the real title bridge against a fake YouTube page (headless)
```
The walk runs **headed** when there's a display (WSLg's), because headless Chrome captures a tab's sound as silence. A Chromium window shows for about a minute. Covered by another window on the Windows desktop, it runs at about 1 fps and the sound paths fail: then run it with `CB_HEADLESS=1`, and leave the sound to the user's own check.

## Releasing
1. Bump `version` in `package.json`.
2. Add a `## x.y.z (build N)` section at the top of `CHANGELOG.md`, with N one more than before.
3. Commit.
4. Push, deploy, tag: each only with the user's OK.
