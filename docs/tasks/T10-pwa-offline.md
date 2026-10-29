# T10 · PWA: manifest, service worker, update flow, device QA

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | T01, T07, T08 |
| **Can run in parallel with** | T09 |

## Owns (files you may create or change)

- `app/manifest.webmanifest`
- `app/sw.js`
- `app/icons/*`
- `app/js/main.js` (SW registration + update toast)
- `docs/QA-phase1.md`

## Read first (only these)

- PRD §2 (C-3), §4.7 (FR-X7, X8), §7 (Phase 1 criteria)
- ARCHITECTURE §11

## Goal

Installable, fully offline app with a safe update path, plus the Phase 1 device sign-off.

## Spec

- Manifest per FR-X8. Icons: generate simple, legible PNGs (a stylized "ă" on the accent color) at 192 and 512, plus maskable variants. A committed SVG source is fine, but PNGs are required.
- `sw.js`: precache the shell list (every file under `app/js`, `app/css`, plus `index.html`, the manifest and icons). Runtime cache for `content/*.json` (stale-while-revalidate). Delete old `dg-*` caches on activate. Don't call `skipWaiting` automatically. Post a message so the page shows the toast "Update available — tap to refresh"; on tap, send `SKIP_WAITING` and reload on `controllerchange`.
- Enable validator rule 11 now that `sw.js` exists.
- `docs/QA-phase1.md`: a checklist run on **Android + Brave** covering install, airplane-mode session, TTS voice, diacritic bar with Gboard, export to Drive and re-import, and update toast. Record results (the user may run it; leave checkboxes).

## Acceptance criteria

- [ ] Lighthouse PWA installability passes in desktop Chromium.
- [ ] Airplane mode (DevTools offline) after one visit: the app loads and a Session completes.
- [ ] Changing `APP_VERSION` triggers the update toast; tapping it reloads into the new version.
- [ ] The validator fails when a JS file is missing from the precache list.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Audio-pack caching (Phase 4).
