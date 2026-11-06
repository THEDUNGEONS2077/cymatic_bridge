# Design

How cymatic_bridge looks, and why. It inherits cyberdeck_terminal's design system (its DESIGN.md § 3): JetBrains Mono, the colour roles, the 4 pt grid, the lit frame, small crisp uppercase text. What's its own is below.

## 1. Principles
- **The visual is the page.** It fills the window. The HUD is one thin bar over it (R11), hidden with H, gone in fullscreen (F).
- **Never a dead page.** Before LISTEN and in silence, the scene breathes (R14).
- **Seamless and smooth** (cyberdeck's rule): no visible cuts, bands or hard edges. Lines glow (bell core and Gaussian glow); faint fades are dithered.
- **Colour means frequency.** The bass sits at the palette's accent and the treble at its cool hue, lifted toward bright when loud (R22).
- **Flashes are rare and soft:** only the limited beat accent (≤3 a second, ≤0.8) may flash the picture (R18).

## 2. Palettes
A palette is cyberdeck's twelve roles, true black behind everything. cymatic_bridge's palettes are a fresh set of neon pairs (R21). The accent colours the bass and the cool hue the treble (freqColor). Eight were proposed in S3 for the user to keep four; they kept all eight (0.3.0: "Can't we keep all the palettes?"). UV is hand-made. The other seven are derived from their pair by a script: surfaces, lines and the wash are fixed mixes of the accent over black, text colours are lifted toward white until they pass the contrast rule, and bright is the accent 75% toward white.

| Palette (id) | Origin | Accent (bass) | Cool (treble) |
|---|---|---|---|
| UV (`uv`) | 0.1.0: ultraviolet over acid teal | `#c25bff` | `#20e0c0` |
| LASER (`laser`) | 0.3.0: laser red over ice cyan | `#ff2e4d` | `#5fe3ff` |
| ACID (`acid`) | 0.3.0: acid green over ultraviolet | `#b8ff2e` | `#8a5cff` |
| SOLAR (`solar`) | 0.3.0: solar orange over deep blue | `#ff8a1f` | `#3a6dff` |
| AURORA (`aurora`) | 0.3.0: mint over magenta | `#3dffb0` | `#ff4fd8` |
| TOXIC (`toxic`) | 0.3.0: toxic yellow over violet | `#ffe32e` | `#a04dff` |
| FROST (`frost`) | 0.3.0: white-blue over indigo | `#9fd8ff` | `#5b5bff` |
| FLARE (`flare`) | 0.3.0: hot pink over electric cyan | `#ff4fb3` | `#2ee6ff` |

Ids are stored in settings: never change one once released. An unknown id reads as UV.

The contrast rule: every text colour passes WCAG AA (4.5:1) on bg, surface and raised, and bright text passes on the wash. The test checks it.

## 3. The HUD
- **The bar:** 36 px tall, full width, black at 72% with a lit lower edge (`--line-lit`) and the softest glow.
  - The brand `<cymatic_bridge>` sits in the accent.
  - Buttons have cyberdeck's lit frame and are 24 px tall. LISTEN is in the accent.
  - The title sits in the middle, bright, uppercase and cut with an ellipsis: the video title only (R9).
  - While listening to a tab without the title bridge, a quiet button sits in the middle instead: GET TITLE BRIDGE (dim text, a plain frame), or UPDATE TITLE BRIDGE beside an old bridge's title.
  - The scene name is on the right between ‹ ›.
- **The bar takes the showing scene's palette.**
- **SETTINGS:** a drop-down at the bar's right end, 400 px wide, on the surface colour with a lit frame. Its folds use native `<details>`, with a ruled summary and an accent caret (cyberdeck SYSTEM's look).
  - Inside, each setting has its label left and its control right.
  - Palettes are a 4 × 2 grid of swatches. Each previews its own pair as a split bar, the one place raw colours are drawn; the chosen one is lit.
  - GLOW is four buttons, the chosen one lit. SENSITIVITY, TRAILS and ZOOM are − value + steppers.
- **The bridge panel:** under the bar, centred, 480 px wide, on the surface colour with a lit frame. It has an accent heading, the explanation in bright text, the privacy line in text colour, and numbered steps. Its buttons are DOWNLOAD ZIP (primary), DON'T OFFER AGAIN and CLOSE. Esc closes it.
- **Notices:** one line under the bar, on the surface colour with a lit frame, for 6 s.
- **The meter (D):** bottom left, 360 × 150 px of bars plus a line of figures in 10 px text.

## 4. Scenes
### 4.1 TEST (0.1.0, the development scene)
SIGNAL drawn plainly, so the method can be seen and tuned. It isn't meant to be beautiful, only clear:
- **The waveform:** a thin scope line near the top, from dim to text colour with the level.
- **The spectrum:** the left channel as a glowing line rising above the middle (bass at the left) and the right channel mirrored below. Each has a faint fill under it, so loud bands read as mass.
- **The beat ring:** a ring in the middle that swells with the beat and the bass.
- **The waterfall:** the 2 s history along the bottom 40%, newest at its top, fading with age.
- **The trails:** the last frame drifting outward and fading, lasting 0.05–0.8 s by TRAILS.
- **The accent:** a faint full-screen flash of the bright colour, added before the trail mix, so it fades with the trail and never stacks (0.1.0: an early build let it stack into a grey haze).

