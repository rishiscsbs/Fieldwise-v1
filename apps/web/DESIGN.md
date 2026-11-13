# Fieldwise design system — v2 "Living field"

The interface should feel like the land itself: alive, seasonal and responsive. Magical and playful at brand
moments, calm and legible wherever a farmer reads numbers. It must stay fast on a cheap Android phone.

Tokens live in `src/styles/tokens.css` as CSS custom properties and are exposed to Tailwind in `tailwind.config.ts`.
Components use **semantic** tokens (`--bg`, `--text`, `--primary` …), never raw palette values, so dark mode and the
seasons are token swaps. A live reference, including the season wheel and the signature pieces, is at `/design`.

**What changed from v1:** the palette now shifts with the season; glass panels and a drifting field texture add
depth; Baloo 2 replaces Rozha One as the display face; radii are larger; there is a glass elevation and a 900 ms
sweep duration; five React Bits components are the signature pieces.

## Seasons

`<html data-season="kharif|rabi|zaid">` picks the palette. The season is, in order: the one picked by hand on a season
wheel (`pickSeason()` in `src/lib/season.ts`, persisted), the active field's season, then today's date
(Jun–Sep kharif, Oct–Feb rabi, Mar–May zaid). `index.html` sets it before first paint.

Changing season **sweeps** the new palette across the page as a growing circle from the control that changed it
(View Transitions API, `--dur-5` / `--ease-in-out`). Lite mode, reduced motion and browsers without View
Transitions swap instantly with a short background fade.

| Token | Kharif — monsoon greens, rain slate | Rabi — mustard gold, cool morning | Zaid — terracotta, dry-earth ochre |
|---|---|---|---|
| `--bg` | `#f2f6f1` / `#0c1511` | `#fbf8ee` / `#13110a` | `#fbf4ec` / `#150e0a` |
| `--surface` | `#ffffff` / `#141f1a` | `#ffffff` / `#1d1a11` | `#ffffff` / `#201611` |
| `--surface-2` | `#e5ede5` / `#1c2a23` | `#f4eedb` / `#27231a` | `#f5e8da` / `#2b1f18` |
| `--border` | `#d0ddd2` / `#2b3b33` | `#e5dbc0` / `#3a3426` | `#e8d4c0` / `#3e2e25` |
| `--text` | `#13201a` / `#e7f0ea` | `#1e1a0f` / `#f4eedc` | `#22160f` / `#f6ece3` |
| `--text-muted` | `#4c5e55` / `#a3b6ac` | `#605641` / `#bcb096` | `#694f3f` / `#c4ae9d` |
| `--primary` | `#1d6a44` / `#6cc793` | `#7a5600` / `#f0c24b` | `#a3442a` / `#ee9a78` |
| `--primary-ink` | `#ffffff` / `#07261a` | `#ffffff` / `#2a1e00` | `#ffffff` / `#2e0f04` |
| `--accent` | `#6c9ec0` / `#7fb0cd` | `#e0a815` / `#f0c24b` | `#c98a1e` / `#e3b058` |
| `--accent-soft` | `#dfeaf1` / `#182833` | `#fbf0cd` / `#3a2f12` | `#f8e9cf` / `#362612` |
| `--season-a/b/c` | leaf, slate, mist | gold, morning sky, straw | terracotta, ochre, sand |

Values are light / dark. Each season block sets exactly the same properties in light and dark, so a light value can
never leak into dark mode. Rabi's gold is a **fill only**: Rabi buttons and links use a deep mustard-brown.

**Fixed across seasons** (they carry meaning, not mood): status colours, chart series, the focus ring's role.

- `--season-a/b/c` are for washes, gradients, sky banners and the field texture. Never text.
- `--accent` highlights the chosen crop, the selected wheel row and celebrations. Text on `--accent` uses ink;
  text on `--accent-soft` uses `--text`.

### Status

