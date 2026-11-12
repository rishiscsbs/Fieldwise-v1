# Fieldwise design system

Premium agritech. Calm and trustworthy on daily-use screens; cinematic only on the landing page and pitch mode.
The palette comes from the field itself: **soil** (laterite and black regur), **monsoon** clouds, **mustard** in bloom and **young leaves**.

Tokens live in `src/styles/tokens.css` as CSS custom properties and are exposed to Tailwind in `tailwind.config.ts`.
Components use **semantic** tokens (`--bg`, `--text`, `--primary` …), never raw palette values, so dark mode is a token swap.
A live reference is at `/design` in the running app.

## Colour

### Palette (primitive)

| Family | 900 | 700 | 500 | 300 | 100 |
|---|---|---|---|---|---|
| Soil | `#2B1D14` | `#5A3A26` | `#8A5A3B` | `#C9A487` | `#F1E6DA` |
| Monsoon | `#14232E` | `#24465A` | `#3D6E8A` | `#8DB3C7` | `#E3EEF3` |
| Mustard | `#5C4300` | `#8F6A00` | `#D9A21B` | `#F2CF6B` | `#FBF1D3` |
| Leaf | `#163A20` | `#2F7A43` | `#3E9B55` | `#9BD18F` | `#E6F4DF` |
| Paper / ink | paper `#FBF8F2` | | | | ink `#1D1A16` |

### Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | paper `#FBF8F2` | `#14100C` | Page background |
| `--surface` | `#FFFFFF` | `#1E1813` | Cards, panels |
| `--surface-2` | `#F4EEE4` | `#28201A` | Insets, table stripes, inputs |
| `--border` | `#E4DACB` | `#3A3028` | Hairlines |
| `--text` | ink `#1D1A16` | `#F3EDE4` | Body text |
| `--text-muted` | `#6B5E52` | `#B8AB9C` | Secondary text (AA on `--bg` and `--surface`) |
| `--primary` | leaf-700 `#2F7A43` | `#7CC487` | Primary actions, links, selection |
| `--primary-ink` | `#FFFFFF` | `#0E2414` | Text on `--primary` |
| `--accent` | mustard-500 `#D9A21B` | `#E8B93A` | Highlights, the chosen crop, celebration. Never body text |
| `--focus` | monsoon-500 `#3D6E8A` | `#8DB3C7` | 3px focus ring |

**Status colours are reserved for status** (badges, callouts, alerts) and always come with an icon or text, never colour alone:

| Token | Light | Dark |
|---|---|---|
| `--good` | `#2F7A43` | `#7CC487` |
| `--warn` | `#A86410` | `#E6A44A` |
| `--bad` | `#B3412E` | `#EE8572` |
| `--info` | `#3D6E8A` | `#8DB3C7` |

Each has a `-soft` background (`--good-soft` …) for callouts.

**Chart series** use `--series-1..4` in order: leaf, monsoon, mustard, soil. Charts always have a table view.

### Contrast (WCAG AA)

Measured, all at least 4.5:1:

- Light: `--text` on `--bg` 16.4:1 · `--text-muted` on `--bg` 5.9:1, on `--surface-2` 5.4:1 · `--primary` text on `--bg` 5.0:1 · white on `--primary` 5.3:1 · `--warn` on white 4.7:1 · `--bad` 5.7:1 · `--info` 5.5:1
- Dark: `--text` on `--bg` 16.3:1 · `--text-muted` on `--surface` 7.8:1 · `--primary-ink` on `--primary` 7.9:1 · status colours on `--surface` 6.9–8.5:1
- Mustard is a fill only; text on it uses ink (7.5:1).

## Type

One display face and one text face, both with Devanagari, self-hosted via `@fontsource` so they work offline:

- **Display: Rozha One** (one weight). High-contrast and editorial, for page titles, KPI numbers and landing headlines. Use at 24px or larger.
- **Text: Mukta** (400, 500, 600, 700). Humanist and very legible in both scripts at small sizes, for everything else.

| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 18 | Captions, chart ticks |
| `text-sm` | 14 / 21 | Secondary text, table cells |
| `text-base` | 16 / 26 | Body (min size for body copy) |
| `text-lg` | 18 / 28 | Lead paragraphs |
| `text-xl` | 20 / 30 | Card titles (Mukta 600) |
| `text-2xl` | 24 / 32 | Section titles (display) |
| `text-3xl` | 30 / 38 | Page titles (display) |
| `text-4xl` | 38 / 46 | KPI numbers |
| `text-5xl` | 48 / 56 | Landing subheads |
| `text-6xl` | 64 / 70 | Landing hero |

Line heights are slightly taller than usual because Devanagari has tall matras. Numbers use `font-variant-numeric: tabular-nums` in tables and KPIs.

## Space, shape, depth

- **Spacing**: 4px base, Tailwind's default scale. Card padding 20px (16px on phones); page gutter 16px on phones, 32px on desktop.
- **Radius**: `--r-sm` 6px (badges, inputs), `--r-md` 10px (buttons), `--r-lg` 16px (cards), `--r-xl` 24px (hero panels, sheets).
- **Shadows** are warm-tinted, never grey-blue: `--shadow-1` for cards, `--shadow-2` for popovers, `--shadow-3` for dialogs.
- **Touch targets** are at least 44 × 44px.

## Motion

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120ms | Hover, press |
| `--dur-2` | 200ms | Toggles, small reveals |
| `--dur-3` | 320ms | Page and panel transitions |
| `--dur-4` | 600ms | Count-ups, chart entry |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Most transitions |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Camera moves, scroll story |
| Spring | stiffness 420, damping 32 | Toggles, magnetic buttons |

Rules:

- `prefers-reduced-motion: reduce` keeps fades only: no parallax, scroll-jacking, particles or count-ups.
- **Lite mode** (auto on low-end devices, or set manually) swaps 3D for static images, cuts particles and turns off post-processing.
- Motion confirms an action or shows a change of place. It never delays reading.

## Voice

Plain, short, sentence case. Buttons say what they do ("Send question", "Save farm"). Every string exists in English and Hindi.
Simulated data always carries a visible "Simulated" badge.