### 4.2 PLEXUS (0.4.0)
The first real scene: a pulse travelling forward through a neural net. It was found in three steps:
- **Mock-ups, round 1:** A FIELD, B DEPTH and C CONSTELLATION (`mockups/plexus/`). The user picked B.
- **Round 2:** four DEPTH variations: CLOUD, FLIGHT, ORB and GALAXY (`mockups/plexus-depth/`). "I like B2 - Flight".
- **Three builds:**
  1. A flight through a still net.
  2. A living one: wandering nodes, rewiring links, a shockwave and a surge. It was "too chaotic / busy".
  3. The user's rethink: "a central pulse that travels from node to node, branching off into small pulses but the main one stays in focus". "This is perfect".

| Part | How it looks |
|---|---|
| The view | Looking forward down the net (FLIGHT's). The camera sits 1.7 units behind the main pulse and eases sideways after it (0.6 s), so the pulse stays at the centre |
| The main pulse | A disc in the palette's bright colour, 26 CSS px at depth 1 plus 30 with the level and 26 on a beat. It runs forward node to node near the centre line, 0.45–2.35 units a second with the loudness |
| Branches | On each beat, 2–5 small pulses split off along other links (more for a stronger beat), each running 2–5 links |
| Marks | A link a pulse ran along glows: brighter, up to 2.2 px thicker, toward the bright colour, fading over 3.5 s. The main pulse's mark is full, a branch's 0.55 |
| The net | About 1,100 nodes on a 16:9 screen (0.4.1, "more of the net … Fills the screen"; 340 in 0.4.0), in a box 9.2 × 5.2 × 8 that wraps in depth and reaches every edge and corner. Each listens to one random band, coloured by it. It's quiet, "the same quiet stage" (a link 0.08–0.46 bright with a slim glow, a node 4–16 px), so the pulse and marks are the show. It holds still |
| Grows and shrinks | Each node has a rank, mostly random (a little lower near the centre line), plus a spine within 0.7 of it that's nearly always there. The loudness (eased over 1.2 s) sets how many ranks are present: about a third when silent, spread over the whole screen, and all of them by level 0.55. Nodes fade in over 0.5 s and out over 1.4 s |
| Depth | Nodes fade in from the far dark over a long curve, and out as they near the camera (gone by depth 0.35, full by 1.1), so nothing pops and nothing near is drawn huge. A first try faded only the last far units, and the far field piled up into a white knot at the centre |
| Glow | A link's glow width follows its importance: slim for a quiet link, GLOW's full width for a marked or loud one (0.4.1: crisper, and much less to draw) |
| Trails | Off by default. On, warp streaks push out from the centre (faster when loud), shown at 40% behind the live picture and lasting 0.05–0.6 s |

### 4.3 CODE RAIN EQ (0.5.0)
A tunnel of code rushing out of a vanishing point on the horizon, a warp behind it, and a heart monitor scanning the horizon. It was found over eight rounds of mock-ups (`mockups/code-rain*/`):
- **Directions:** A CASCADE, B STRATA, C TUNNEL. "Let's try 6 different mock ups for TUNNEL".
- **TUNNEL variations:** C1 RUSH to C6 ECHO. "can you do a combination of C1 and C5?" gave three blends (SURGE, LAYERS, STRETCH): "I like Layers - C8".
- **The horizon:** "can you have there be a dynamic horizon instead of the light beaming in the centre?" (RIDGE, PULSE, BANK), then "keep the straight line and get rid off the bouncing line above it, have the horizon straight line react by how it glows".
- **The heartbeat:** "I want the horizon the change as if it's a heartbeat pattern line" (OUTWARD, MONITOR): "I like monitor". Six MONITOR variations: "I like M4 SCAN". Six SCAN variations: "Let's go with S5 BOUNCE".

| Part | How it looks |
|---|---|
| The view | Down a tunnel from the vanishing point, which sits on the horizon in the middle of the view. Things fade in over the far third and out just before the camera |
| The code | 120 streams of glyphs round the axis, each on its own band and coloured by it, the head near-white. Louder: faster, with a longer trail (5–23 glyphs). The treble flickers the glyphs; a beat flares the bass streams' heads with a soft glow. The glyphs are cyberdeck's MATRIX RAIN set: mirrored half-width katakana where a system font has them, digits, a few letters and symbols, each with a soft glow as strong as GLOW |
| The warp | 220 thin streaks anywhere across the view, behind the code and dimmer. Their length follows the flight: dots at cruise, long streaks when a beat surges it. The code keeps its own pace, nudged by the flight, so the layers feel joined |
| The flight | Eases toward a cruise plus the level plus the beat's surge: up in 0.1 s, down over 0.35 s. It never jumps |
| The horizon | One straight line across the view, through the vanishing point. It never moves; its glow reacts: a halo, taller and brighter where its band is loud (bass in the middle, treble toward the edges; squared, so quiet stays calm), under a faint haze, all brighter with the level |
| The heartbeat | Flat between beats. Each beat draws a heartbeat: a dip, a sharp spike 28 ms after the kick (taller for a stronger beat), a dip, then a rounded bump. With no beat for 1.6 s, a small resting heartbeat every 1.1 s, so the line never flatlines |
| The scan | A bright point sweeps across the horizon and back, 2 s each way, writing the heartbeat (mirror-wise on the way back). The trace fades behind it over about a second |
| The beam | The point carries a soft column of light up and down the view, brightest at the horizon, flaring with each spike. The code under it lights up |
| Trails | None: the code reads clearest crisp |

### 4.4 Coming
CYMATIC PLATE (S6), described in PLAN.md R24. It starts from 2–3 mock-up directions or a reference image.
