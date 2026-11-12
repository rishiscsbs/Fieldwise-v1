# Fieldwise

A crop advisory platform for small and marginal farmers in India, in English and Hindi. Smart India Hackathon project.

> v2 is being built in phases. The original static prototype is in [`legacy/`](legacy/README.md) and still runs by opening `legacy/index.html`.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

This creates `apps/api/.env` from `.env.example`, builds the shared package, creates and seeds a SQLite database (first run only), and starts:

- **Web** at http://localhost:5173 (design system at `/design`)
- **API** at http://localhost:4000, with OpenAPI docs at http://localhost:4000/docs

### Demo logins (development)

| Role | Phone |
|---|---|
| Farmer | +91 90000 00001 |
| Extension officer | +91 90000 00002 |
| Admin | +91 90000 00003 |

There is no SMS provider. In development the one-time code is printed in the API console and returned by the API so the login screen can show it.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Layout

```
apps/web          React app (Vite, Tailwind). Design tokens: apps/web/DESIGN.md
apps/api          Fastify API, Prisma schema and seed
packages/shared   Agronomy engine, reference data, zod schemas, English and Hindi strings
scripts/          Legacy golden-output capture, i18n conversion, screenshots
legacy/           The original static app
```

Agronomic figures (MSP, doses, fertiliser prices) are indicative. Simulated data is labelled in the UI.
