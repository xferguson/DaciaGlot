# Q · Code quality track (overview)

From the 2026-11-01 code audit. The pure core is well tested; the view layer has no tests, and the same logic is copied by hand across files. Most recent bugs (#83–#87) came from that gap. Q tasks fix it **without changing behavior**.

## Rules for every Q task

1. **Characterize first.** Before rewriting code, pin its current behavior with tests. A Q PR that changes behavior is a bug unless the task says otherwise.
2. **Contracts stay.** If a function moves, re-export it from its old module so `docs/ARCHITECTURE.md` signatures still hold; update the doc in the same PR if a path or signature changes, and call it out at the top of the PR.
3. **Small diffs in hot files.** `core/session.js`, `core/cards.js` and `ui/views/session.js` are touched by several lanes. Change only the lines your task needs; no drive-by reformatting.
4. **Ratchets, not big bangs.** Guard tests (Q16) start with an allowlist of today's violations. Each Q task that removes one deletes it from the allowlist, so the list only shrinks.

## Waves (what can run in parallel)

```
Wave 1 (no deps):      Q02 · Q03 · Q06 · Q07 · Q16 · Q17
Wave 1b (same lanes):  Q04 ← Q03 · Q10 ← Q06
Wave 2 (after Q02):    Q05 · Q08 · Q13          Q09 ← Q04, Q10
Wave 2b:               Q14 ← Q05 · Q15 ← Q08
Wave 3 (core, serial): Q11 ← Q09 · Q12 ← Q11
Last:                  Q18 ← all of the above
```

Lanes that edit the same hot file (Q03/Q06 in `core/session.js` and `core/cards.js`) touch different lines; whoever merges second does the routine `git merge origin/main` from CLAUDE.md.
