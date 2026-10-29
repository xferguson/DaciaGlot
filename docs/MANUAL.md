# Manual activities (later)

Things only the owner can do: they need a real device, a browser, or a settings change. They don't block any task. Do them in one batch whenever you feel like it, tick the boxes, and note anything odd under *Findings*. If a check fails, open an issue or tell a session, and it will be fixed as a normal task.

Status for every item: **later**.

## 1. Environment settings

- [ ] **Allow `dexonline.ro`** under *Allowed domains* in the cloud environment's network settings (cloud environment menu in the session title bar, then Edit; see https://code.claude.com/docs/en/cloud-environments#network-access). This unblocks **T24** (verify batch B paradigms against Dexonline). T24 now lives in epic E6 in `docs/STATUS.md` (off the task board). Once done, tell a session to add T24 back to the table as `todo` and start it.

## 2. Spot checks on a real phone (Android + Brave)

Phase 1 device QA is accepted (`docs/QA-phase1.md`). These later features have only been tested in unit tests. Open the app on your phone, and tick each as you use it.

- [ ] **T13 · Lists and Focus:** Situations / Patterns tabs on Home; start a Focus session from a row; a blocked focus offers the suggestion button; tapping an answered token opens the lexeme page.
- [ ] **T14 · Key-forms (`kf`) cards:** forms are labelled sensibly, and the example sentence shown fits the form.
- [ ] **T15 · Transform (`xf`) and slot (`sb`) cards:** the instruction reads naturally, typed answers and `accept[]` variants are accepted, and slot chips are usable at phone width.
- [ ] **T16 · Flagging:** flag a sentence, then Settings → report opens a prefilled GitHub issue.
- [ ] **T18 · Dashboard:** open it from the Home ring; charts render and are readable in light and dark mode.
- [ ] **T21 · Summary and export reminder:** the summary after a session looks right; the export banner shows after 3 days of use and goes away after exporting.
- [ ] **T20 · EN→RO (`er`) cards:** see the recipe below.

### T20 recipe

An `er` card only unlocks when every cloze card for a sentence has stability ≥ 7 days, so seed your saved state instead of waiting a week:

1. Serve with `python3 -m http.server -d app 8080` and open http://localhost:8080/ in a desktop browser. Study a Session once so the state exists.
2. Devtools → Application → Local Storage → edit key `dg:v1:state`.
3. Pick a sentence with a top-level `accept`, for example `s-a1-standup-0001` (*Ieri am terminat sprintul.*, accept *Am terminat sprintul ieri.*).
4. Add the sentence to `seenSentences` (any ms timestamp). In `cards`, add `lr:<id>` and a `cz:<id>:<tokenIndex>` for each token with `cloze: true`, copying the shape of an existing card and setting `stability` to `10`.
5. Reload and start a Session. `er:<id>` appears among the new drills.

Then try:
- [ ] The primary Romanian text is accepted.
- [ ] The `accept` variant is accepted.
- [ ] Missing diacritics or different capitalization behave as expected.
- [ ] A contraction case (sentence with *n-am* / *nu-i*, typed in long form) is accepted.
- [ ] A wrong answer shows "Not quite", reveals the audio button, and a second wrong answer ends the card.

## Findings
