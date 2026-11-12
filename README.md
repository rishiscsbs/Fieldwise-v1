# Fieldwise

Crop advice for India's small farms. Fieldwise turns a farmer's **Soil Health Card**, the **week's weather** and **nearby mandi prices** into one clear plan, in **Hindi and English**: which crop to grow, how many bags of urea, DAP and potash to buy, which days to irrigate and spray, and whether to sell or hold. Farmers ask the district extension officer questions with photos and get answers in real time; officers see their district on a map and send alerts.

Built for Smart India Hackathon. The original static prototype is kept, unchanged, in [`legacy/`](legacy/README.md).

## Run it

Needs **Node 20 or newer** and nothing else. No accounts, keys or paid services.

```bash
npm install
npm run dev
```

On a fresh clone this creates `apps/api/.env`, builds the shared package, creates and seeds a SQLite database, then starts:

| What | Where |
|---|---|
| Landing page (3D scroll story) | http://localhost:5173 |
| Farmer, officer and admin app | http://localhost:5173/app |
| Pitch deck / presenter notes | http://localhost:5173/pitch · http://localhost:5173/pitch/presenter |
| API and OpenAPI docs | http://localhost:4000 · http://localhost:4000/docs |

For the stage, use the **production build**. It is faster, and it is the only mode with the installable app and offline support:

```bash
npm run prod      # builds everything, then serves web on http://localhost:4173 and the API on :4000
```

### Demo accounts

There is no SMS provider. In development the six-digit code is printed in the API console **and** shown on the login screen, which also lists these accounts as one-click buttons:

| Role | Phone | Lands on |
|---|---|---|
| Farmer | +91 90000 00001 (Ramesh Wankhede, Nagpur) | Overview of his field |
| Extension officer | +91 90000 00002 (Anita Deshmukh, Nagpur) | District dashboard |
| Admin | +91 90000 00003 (Vikram Rao) | Administration |

Any other valid Indian mobile number creates a new farmer account and walks through onboarding.

`npm run db:reset` puts the demo data back to its seeded state (do this before a rehearsal).

## Demo script (about 6 minutes)

Set up two browser windows side by side: **A** signed in as the farmer, **B** as the officer. Open the deck in a third window on the projector and press **P** for presenter notes on your laptop screen. The deck and notes stay in step, and either one can move the slides (arrows, space or a clicker).

1. **Problem (slide 1, 45 s).** The farmer, not the tech: a Soil Health Card in a drawer and nobody to turn it into a decision.
2. **Solution (slide 2, 30 s).** Soil, sky and mandi in one plan, in Hindi and English.
3. **Live demo (slide 3, 3 min).** Switch to window A.
   - *Overview*: recommended crop, next irrigation from the live Open-Meteo forecast, fertiliser cost, best mandi price. Change the language to हिन्दी and back.
   - *Crop planner*: open a crop card, then **Grow this** (seed burst). Optional: **Show 3D view** and turn the bars.
   - *Crop health*: pick *Holes* and *Damaged pods* for chickpea, then **Check my crop**. Upload a leaf photo and watch the scanning line and the outlined patches.
   - *Advisory desk*: **Ask a question** with the photo. In window B it appears instantly in the queue and on the district map. Reply. In window A the answer arrives live with a toast and a burst.
   - Window B: send a district alert (English + Hindi). Window A gets the toast and a notification.
   - Back on slide 3, the *questions answered* counter has gone up.
4. **Impact (slide 4, 30 s).** Be clear these are levers, not measured outcomes yet; a KVK pilot would measure them.
5. **Architecture (slide 5, 45 s).** Follow a packet along the diagram. Point out that every outside service fails safe: if Open-Meteo is down, the forecast is simulated *and labelled as such*.
6. **Roadmap and team (slides 6–7).** Leave slide 7 up for questions.

Backup: if the network fails, the production build still shows the last advice viewed (turn on airplane mode and reload), and the deck works offline once loaded.

## What is real and what is simulated

| Data | Source | Shown as |
|---|---|---|
| 7-day weather | **Live** from Open-Meteo (free, no key), cached 1 hour | "Live" badge; falls back to the simulator if unreachable, labelled "Simulated" |
| Mandi prices | Simulator by default; **Agmarknet** (data.gov.in) when `AGMARKNET_API_KEY` is set | Source badge on every price screen |
| Crop, pest and fertiliser figures | Standard reference values from the original prototype, editable by admins | Labelled indicative. Check MSP, doses and prices against current official sources before a demo |
| Leaf photo check | Colour proportions, not a trained model | "Colour check, not a disease model" on the screen |
| Farms, farmers, questions, alerts, pest sightings | Seeded demo data across 10 districts | Stated on the landing page counters |

