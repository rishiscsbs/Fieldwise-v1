# UI redesign brief: make Fieldwise marvelous

The app works. The backend, API, auth, sockets and advisory engine are done and must not change. The problem is the frontend: it looks like every other dashboard. Redesign `apps/web` so it feels magical, playful and premium, the kind of interface judges remember and farmers enjoy opening, while staying fast on a cheap Android phone.

## Ground rules

1. **Work on a branch:** `git checkout -b ui-redesign`. Commit after every step so I can roll back.
2. **Read first:** `apps/web/DESIGN.md`, the current routes and components, and `CLAUDE.md`. Then give me a short plan with screenshots of the current state (Playwright, 1440px and 390px). Wait for my "go".
3. **Frontend only.** No API, schema or business-logic changes. If the UI needs new data, ask me first.
4. **Never break what works:** both languages (English and Hindi), every role (farmer, officer, admin), Lite mode, `prefers-reduced-motion`, keyboard use, and the PWA.
5. **Verify each step:** type check, lint, unit tests, Playwright e2e tests and a production build all pass. Take screenshots at 1440px and 390px, look at them, and fix anything clumsy before you show me.

## Reference components (React Bits)

Install these five with the shadcn CLI. If the project has no `components.json`, set up shadcn for Vite + Tailwind first. If the CLI fails, copy the TypeScript + Tailwind source from the React Bits site or GitHub into `src/components/reactbits/`. After installing, **read each component's source** to learn its real props and dependencies (some use WebGL/three.js) before using it.

```
npx shadcn@latest add @react-bits/TechText-TS-TW
npx shadcn@latest add @react-bits/FlexCarousel-TS-TW
npx shadcn@latest add @react-bits/OptionWheel-TS-TW
npx shadcn@latest add @react-bits/SpecularButton-TS-TW
npx shadcn@latest add @react-bits/GridDistortion-TS-TW
```

| Component | What it does | Where to use it |
|---|---|---|
| **Tech Text** (reactbits.dev/text-animations/tech-text) | A wordmark whose letters turn into dashed vector paths under the cursor | The **Fieldwise** wordmark in the landing hero, login screen and pitch-mode title slide. Brand moments only, never on body text or every heading |
| **Flex Carousel** (reactbits.dev/components/flex-carousel) | An infinite image row that flows through liquid glass at its edges | Landing: a "crops we advise on" strip. Crop planner: an optional gallery of the in-season crops (photo, name, score). Pitch mode: the "impact" slide |
| **Option Wheel** (reactbits.dev/components/option-wheel) | A curved picker where items tilt away at the edges; spins with scroll, drag or arrow keys | The **season picker** (Kharif / Rabi / Zaid), the **crop picker** on the nutrient plan and market pages, and soil type on the farm profile. Keep a regular `<select>` as the fallback for Lite mode and screen readers |
| **Specular Button** (reactbits.dev/components/specular-button) | A glass button whose edge catches the light, with a highlight that follows the cursor | **Primary actions only:** "Enter app", "Grow this", "Check my crop", "Send question", "Send alert", "Start pitch". Secondary buttons stay plain so the primary ones stand out |
| **Grid Distortion** (reactbits.dev/backgrounds/grid-distortion) | An image background that breaks into blocks under the cursor and then settles back | **Landing hero background** (an aerial farmland photo that shatters under the cursor) and the **login screen**. Never behind data screens |

Use these as the signature pieces. Restraint is what makes them feel special: each one gets a few hero placements, not every screen.

## Design direction: "Living field"

Make the interface feel like the land itself: alive, seasonal and responsive.

- **Seasonal themes.** The whole palette shifts with the selected season: Kharif in deep monsoon greens and rain-slate blues, Rabi in mustard gold and cool morning tones, Zaid in warm terracotta and dry-earth ochre. Changing the season on the Option Wheel triggers a smooth colour sweep across the app.
- **Weather-reactive UI.** If rain is forecast for today, light rain streaks fall behind the dashboard header. On a hot day, a faint heat shimmer appears; on a clear morning, a soft sun glow. Off in Lite and reduced-motion modes.
- **Glass over earth.** Cards are frosted glass panels over a subtle, slowly drifting soil and leaf texture, with real depth (layered shadows, a gentle parallax on mouse move). Data stays on solid, high-contrast surfaces so numbers are easy to read.
- **Type with character.** Pick a characterful display face for big moments and a clean, readable text face. Both must support Devanagari. Big numbers on KPI tiles should feel monumental.
- **Write `DESIGN.md` v2** with the new tokens (per-season palettes, type scale, radii, elevation, motion durations and easing) before building screens.

