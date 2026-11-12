# Build brief: Fieldwise v2, a full-stack crop advisory platform

You are taking over the Fieldwise prototype in this folder: a static HTML/CSS/JS crop advisory dashboard for Indian smallholder farmers, built for Smart India Hackathon. Read `CLAUDE.md`, `README.md` and every file in `js/` first. The domain logic in `js/data.js`, `js/engine.js` and `js/i18n.js` is correct and must be carried over, not rewritten from memory.

Turn it into a full-stack product with a real backend and an exceptional, cinematic frontend that wins a hackathon demo, while staying fast and usable on a ₹8,000 Android phone.

## How to work

1. **Plan first.** Before writing code, give me a short plan: folder structure, libraries with versions, data model, API routes and the phase order below. Wait for my "go".
2. **Build in phases.** Finish one phase, run it, fix every error, show me how to see the result, then commit with git (`git init` if needed) before starting the next.
3. **Keep the old app.** Move the current files to `legacy/` so nothing is lost.
4. **Verify everything.** After each phase run the type check, lint, tests and a production build. Use Playwright to screenshot key pages at 1440px and 390px wide, then look at the screenshots and fix layout problems before you tell me a phase is done.
5. **Ask before** adding a paid service, an API that needs a key I don't have, or anything that costs money. Use free, key-less options or a clearly labelled mock instead.

## Stack

- **Monorepo** with npm workspaces: `apps/web`, `apps/api`, `packages/shared` (types, zod schemas, the agronomy engine).
- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand.
- **Motion and 3D:** Framer Motion (UI transitions), GSAP + ScrollTrigger (scroll storytelling), Lenis (smooth scroll), React Three Fiber + drei + @react-three/postprocessing (3D), canvas-confetti or a custom canvas particle system (colour bursts), Lottie only if needed.
- **Charts:** Visx or Recharts, styled to match the design system, with animated entry and hover tooltips.
- **Backend:** Node 20 + Fastify + TypeScript, Prisma ORM with SQLite for development (schema must work on Postgres unchanged), zod validation, JWT auth with refresh tokens, Socket.IO for live alerts, rate limiting, helmet and CORS.
- **i18n:** react-i18next with English and Hindi. Port every string from `js/i18n.js`. The structure must make adding Marathi, Tamil or Odia easy.
- **Testing:** Vitest for the engine and API, Playwright for end-to-end flows.

## Backend: what must really work

- **Auth and roles:** Farmer, Extension Officer, Admin. Phone number + OTP login, with OTP printed to the server console in dev (no SMS provider). Seed one demo account per role and show the credentials on the login screen in dev.
- **Farm profiles:** a farmer can have several farms, each with location, soil, irrigation and Soil Health Card history (track pH/N/P/K over time).
- **Advisory engine:** move `recommend`, `fertPlan`, `waterPlan` and the pest matcher into `packages/shared` with unit tests that reproduce the current outputs, then expose them via the API.
- **Weather:** live 7-day forecast from **Open-Meteo** (free, no key) using district coordinates, cached for 1 hour in the database. Fall back to the existing simulator if the request fails, and mark the data as simulated in the UI.
- **Mandi prices:** a service interface with a data.gov.in Agmarknet adapter (enabled only when `AGMARKNET_API_KEY` is set) and the existing simulator as the default. The UI always shows which source is in use.
- **Crop health:** image upload endpoint (multer or fastify-multipart, size and type validated, stored on local disk). Keep the colour heuristic, and build the interface so a TensorFlow.js or ONNX PlantVillage model can be plugged in later. Do not claim ML accuracy that isn't there.
- **Advisory desk:** farmers create tickets with photos, officers reply, and status updates arrive in real time over Socket.IO.
- **Alerts:** officers broadcast alerts by district and crop. Farmers get them instantly as an in-app toast plus a notification centre.
- **Officer dashboard:** a district map with farms and open tickets, pest-report heatmap, ticket queue, and charts for common issues.
- **Admin:** manage users, districts and crop reference data.
- **Seed script** with realistic data across the 10 existing districts so every screen looks alive on first run.
- **OpenAPI docs** at `/docs`.

## Frontend: make it unforgettable

Design direction: premium agritech. Calm and trustworthy in daily-use screens, cinematic in the landing and pitch experiences. Pick a distinctive palette from the subject matter (soil, monsoon, mustard fields, young leaves), not a generic SaaS look. Use one display face plus one text face, both with Devanagari support. Write a short design-system doc (`apps/web/DESIGN.md`) with tokens before building screens.

