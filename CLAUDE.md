# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Fieldwise is a static, single-page crop advisory dashboard (Smart India Hackathon prototype).
Plain HTML, CSS and vanilla JavaScript. No framework, no bundler, no package.json.

## Run and check

- Open `index.html` directly in a browser, or run `npx serve .`.
- After any change, load every page (`#overview`, `#profile`, `#planner`, `#nutrients`, `#health`, `#weather`, `#market`, `#desk`) in both English and Hindi and confirm there are no console errors.
- If Playwright is available, screenshot pages at 1440px and 390px width to check the layout.

## Architecture

- Scripts are classic `<script>` tags loaded in a fixed order in `index.html`:
  `data.js → i18n.js → core.js → engine.js → charts.js → app.js`.
  They share globals (top-level `const`/`let`), so **never redeclare a name** that an earlier file defines (e.g. `C`, `t`, `L`, `P`).
- `P` (in `core.js`) is the farm profile and the single source of truth. Change it, call `saveProfile()`, then `render()`.
- Each page is a function in `app.js` that returns `{ html, after, say }`. Register new pages in `VIEWS`, `NAV_GROUPS`, `RENDER` and `ICON`, and add `nav2.<page>`, `pt_<page>` and `ps_<page>` strings.
- Routing uses the URL hash (`#planner`). Only plain `#name` hashes.
- Charts are in `charts.js` (`vbars`, `range`, `hbars`, `lines`, `spark`). They size to their container and are redrawn on resize via the view's `after()`.

## Conventions

- **Every user-facing string needs English and Hindi.** UI text goes in `js/i18n.js` (`T.en` / `T.hi`); data labels use `{ en, hi }` objects read with `L()`.
- Escape any user or data text inserted into HTML with `esc()`.
- Colours come from CSS custom properties in `css/styles.css`. Status colours (`--good/--warn/--bad/--info`) are reserved for status; chart series use `--series-1..4` in that order.
- Wrap `localStorage` access in try/catch (use the `store` helper).
- Keep the UI copy plain and in sentence case. Buttons say what they do.
- Agronomic numbers (MSP, doses, fertiliser prices) are indicative; label simulated data as simulated in the UI.