## Configuration

Settings live in `apps/api/.env`, created from [`apps/api/.env.example`](apps/api/.env.example) on install. Every value has a working default.

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development` shows demo accounts and OTP codes; `production` hides both and requires a real `JWT_SECRET` |
| `PORT` / `HOST` | `4000` / `127.0.0.1` | API address |
| `DATABASE_URL` | `file:./dev.db` | SQLite file. For Postgres, set a `postgresql://` URL and change `provider` in `apps/api/prisma/schema.prisma`; nothing else changes |
| `JWT_SECRET` | dev value | Signs access tokens, OTP hashes and upload links. At least 32 characters; must be changed in production |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed browser origin (CORS) |
| `AGMARKNET_API_KEY` | empty | data.gov.in key for live mandi prices. Empty uses the labelled simulator |
| `UPLOAD_DIR` | `uploads` | Where photos are stored, relative to `apps/api` |
| `LEAF_ANALYSER` | `colour-heuristic` | Leaf photo analyser. A trained model can be plugged in behind the `LeafAnalyser` interface |

## How it is built

```
apps/web          React 18 + Vite + TypeScript + Tailwind. TanStack Query, Zustand, react-i18next,
                  Framer Motion, GSAP + Lenis (scroll story), React Three Fiber (3D), Visx (charts), PWA
apps/api          Fastify 5 + Prisma (SQLite in dev, Postgres-ready) + zod, JWT with rotating refresh
                  tokens, Socket.IO, rate limiting, helmet, OpenAPI at /docs
packages/shared   The advisory engine (crop scoring, fertiliser, water balance, mandi, pest matching),
                  reference data, zod schemas and every UI string in English and Hindi
legacy/           The original static prototype
scripts/          Golden-output capture, i18n conversion, screenshots, 3D stills, offline check
e2e/              Playwright end-to-end tests
```

- **The engine is proven against the original.** `packages/shared` runs the legacy JavaScript in a sandbox and checks the TypeScript port reproduces 2,892 recorded cases exactly.
- **Languages.** Adding Marathi, Tamil or Odia means adding one folder of strings in `packages/shared/src/i18n/locales/` and one line in `LANGUAGES`. Crop and district names fall back to English until translated.
- **Motion modes.** Full (3D, smooth scroll), Lite (still images, fewer effects; automatic on slow devices and switchable in the app menu) and reduced motion (fades only), following the operating system setting.
- **Accessibility.** Every chart has a table view, colour is never the only signal, everything works by keyboard with a visible focus ring, and text meets WCAG AA in both themes.

## Checks

```bash
npm run typecheck
npm run lint
npm test                 # engine golden tests, i18n parity, API tests
npm run build
npm run e2e              # Playwright; needs `npm run dev` running (BASE_URL to override)
```

Visual and behaviour checks: `node scripts/screenshots.mjs --as=farmer app app/planner`, `node scripts/landing-tour.mjs`, `node scripts/pitch-tour.mjs`, `node scripts/check-offline.mjs warm|offline`.

## Troubleshooting

- **Port 5173 or 4000 is already in use.** An earlier `npm run dev` may still be running. Close the `node.exe` processes in Task Manager (or `taskkill /F /IM node.exe`) and try again.
- **"Wait 30 seconds before asking for a new code."** The OTP limits are working: one code per 30 seconds and five per 10 minutes per number. Wait, or run `npm run db:reset`.
- **Windows blocks `rollup.win32-x64-msvc.node`.** Some Windows machines block that native file. This repo already uses Rollup's WebAssembly build through an npm `overrides` entry, so no action is needed.
- **The 3D landing page is slow.** Switch on *Lite mode* in the app menu, or the page will do it automatically on slow devices.

## Known limitations

- Remaining `npm audit` advisories need major upgrades (zod 4, React Router 7, `@fastify/static` 10, `@fastify/swagger-ui` 6, `fastify-type-provider-zod` 7); none is critical.
- Agmarknet support is tested against a sample response, as no API key was available.
- The pitch deck's team slide is a placeholder, and the problem slide's figures should be checked against current sources before presenting.
