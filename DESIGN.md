# Design

How cymatic_bridge looks, and why. It inherits cyberdeck_terminal's design system (its DESIGN.md § 3): JetBrains Mono, the colour roles, the 4 pt grid, the lit frame, small crisp uppercase text. What's its own is below.

## 1. Principles
- **The visual is the page.** It fills the window. The HUD is one thin bar over it (R11), hidden with H, gone in fullscreen (F).
- **Never a dead page.** Before LISTEN and in silence, the scene breathes (R14).
- **Seamless and smooth** (cyberdeck's rule): no visible cuts, bands or hard edges. Lines glow (bell core and Gaussian glow); faint fades are dithered.
- **Colour means frequency.** The bass sits at the palette's accent and the treble at its cool hue, lifted toward bright when loud (R22).
- **Flashes are rare and soft:** only the limited beat accent (≤3 a second, ≤0.8) may flash the picture (R18).

## 2. Palettes
A palette is cyberdeck's twelve roles, true black behind everything. cymatic_bridge's palettes are a fresh set of neon pairs (R21); the four to start come in S3, proposed for the user to pick.

| Palette (id) | Origin | Accent (bass) | Cool (treble) | Bright |
|---|---|---|---|---|
| UV (`uv`) | 0.1.0, provisional: ultraviolet over acid teal, to build SIGNAL with | `#c25bff` | `#20e0c0` | `#ecd6ff` |

The contrast rule: every text colour passes WCAG AA (4.5:1) on bg, surface and raised, and bright text passes on the wash. The test checks it.

## 3. The HUD
- **The bar:** 36 px tall, full width, black at 72% with a lit lower edge (`--line-lit`) and the softest glow.
  - The brand `<cymatic_bridge>` sits in the accent.
  - Buttons have cyberdeck's lit frame and are 24 px tall. LISTEN is in the accent.
  - The title sits in the middle, bright, uppercase and cut with an ellipsis (S2).
  - The scene name is on the right between ‹ ›.
- **The bar takes the showing scene's palette.**
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
