# Q16 · Zero-dependency lint with ratcheting allowlists

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | Q02, Q03, Q06, Q07, Q17 |

## Owns (files you may create or change)

- `scripts/lint.mjs` (new; Node built-ins only)
- `scripts/lint-allow.json` (new: today's known violations)
- `test/lint.test.mjs` (new; replaces `test/imports.test.mjs`)
- `.github/workflows/deploy-pages.yml` (one step)
- CLAUDE.md · Commands (one line)

## Read first (only these)

- CLAUDE.md · Ground rules, Commands

## Goal

Rules in CLAUDE.md (pure core, relative imports, no raw ids) are enforced only by review. `test/imports.test.mjs` (from #87) catches missing imports of exported names only, and strips template literals whole, so calls inside `${…}` are never checked. A stricter prototype from the audit (strips comments, strings, template text and regex literals but keeps `${…}` code, ignores method shorthand) found no violations on main on 2026-11-01; start from it.

## Spec

Rules, each with an allowlist in `lint-allow.json` holding **today's** violations (file + count), so the lint passes now and fails on anything new:
1. Undeclared bare calls (the prototype scanner); allowlist empty.
2. Purity: no `Math.random`, `Date.now`, `document`, `window`, `localStorage`, `navigator` in `app/js/core/`.
3. No raw card-id prefixes (`startsWith("fm:")`, `` `lr:${` ``, `.slice(3)` on ids) outside `core/cards.js`.
4. Import direction: `ui/views/*` never imports `ui/views/*`; `core/*` imports only `core/*`.
5. No import cycles in `app/js`.
6. All imports relative with a `.js` extension (CLAUDE.md).
- `node scripts/lint.mjs` prints `file:line rule message`; `--update-allow` rewrites the allowlist **only downwards** (never adds entries).
- `test/lint.test.mjs` runs it, so `node --test` covers it.

## Acceptance criteria

- [ ] Each rule has a test with a failing and a passing snippet.
- [ ] Adding `Math.random()` to a core file, or a view-to-view import, fails `node --test`.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
