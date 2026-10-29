# T16 · Flag a sentence → GitHub issue

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T07 |
| **Can run in parallel with** | T11, T12, T13, T14, T15, T17 |

## Owns (files you may create or change)

- `app/js/ui/components/flag-button.js`
- `app/js/ui/views/settings.js` (flags section)
- `test/flag.test.mjs`

## Read first (only these)

- PRD §4.7 (FR-X9), §8 (content risk)
- ARCHITECTURE §4.2 (Flag)

## Goal

Close the loop on machine-authored content without a backend.

## Spec

- A flag icon on every card opens a small sheet with an optional note and Save. It stores a `Flag`.
- Settings → Flagged sentences lists each flag (sentence ro/en, note, date), with an **Open issue** link built by a pure, tested `issueUrl(flag, sentence)` (title `Content flag: <id>`, body with ro, en, note, contentVersion, label `content-flag`; URL-encoded; under 6000 chars) and a **Copy all** action (Markdown list to the clipboard).
- Deleting a flag after opening its issue is offered, not automatic.

## Acceptance criteria

- [ ] `issueUrl` tests: encoding of diacritics and quotes; length cap.
- [ ] The flow works offline (saved locally; the link opens when online).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

In-app issue status.
