# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Fieldwise is a crop advisory platform for Indian smallholder farmers (Smart India Hackathon).
v2 is an npm-workspaces monorepo being built in phases from `BUILD_PROMPT.md`. The original static app is kept unchanged in `legacy/`.

- `packages/shared` — types, zod schemas, reference data, the agronomy engine and all UI strings (i18next JSON).
- `apps/api` — Fastify 5 + Prisma (SQLite in dev; schema is Postgres-portable) + JWT/OTP auth. OpenAPI at `/docs`.
- `apps/web` — React 18 + Vite 5 + Tailwind 3. Design tokens and rules in `apps/web/DESIGN.md`.

## Run and check

- `npm install && npm run dev` builds shared, creates/seeds the database if empty, and starts API (:4000) and web (:5173).
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` must all pass before a phase is done.
- With `npm run dev` running, `node scripts/screenshots.mjs [route ...]` screenshots routes at 1440 and 390 px in English/light and Hindi/dark into `screenshots/`, and fails on console errors or sideways scrolling. Look at the images.
- `npm run db:reset -w @fieldwise/api` wipes and reseeds the dev database.

## Architecture

- **The engine is pure.** Functions in `packages/shared/src/engine` take `(profile, ReferenceData, today)` and never read globals or translate. Reasons and advice come back as `{ ok, key, args }` codes; the UI renders them with `translateReason` and the `advice` namespace.
- **The engine must match the legacy app.** `scripts/capture-legacy-golden.mjs` runs `legacy/js/*.js` in a sandbox and records outputs; `packages/shared/test/legacy-golden.test.ts` compares. Only regenerate fixtures if you deliberately change behaviour, and say so.
- Reference data (crops, pests, districts…) is seeded from `packages/shared/src/data` into the database, and the API loads it back with `loadReference()` so admin edits reach the engine. Lists and labels are JSON strings in the DB, parsed with zod in `apps/api/src/lib/json.ts`.
- `packages/shared` is consumed from `dist/`; rebuild it (`npm run build -w @fieldwise/shared`) after changing it.
- The web app calls the API through the Vite proxy at `/api`, so the refresh-token cookie (`fw_rt`, path `/api/auth`) stays same-origin.
- API routes: request and response shapes are zod schemas in `packages/shared/src/schemas/api.ts`. Throw `HttpError` (`badRequest`, `notFound`, `forbidden` in `apps/api/src/lib/http.ts`) for user-facing errors. Access rules live in `apps/api/src/lib/access.ts`.
- Live updates: emit through `app.rt.emit(rooms.user(id) | rooms.officers(district), event, payload)`; event types are `ServerToClientEvents` in shared. Use `notify()` to store a notification and push it.
- External data never blocks a screen: weather falls back to the simulator, mandi falls back from Agmarknet to the simulator, and both report `source` / `simulated` so the UI can label them. Tests inject `fetchImpl`; no test touches the network.
- Uploads are JPEG/PNG only (checked by magic bytes), decoded with pure-JS `jpeg-js`/`pngjs`, and served by signed URLs. Leaf analysers implement `LeafAnalyser` in `apps/api/src/services/analysers`.

## Web app

- Routes live under `/app` (lazy-loaded pages in `apps/web/src/routes`); `/` is the public front page. Keep the first-load JS under 200 KB gzipped: import shared *types* via `lib/api-types.ts`, and never import zod or reference data into the shell.
- Data comes through TanStack Query hooks in `lib/queries.ts` (keys in `qk`). Live socket events in `lib/socket.ts` invalidate those keys. Every async view shows a skeleton, and errors show `ErrorState` with a retry.
- Text helpers: `useFmt()` gives `t`, `label()` (pick `{en, hi}`), `reason()` (engine reason codes), and number/date formatters for the current locale. Pages set what "Read aloud" speaks with `useSay()`.
- Charts (`src/charts`) follow the dataviz rules: series tokens in fixed order, every chart wrapped in `ChartFrame` with a table view, hover/focus tooltips, legends for 2+ series. Mustard is below 3:1 on white, so keep the direct labels.
- Motion: framer-motion `m.*` components only (LazyMotion strict); celebration bursts go through `burst()` in `lib/effects.ts`, which skips reduced motion and Lite mode.
- Colour tokens are functions in `tailwind.config.ts` so opacity modifiers work (`bg-surface/85` → `color-mix`). Plain classes stay as `var()`; don't switch them to `color-mix` (older WebViews lack it).
- Seasons: `<html data-season>` picks the palette (`lib/season.ts`: picked by hand, else the active field, else the date). Each season block in `tokens.css` sets the same properties in light and dark. Run `npm run contrast` after changing any colour token.
- Signature pieces (React Bits) are vendored in `components/reactbits`; only use them through the wrappers in `components/signature`, which lazy-load them in full motion and fall back in Lite and reduced motion. Data never sits on glass.
- Hindi text must not be letter-spaced: `[class*='tracking-']` is reset under `html[lang='hi']`.
- Landing (`/`, `src/routes/Landing.tsx`, `src/landing/*`): one fixed WebGL canvas (`World.tsx`, React Three Fiber, no model files) driven by the mutable `story` object that `useScrollStory` updates from GSAP ScrollTrigger; never put scroll progress in React state. `useMotionMode()` decides full (3D + Lenis), lite (still JPEGs in `public/lite`) or reduced (stacked page, fades only). After changing the 3D world, regenerate the stills with `node scripts/capture-stills.mjs` and check the story with `node scripts/landing-tour.mjs [--reduced|--lite] [--phone] [--hi]`.
- Pitch deck: `/pitch` (`src/routes/Pitch.tsx`, `src/pitch/*`) reuses the landing world plus a data centre (`PitchWorld.tsx`); slides and camera targets are in `slides.ts`, text and speaker notes under `app:pitch`. `/pitch/presenter` stays in step over BroadcastChannel (`sync.ts`). Check visually with `node scripts/pitch-tour.mjs`.
- three.js types are pinned to `@types/three@0.169.0` via root `overrides` to match `three@0.169`.
- E2E: `npm run e2e` (Playwright) against a running stack; `BASE_URL` overrides the web address. The suite signs each role in once because the API limits OTP requests per number.

## Conventions

- **Every user-facing string needs English and Hindi.** `common` and `advice` namespaces are converted from `legacy/js/i18n.js` by `npm run i18n:convert` — don't hand-edit them; add new strings to `app.json` in every `locales/<lang>/` folder. Data labels are `{ en, hi }` objects read with `pick()`.
- Colours come from the semantic tokens in `apps/web/src/styles/tokens.css` via Tailwind (`bg-surface`, `text-fg-muted`, `bg-primary`…). Status colours are reserved for status and always paired with an icon or text; chart series use `series-1..4` in order.
- Tailwind only sees complete class names — never build them with string interpolation.
- Wrap `localStorage` access in try/catch (the zustand store uses a safe storage wrapper).
- Validate every API input with zod schemas from `packages/shared`. Never return OTP codes outside development.
- Keep the UI copy plain and in sentence case. Buttons say what they do.
- Agronomic numbers (MSP, doses, fertiliser prices) are indicative; label simulated data as simulated in the UI.

## Windows notes

- The native Rollup binary is blocked by Application Control on the dev machine, so the root `package.json` overrides `rollup` with `@rollup/wasm-node`.
- In Git Bash, pass routes to the screenshot script without the leading slash (`design`, not `/design`).
