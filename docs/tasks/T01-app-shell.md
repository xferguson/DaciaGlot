# T01 · App shell, router, design tokens

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | none |
| **Can run in parallel with** | T02, T03, T04, T05, T06 |

## Owns (files you may create or change)

- `app/index.html`
- `app/css/app.css`
- `app/js/main.js`
- `app/js/router.js`
- `app/js/version.js`
- `app/js/ui/components/banner.js`
- `app/js/ui/components/toast.js`
- `app/js/ui/views/home.js`
- `app/js/ui/views/settings.js` (stub)

## Read first (only these)

- PRD §2, §4.6 (FR-N1, FR-N3, FR-N6), §5 (NFR-3, NFR-5)
- ARCHITECTURE §1

## Goal

Replace the placeholder page with the real app shell: hash router, CSS design tokens with light and dark themes, a Home view skeleton, and the banner/toast components every later task reuses.

## Spec

- `index.html`: viewport meta, `theme-color`, a `<main id="app">` mount, and `<script type="module" src="js/main.js">`. No inline app logic.
- `css/app.css`: tokens on `:root` (`--bg --surface --fg --muted --accent --ok --warn --err --radius --gap`), redefined under `@media (prefers-color-scheme: dark)`. Base typography uses the system font stack at 17 px. A `.btn` primary/secondary with 44 px minimum height. Layout is a single column, max-width 36rem, 16 px side gutter.
- `router.js`: `start(routes, ctx)` maps `#/home`, `#/session`, `#/settings`, `#/lists`, `#/dashboard`, `#/lexeme/:id` to view modules (dynamic `import()`). Unknown routes go to `#/home`. Calls the previous view's `cleanup()`.
- `main.js`: boots with stub `state`/`content` objects (the real ones arrive in T02/T05). Mounts the router. Exposes `ctx.navigate(hash)`.
- `home.js`: due-count placeholder, **Quick** and **Session** buttons (navigate to `#/session?mode=quick|session`), a level-ring placeholder, and a Settings link.
- `banner.js`: `showBanner({id, text, action?, dismissible})`, persistent at the top. `toast.js`: `toast(text, {action?, ms=4000})`.
- `version.js`: `export const APP_VERSION = "0.1.0"`.

## Acceptance criteria

- [ ] Loads at `python3 -m http.server -d app` with no console errors; all routes render.
- [ ] Works under a subpath (serve the repo root and open `/app/`): no absolute URLs.
- [ ] Dark mode follows the OS setting; contrast meets AA (spot-check text and buttons).
- [ ] No external requests (DevTools Network shows only same-origin).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Card UI (T07), service worker (T10), real data wiring (T05/T08).