| Token | Light | Dark |
|---|---|---|
| `--good` | `#2F7A43` | `#7CC487` |
| `--warn` | `#93560A` (was `#A86410`: it failed AA on `--warn-soft`) | `#E6A44A` |
| `--bad` | `#B3412E` | `#EE8572` |
| `--info` | `#3D6E8A` | `#8DB3C7` |

Status colours are reserved for status and always come with an icon or text. Each has a `-soft` background.

### Chart series

`--series-1..4` (leaf, monsoon, mustard, laterite rose) in fixed order, unchanged from v1 and validated with the
dataviz checker. Seasonal colour reaches charts through their chrome (highlight band, glow on the best line,
the accent on the chosen crop), not by recolouring series. Mustard is under 3:1 on white, so charts keep direct
labels and a table view.

### Contrast

`node scripts/check-contrast.mjs` (also `npm run contrast`) reads `tokens.css` and checks every season × theme:
text and muted text on the page, surfaces, glass over the page and texture, and `--glass-strong` over pure black
and pure white (glass over photos); primary as text; ink on primary; status colours on surfaces and their soft
backgrounds; and the focus ring at 3:1. It exits non-zero on any failure. All six combinations pass AA.

## Glass over earth

- **Field texture** (`.field-bg`, one per page, behind everything): season-tinted radial washes plus soil grain and
  leaf veins (`public/textures/field.svg`, original, used as a mask in `--texture-ink`). It drifts very slowly;
  it is static in Lite mode and still under reduced motion.
- **Glass** (`.glass`): `--glass` with an 18 px backdrop blur and saturation, `--glass-border` hairline and
  `--shadow-glass`. Without backdrop-filter support, or in Lite mode, it uses the more opaque `--glass-strong`.
  Glass is for chrome and hero moments (header, sheets, hero panels, login form). **Over photos always use
  `--glass-strong`** (`bg-glass-strong`).
- **Data stays on solid surfaces.** KPI values, tables, charts and forms sit on `.card` (`--surface`).

## Type

Both faces have Devanagari and are self-hosted via `@fontsource` so they work offline.

- **Display: Baloo 2** (600, 700, 800). Round, warm and confident; playful without being childish, and its
  Devanagari is excellent. `.font-display` defaults to 700. Use at 20 px or larger.
- **Text: Mukta** (400–700). Humanist and very legible in both scripts at small sizes.

| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 18 | Captions, chart ticks |
| `text-sm` | 14 / 21 | Secondary text, table cells |
| `text-base` | 16 / 26 | Body (min size for body copy) |
| `text-lg` | 18 / 28 | Lead paragraphs |
| `text-xl` | 20 / 30 | Card titles (Mukta 600) |
| `text-2xl` | 24 / 32 | Section titles (display) |
| `text-3xl` | 30 / 38 | Page titles (display) |
| `text-4xl` | 38 / 46 | Large numbers |
| `.num-hero` | clamp(40 → 60) / 1 | Monumental KPI numbers (display 800, tabular) |
| `text-5xl` | 48 / 56 | Landing subheads |
| `text-6xl` | 64 / 70 | Landing hero |

Line heights are tall because Devanagari has tall matras. Numbers use `tabular-nums` in tables and KPIs.
Hindi is never letter-spaced (`[class*='tracking-']` is reset under `html[lang='hi']`).

## Space, shape, depth

- **Spacing**: 4 px base. Card padding 20 px (16 px on phones); page gutter 16 px on phones, 32 px on desktop.
- **Radius**: `--r-sm` 8 px (badges, inputs) · `--r-md` 12 px (buttons) · `--r-lg` 20 px (cards) · `--r-xl` 28 px
  (glass panels, sheets) · `--r-2xl` 36 px (hero panels).
- **Elevation**: `--shadow-1` cards · `--shadow-2` popovers and primary buttons · `--shadow-3` dialogs ·
  `--shadow-glass` glass panels (top highlight, contact shadow, long soft drop). Warm-tinted in light, black in dark.