## Make it amusing: delight moments

- **Seed to harvest.** The first-run onboarding is a short, playful flow: a seed is planted as the farmer fills in the profile, it sprouts as they add the soil card, and becomes a full plant at the end.
- **Choosing a crop** bursts the crop's own colours (golden grains for wheat, white puffs for cotton, red for tomato) from the Specular Button.
- **The crop-suitability score** fills like a growing plant or rising water, not a plain bar.
- **The fertiliser plan** shows animated sacks that drop into a cart and stack up as quantities load, with the total cost counting up.
- **The irrigation day** in the weather table has a small animated droplet, and soil-moisture gauges fill and drain like water.
- **Crop health:** a scanning beam sweeps over the uploaded leaf, and matched symptom chips light up one by one.
- **The advisory desk:** a sent question flies off as a paper plane, and an officer's reply arrives with a gentle chime (sound off by default, with a toggle).
- **Empty states** feature small original illustrations (a sleepy scarecrow for "no alerts", a waiting bird for "no questions"), each with a clear next action.
- **Easter egg:** typing "monsoon" in the command palette makes it rain across the whole app for 5 seconds.
- **Haptic feedback** (`navigator.vibrate`) on key actions on Android, where supported.

All illustrations must be original (SVG or code-drawn). Photos must be royalty-free (Unsplash or Pexels), with credits listed in `apps/web/public/CREDITS.md`.

## Screen-by-screen

1. **Landing:** a Grid Distortion hero with the Tech Text wordmark, a one-line promise and a Specular "Enter app" button. Then the existing scroll story, restyled to match, with the Flex Carousel crop strip in between.
2. **Login:** a split screen with Grid Distortion on one side and a glass form on the other. Demo accounts appear as tappable role cards.
3. **Overview dashboard:** a weather-reactive header with a greeting in the farmer's language, monumental KPI tiles, and charts restyled with seasonal colours and animated entry. Alerts slide in from the right edge.
4. **Crop planner:** an Option Wheel season switch at the top, a Flex Carousel gallery view and a ranked list view (toggle between them), and growing-plant score bars.
5. **Nutrient plan:** an Option Wheel crop picker, animated sacks and an illustrated timeline of the application schedule.
6. **Crop health:** big tactile symptom chips, the scan animation and result cards that flip in.
7. **Weather & irrigation:** an animated sky banner matching today's forecast, a 7-day strip of illustrated day cards and water gauges.
8. **Market prices:** charts with a glowing best-market line, and an MSP line drawn as a dashed threshold.
9. **Advisory desk and officer dashboard:** a chat-like conversation view, the paper-plane send, and the district heatmap restyled to match.
10. **Pitch mode:** the Tech Text title, the Flex Carousel on the impact slide, and Specular buttons for navigation.

## Performance and accessibility

- Lazy-load every React Bits component and any WebGL. Grid Distortion and Flex Carousel must not load on data pages that don't use them.
- **Lite mode** (automatic on low-end devices, plus the manual toggle) replaces Grid Distortion with a static image, Flex Carousel with a normal scrollable row, Option Wheel with a `<select>`, and turns off weather effects and bursts.
- **Reduced motion:** no distortion, no parallax, no particles, only simple fades.
- Text contrast meets WCAG AA in every seasonal theme, including over glass. Check it with a script, not by eye.
- Every interaction works by keyboard (the Option Wheel already supports arrow keys; make sure focus is visible).
- Keep the app-shell JS budget under 200 KB gzipped. Report bundle sizes before and after.
- Lighthouse 90+ for mobile performance and accessibility on the main app routes.

## Steps

1. Branch, audit screenshots, plan → **wait for go**
2. Design tokens and seasonal themes, `DESIGN.md` v2, and React Bits installed and wrapped with Lite-mode fallbacks
3. Landing and login
4. Overview, crop planner and nutrient plan
5. Crop health, weather and market
6. Advisory desk, officer and admin dashboards, pitch mode
7. Delight pass (onboarding, bursts, empty states, sound, Easter egg)
8. Performance, accessibility and Lite-mode pass, plus updated e2e tests
9. Before/after screenshots of every screen in a `docs/redesign/` folder, then a short summary of what changed

Start with step 1.
