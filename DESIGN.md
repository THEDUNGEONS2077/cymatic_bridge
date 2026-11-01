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

### 4.2 Coming
PLEXUS (S4), CODE RAIN EQ (S5) and CYMATIC PLATE (S6), described in PLAN.md R24. Each starts from 2–3 mock-up directions or a reference image.