- **Parallax**: glass hero panels may tilt up to 4° toward the pointer (desktop pointers, full motion only).
- **Touch targets** are at least 44 × 44 px.

## Motion

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120 ms | Hover, press |
| `--dur-2` | 200 ms | Toggles, small reveals |
| `--dur-3` | 320 ms | Page and panel transitions |
| `--dur-4` | 600 ms | Count-ups, chart entry, gauges filling |
| `--dur-5` | 900 ms | Season sweep, big reveals |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Most transitions |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Camera moves, scroll story, season sweep |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Playful overshoot: sacks landing, chips lighting up |
| Spring (framer) | stiffness 420, damping 32 | Toggles, magnetic buttons |

Three motion modes come from `useMotionMode()`:

- **Full**: everything, including WebGL signature pieces, weather effects and bursts.
- **Lite** (automatic on weak devices or a slow frame-rate probe, or set by hand; `html[data-lite]`): still images
  instead of WebGL, `<select>` instead of the wheel, a scrollable row instead of the carousel, no glass blur,
  no weather effects, no bursts.
- **Reduced** (`prefers-reduced-motion`): fades only. No distortion, parallax, particles, count-ups or sweep.

Motion confirms an action or shows a change of place. It never delays reading.

## Signature pieces (React Bits)

Vendored with `npx shadcn add @react-bits/<Name>-TS-TW` into `src/components/reactbits/` (local changes marked
"Fieldwise:"). **Never import them directly**: use the wrappers in `src/components/signature/`, which lazy-load
the component only in full motion and supply the fallback. Restraint is what makes them special.

| Wrapper | Component | Where | Fallback |
|---|---|---|---|
| `Wordmark` | Tech Text | Landing hero, login, pitch title. Never body text or headings | The word in Baloo 2 |
| `HeroImage` | Grid Distortion | Landing hero, login. Never behind data | The `<img>` (always underneath) |
| `CropStrip` | Flex Carousel (`ogl`) | Landing crop strip, planner gallery, pitch impact slide | Scroll-snapping row |
| `WheelPicker` | Option Wheel | Season, crop on nutrients and market, soil type | Visible `<select>` |
| `PrimaryAction` | Specular Button | One or two primary actions per screen | `Button variant="primary"` |

- `WheelPicker` always renders a real `<select>`: hidden under the wheel in full motion it carries focus, keyboard
  and screen readers; the wheel follows its value and adds drag, scroll and tap.
- Each `PrimaryAction` and `HeroImage` owns a WebGL context: never put them in lists.
- `CropStrip` does not capture the vertical wheel, so it never traps page scroll.

## Delight

Small moments that reward an action. All are skipped in Lite mode and for reduced motion unless noted, and none
of them carries meaning on its own: the text always says what happened.

| Moment | Where | How |
|---|---|---|
| Seed to plant | Onboarding (`Growth`) | Seed when the name is in, sprout at the soil card, full plant in grain on finish |
| Crop burst | "Grow this" | `burst(from, CROP_BURST[crop])`: golden grains for wheat, white puffs for cotton, red for tomato… |
| Paper plane | Every question, reply and alert | `flyPlane(button)` (Web Animations API) |
| Reply chime | A farmer receives an officer's reply | `chime()` in `lib/sound.ts`, WebAudio, **off by default** (menu → Sounds) |
| Haptics | Grow this, send, check my crop, a reply arriving, finishing onboarding | `haptic()`; Android browsers that support it; never for reduced motion |
| Empty states | No alerts, no questions, an empty officer queue | `EmptyState` with a sleepy scarecrow or a waiting bird, plus a next action |
| Monsoon | Type "monsoon" (or मानसून) in the command palette | `makeItRain(5000)`: rain across the whole app for five seconds |

## Voice

Plain, short, sentence case. Buttons say what they do ("Send question", "Save farm"). Every string exists in English
and Hindi. Simulated data always carries a visible "Simulated" badge. Photos are royalty-free and credited in
`public/CREDITS.md`; illustrations are original.