### 1. Landing page (scroll story)
- **3D hero:** a low-poly farm landscape in React Three Fiber, with gently moving crops, drifting clouds and a sun that tracks the cursor. Add soft bloom and depth of field.
- **Scroll storytelling with GSAP ScrollTrigger + Lenis:** as the user scrolls, the camera flies over the field and moves through the seasons (Kharif green → Rabi mustard → Zaid dry). Sections pin while text reveals.
- **Soil cross-section in 3D:** scrolling peels back soil layers, with N, P and K shown as glowing particles of different densities.
- **Line animations:** SVG paths draw themselves on scroll, e.g. irrigation channels filling with water, and the route from field to mandi.
- **Animated counters, kinetic typography and a parallax India map** with district pins that pulse in.
- Finish with a call to action that opens the app.

### 2. Pitch mode (`/pitch`), a 3D presentation for the judges
- A full-screen, keyboard-driven deck (arrow keys, space, a clicker): problem → solution → live demo → impact → tech architecture → roadmap → team.
- Slides are 3D scenes, not flat pages. The camera moves between them in one continuous world (fly from the farm to a data-centre visual for the architecture slide). Include an animated architecture diagram where data packets travel along the lines.
- Presenter notes in a second window (`/pitch/presenter`) with a timer, kept in sync via BroadcastChannel.
- Live metrics on slides come from the real API.

### 3. App experience
- **Page transitions** with Framer Motion shared layout animations, e.g. a crop card expanding into the crop detail page.
- **Dashboard:** KPI tiles that count up, charts that animate in, a skeleton loader on every async view, and optimistic updates.
- **3D crop suitability:** an optional 3D bar or terrain view of crop scores that can be rotated, next to the accessible 2D chart.
- **Weather:** an animated sky that matches the forecast (rain particles, moving clouds, a sun shimmer), and irrigation shown as water rising in a soil-moisture gauge.
- **Colour bursts and micro-interactions:** a confetti or seed burst in brand colours when a farmer picks a crop, sends a question or gets an answer. Add ripple feedback on buttons, magnetic hover on primary CTAs and a spring-animated toggle.
- **Crop health:** while a leaf photo is analysed, show a scanning laser line sweeping across it, then highlight the problem regions.
- **Command palette** (Ctrl/Cmd+K), dark mode, and toast + notification centre animations.
- **Cursor effects** (a subtle trailing glow) on desktop only.

### 4. Performance and accessibility rules
- Lazy-load every 3D scene and heavy library with `React.lazy` and dynamic imports. The app shell must stay under 200 KB gzipped JS.
- Detect low-end devices (`navigator.hardwareConcurrency`, `deviceMemory`, a quick FPS probe). Automatically switch to **Lite mode**, which uses static images instead of 3D, fewer particles and no post-processing. Also add a manual Lite mode toggle in settings.
- Respect `prefers-reduced-motion`: turn off scroll-jacking, parallax and particles, and keep only fades.
- Target Lighthouse scores of 90+ for performance, accessibility and best practices on the app routes, measured on mobile.
- Everything works by keyboard with visible focus. Charts have a table view. Colour is never the only signal. Text contrast meets WCAG AA.
- Make it a PWA (manifest + service worker) so it installs on Android and the last-viewed advice works offline.

## Phases

1. **Foundation:** monorepo, shared package with the ported engine and tests, Prisma schema and seed, auth, and the design-system tokens.
2. **Core API:** farms, recommendations, weather (Open-Meteo), mandi, uploads, tickets, alerts and sockets, with OpenAPI docs.
3. **App UI:** every page from the current app rebuilt in React, connected to the API, with transitions and micro-interactions.
4. **Officer and admin dashboards.**
5. **Landing page** with the 3D hero and scroll story.
6. **Pitch mode.**
7. **Polish:** Lite mode, reduced motion, PWA, Lighthouse pass, Playwright end-to-end tests for the main flows.
8. **Ship:** a `README.md` with one-command setup (`npm install && npm run dev` starts web + API + seed), environment variable docs, and a demo script I can follow on stage.

## Definition of done

- `npm run dev` starts everything on a fresh clone with no manual steps.
- Logging in as each demo role shows a working, populated experience.
- No console errors, the type check passes, tests pass and the production build succeeds.
- Simulated data is always labelled as simulated in the UI.
- The landing page and pitch mode run at a smooth 60 fps on a mid-range laptop and fall back gracefully on a phone.

Start by reading the existing code and giving me the plan.
