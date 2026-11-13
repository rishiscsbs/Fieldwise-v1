# UI redesign: "Living field"

Branch `ui-redesign`, one commit per step. Frontend only: no API, schema or engine changes.
Screenshots: `before/` (every screen, before the redesign) and `after/` (the six main screens: landing, login,
overview, crop planner, weather, pitch), each at 1440 px and 390 px in English/light and Hindi/dark.
Full-page captures do not show WebGL (it does not paint in full-page mode), and the signature pieces upgrade on
the first interaction, so the after shots show their plain versions.

## What changed

- **Seasonal themes.** Kharif (monsoon green, rain slate), Rabi (mustard gold, morning blue) and Zaid
  (terracotta, ochre) palettes in light and dark, following the field's season; picking a season sweeps the new
  colours across the page. Status colours and chart series stay fixed.
- **Glass over earth.** A slowly drifting soil-and-leaf texture behind the app, glass header and sidebar, solid
  cards for data, Baloo 2 display type with monumental KPI numbers. `DESIGN.md` v2 documents the system.
- **Signature pieces (React Bits)**, vendored and wrapped with Lite and reduced-motion fallbacks: Grid
  Distortion (landing and login photos), Tech Text (wordmark), Flex Carousel (crop strip, planner gallery, pitch),
  Option Wheel (season, crop and soil pickers over a real select), Specular Button (one primary action a screen).
- **Screens.** Landing hero and crop strip, split login with role cards, weather-reactive overview header, season
  wheel and gallery in the planner with growing-plant score bars, sacks dropping into a cart and a growing-crop
  schedule for nutrients, tactile symptom chips with a scan and flip-in results, a sky banner and illustrated
  week for weather, a glowing best market and dashed MSP line, a chat-style advisory desk with a paper-plane send,
  a farmland-styled district map, and a pitch deck that opens on the wordmark.
- **Delight.** Seed-to-plant onboarding (now three steps, with an optional soil card), crop-coloured bursts,
  sleepy-scarecrow and waiting-bird empty states, a reply chime (off by default), haptics on Android, and typing
  "monsoon" in the command palette.
- **Accessibility.** Contrast is checked by script for every season and theme (`npm run contrast`); axe finds no
  serious or critical problems on any main screen in either language or theme. Fixed on the way: `--warn` failed AA
  on its soft background, and charts and maps hid focusable parts inside `role="img"`.
- **Photos** are royalty-free (Unsplash) and credited in `apps/web/public/CREDITS.md`; all drawings are original.

## Numbers

| | Before | After |
|---|---|---|
| App shell JS (gzipped) | 124.6 KB | 128.6 KB |
| Lighthouse accessibility (all pages measured) | 100 | 100 |
| Lighthouse best practices | 100 | 100 |
| Lighthouse performance, landing `/` (mobile, median of 3) | 77–86 | 77 |
| Lighthouse performance, login (median of 3) | 90 | 84 |
| Lighthouse performance, overview `/app` | 90 (one run) | 62 in the final single run; 72–86 in earlier runs |
| Unit tests | 89 pass | 89 pass |
| E2E tests | 11 | 29 (new `redesign.spec.ts`) |

Lighthouse ran on the development machine with both dev servers, two preview servers and the API running, so
scores move by about ±8 points between identical runs; treat them as rough. In a real browser at 4× CPU
throttling the redesigned overview, login and landing reach their largest paint as fast as or faster than before
(overview about 1.9–2.4 s vs 2.7 s), but they do more style and layout work (glass blur, the texture layer, more
elements), which Lighthouse's simulated slow phone counts against them. **The 90+ performance target is not met**
on the overview or login; accessibility and best practices are at 100.

## Tests

- Last full e2e run (29 tests): 23 passed, 2 failed, and 4 did not run (the signed-in serial block stops at its
  first failure, so the empty-state, onboarding and monsoon tests were skipped; they have not yet passed as e2e
  tests, though the same behaviour was checked by a scripted browser run in step 7). The two failures were in the
  tests, not the app:
  - The officer test looked for the district map as an `img`; it is now a labelled `group`. Updated, and it passes.
  - The new signed-in Lite test wrote settings that its own setup script overwrites. It now uses the real Lite
    switch in the menu. Its checks pass when run by hand on a saved session (Lite on, plain selects, no canvas,
    no errors). Its e2e re-run was blocked by the API's limit of 5 sign-in codes per number every 10 minutes.
- Typecheck, lint, the contrast check, unit tests and the production build all pass.

## Left to do

- Re-run `npm run e2e` once more after a 10-minute gap to confirm the updated Lite test.
- If the performance target matters for judging, the next step is reducing style and layout cost on the overview
  (fewer glass layers on phones, a lighter texture) and measuring on a quiet machine.
