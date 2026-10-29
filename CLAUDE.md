# DaciaGlot — instructions for agents

DaciaGlot is an offline-first PWA for learning to **speak** Romanian. It is vanilla ES modules with no build step and no backend, and its state lives in `localStorage`. It deploys to GitHub Pages from `main`.

## Start here (every session)

1. Read `docs/STATUS.md` and pick the lowest-numbered task that is `todo` and whose dependencies are all `done`. If the user named a task, take that one.
2. Read the task file in `docs/tasks/`. It lists exactly which sections of `docs/PRD.md`, `docs/ARCHITECTURE.md` and `docs/CONTENT_GUIDE.md` to read. **Read only those sections.** Don't read `docs/archive/`; it's superseded.
3. In your first commit, mark the task `in-progress` in `docs/STATUS.md` with your branch name.
4. Build it. Stay inside the task's **Owns** file list. If you must touch another file, keep the change minimal and explain it in the PR.
5. Before opening the PR:
   - `node --test` passes.
   - `node scripts/validate-content.mjs` passes (once it exists).
   - Each of the task's acceptance criteria is met. Check them off in the PR description.
   - Set `docs/STATUS.md` to `done` (or `review`) and add a one-line note on anything the next task needs to know.
6. One task per PR. The PR title is `T## · <task title>`.
7. **Merge policy:** once the PR's CI is green, it has no merge conflict and no unresolved review comments, merge it yourself without asking. **A PR that changes only `.md` files triggers no CI, so don't wait for it: merge as soon as it has no conflict and no unresolved review comments.** If anything is outstanding, fix it first, or ask the user if it needs their call. After merging, the next session starts from the updated `main`. **After any successful merge, flip the task's row in `docs/STATUS.md` from `review` to `done`** (if it isn't already) via a small follow-up PR from a fresh branch off `main`, titled `STATUS: mark T## done`, and merge that under the same policy.

## Ground rules

- **Contracts are binding.** Function signatures and data shapes in `docs/ARCHITECTURE.md` are the interface other agents build against. If you need to change one, update the doc in the same PR and call it out at the top of the PR description.
- `app/js/core/` is **pure**: no DOM, no `localStorage`, no `Date.now()`. Pass `now` and `rng` in. Every core module gets tests in `test/<module>.test.mjs` using `node:test` and `node:assert/strict`.
- **No dependencies.** No npm packages at runtime or for tests. Node ≥ 22 built-ins only.
- All imports are relative and include the `.js` extension. All asset URLs are relative, because the site is served under `/DaciaGlot/`.
- When you add a file under `app/js/` or `app/css/`, add it to the precache list in `app/sw.js`. The validator checks this. Bump `APP_VERSION` in `app/js/version.js` on any shell change.
- **Romanian text:** use comma-below `ș ț` (never cedilla `ş ţ`). Follow `docs/CONTENT_GUIDE.md` §8.
- **UI:** phone-first, 44 px tap targets, light and dark mode via CSS tokens in `app/css/app.css`. No external network requests at runtime.
- Never commit secrets. The app has none, so if something seems to need one, stop and ask.

## Commands

```bash
node --test                           # unit tests
node scripts/validate-content.mjs      # content integrity (add --coverage for the report)
python3 -m http.server -d app 8080     # local preview at http://localhost:8080/
```

## Document map

| File | Purpose |
|---|---|
| `docs/PRD.md` | Requirements (FR-/NFR- ids), phases, release criteria. Source of truth. |
| `docs/ARCHITECTURE.md` | Module layout, data types, function contracts, algorithms |
| `docs/CONTENT_GUIDE.md` | Content schemas, validator rules, pattern inventory, authoring rules |
| `docs/STATUS.md` | Task board |
| `docs/tasks/T##-*.md` | Self-contained work packages |
