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
