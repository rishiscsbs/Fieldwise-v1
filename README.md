# Fieldwise

A crop advisory dashboard for small and marginal farmers, built as a Smart India Hackathon prototype.
It works in English and Hindi, needs no backend, and has no build step.

## Run it

Pick one:

- **Double-click `index.html`.** It opens in your browser and everything works.
- **VS Code:** install the *Live Server* extension, right-click `index.html`, then choose *Open with Live Server*. The page reloads every time you save.
- **Terminal:** `npx serve .` then open the URL it prints.

## What it does

| Page | What it shows |
|---|---|
| Overview | KPI tiles, crop suitability chart, rainfall and temperature, mandi price trend, alerts, open queries |
| Farm profile | District, season, soil, land, irrigation and Soil Health Card (pH, N, P, K). Every other page reads these values |
| Crop planner | Crops for the season, scored out of 100 on soil, pH, water, temperature and nitrogen, with the reasons |
| Nutrient plan | Urea / DAP / MOP bags and cost for your field, adjusted to soil test levels, plus an application schedule |
| Crop health | Symptom-based pest and disease matching with natural and chemical remedies, plus a colour check on leaf photos |
| Weather & irrigation | 7-day outlook, irrigation days from a soil-water balance (Hargreaves ET), and when it is safe to spray |
| Market prices | 30-day prices in 4 nearby mandis compared with MSP, plus sell or hold advice |
| Advisory desk | Farmers ask questions; switch to the Officer view to reply and send district alerts |

The *Read aloud* button speaks each page in English or Hindi using the browser's speech engine.

## Project structure

```
index.html        layout shell (sidebar, top bar) and script load order
css/styles.css    design tokens (:root) and every component style
js/data.js        districts, soils, crops, pests, fertiliser prices
js/i18n.js        all UI text, English and Hindi
js/core.js        app state, localStorage, helpers (t, L, fmt, esc, rng)
js/engine.js      crop scoring, fertiliser maths, forecast, irrigation, mandi
js/charts.js      dependency-free SVG charts with tooltips
js/app.js         one function per page, router, event handlers
```

## What is simulated

This prototype runs fully offline, so some inputs are stand-ins:

- **Weather** is generated deterministically per district and day. Replace `forecast()` in `js/engine.js` with the IMD or Open-Meteo API.
- **Mandi prices** are generated around a base price per crop. Replace `mandiData()` with the Agmarknet / data.gov.in API.
- **Leaf photo check** measures colour proportions. It is not a trained model. A TensorFlow.js model trained on PlantVillage would be the real upgrade.
- **Crop, pest and fertiliser figures** in `js/data.js` are standard reference values. Check MSP, doses and prices against current official sources before a demo.
- **Data** (profile, questions, alerts) is saved in the browser's localStorage only. A shared backend (Firebase, Supabase) is needed for real farmer–officer messaging.

## Ideas for next steps

1. Real weather and mandi APIs (needs a small proxy server for API keys).
2. Leaf disease model with TensorFlow.js, running offline in the browser.
3. More languages: add a key to every entry in `js/i18n.js` and `js/data.js`.
4. PWA (manifest + service worker) so it installs on Android and works offline.
5. SMS / IVR alerts for farmers without smartphones.
