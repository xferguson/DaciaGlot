# Product experiments and check-ins

This file is the product designer's memory. Every change made to answer an owner complaint is an **experiment** with a hypothesis and the questions that test it. Agents don't read it during normal task work. They read it when the owner asks for a **product check-in**, and they update one status line when an experiment's task merges.

## Check-in protocol

When the owner says "check in" (or similar):

1. Read this file top to bottom.
2. For each experiment whose status is `live since <date>`, ask its **Check-in questions** (with AskUserQuestion, a few at a time). Dig into the answers. If the owner says it's still repetitive, ask for a concrete recent example: the sentence, the card, what they typed.
3. Append a dated entry to that experiment's **Observations**: quote the owner where possible, then a one-line **Decision**: `keep`, `revise: <what>`, or `roll back`.
4. If a decision is `revise` or `roll back`, or the owner raises something new, add or adjust an experiment here **and** a task in `docs/STATUS.md` / `docs/tasks/`.
5. Measurement is **interview only**, as the owner chose (2026-10-30): no exports, no in-app ratings, no telemetry. Don't propose metrics that need the owner's data.

Status values: `planned` → `live since YYYY-MM-DD` (set when the task's PR merges) → `concluded YYYY-MM-DD (<decision>)`.

## Discovery interview · 2026-10-30

**Owner's complaints (paraphrased from their words):**
- "75% of what I do in a session feels too repetitive and doesn't really test my knowledge."
- Shared words across sentences (*he lives / you live / I live in Cluj*) mean *Cluj* and the same pattern are tested again and again. "If I mark Cluj as easy, or already know it, I don't want to see a test for Cluj again, even if I'm learning another sentence." Different forms should be tested separately, but the same form should not be tested again once it's clearly learned.
- Testing the same sentence back-to-back is boring and too easy, because it's still in working memory.
- A new sentence where only one word is new gets every word tested.
- Slot glosses like `[am/is/are]` and `[I / you]` caused wrong answers. The owner has a linguistics degree and wants glossing like *copula, 1st person singular*.

**Causes found in the code:** blanks are per sentence (`cz:<sid>:<token>`), each with its own schedule, plus a separate `kf` schedule per form. New sentences put `lr` and `cz` in the same session. `er` grading is all-or-nothing. Slot labels come from the pattern (`patterns.json` `slotLabel`), not from the form.

**Decisions the owner made:**

| Question | Owner's answer |
|---|---|
| What repeats? | All of: same form in another sentence; same sentence back-to-back; near-identical families; trivially easy blanks |
| A known form in other sentences | One shared schedule per form, shown in varied sentences |
| `kf` drill vs. in-sentence blank of the same form | One schedule, two looks (sentence preferred; bare drill only if no good sentence) |
| New sentence with 1–2 unknown words | Blank only the new bits now; whole sentence later |
| When is the first real test? | One immediate check right after learning (not counted), then the first counted test the next day at the earliest |
| Whole-sentence test format | EN→RO, typed. **A missed part gets its own single-form review** |
| Near-identical families | Introduce them together as a paradigm batch; later reviews probe one random member |
| Who decides a blank is trivial? | The learner only (no automatic content skipping) |
| "I know this" means | "I can produce it". Trusted fully, never verified |
| Where to tap it | Card feedback, and the word page (with undo) |
| Claimed form missed later in EN→RO | Evidence wins: the claim is removed and the form gets a single-form review |
| Existing automatic "known" rules (`isKnown`) | Keep both (they only affect selection) |
| Gloss notation | Leipzig-style (`be.PRS.2SG`), on slot-building cards only |
| How to judge success | Check-in interviews only |
| First experiment | Shared per-form schedule |

---

## EXP-01 · One schedule per word form · [T25](tasks/T25-per-form-schedule.md)

- **Status:** live since 2026-10-30
- **Complaint:** "I get tested on the word Cluj a lot", and the same form keeps coming back because it appears in several sentences.
- **Hypothesis:** if each word form has exactly one schedule, shared by every sentence and by key-form drills, the owner stops meeting already-known forms just because a new sentence contains them, and each review shows the form in a *different* sentence, so it's a real test.
- **Change:** `fm:<lex>:<form>` cards replace stored `cz`/`kf` schedules. When due, the form is blanked in a seen sentence not used for it recently, or shown as a bare key-form drill if none fits.
- **Expected felt difference:** fewer cards per session on things already known; reviews look different each time.
- **Check-in questions:**
  1. In your last few sessions, did a word you'd already got right show up again within the same few days? Which one?
  2. When a form came back, was it in a sentence you hadn't just seen it in? Did that feel like a real test?
  3. Did you get bare key-form drills when you'd have preferred a sentence (or the reverse)?
  4. Roughly what share of a session now feels repetitive, compared with the ~75% before?
- **Rollback:** the migration keeps the strongest state per form, so it can't be undone exactly. A roll back would re-split by re-creating `cz` cards from `fm` state.
- **Observations:** _none yet_

## EXP-02 · Learn today, test tomorrow · [T26](tasks/T26-learn-today-test-tomorrow.md)

- **Status:** live since 2026-10-30
- **Complaint:** the same sentence comes back within a few cards, so "I might still have the sentence in my working memory".
- **Hypothesis:** an immediate (uncounted) check on only the new forms, with the first counted test in a later session and no two cards from one sentence or lexeme in a session, makes reviews test memory rather than recency.
- **Change:** new sentence = `lr` + immediate check of new forms only. Their `fm` cards are first due the next day. Reviews show at most one card per sentence and per head lexeme each session.
- **Expected felt difference:** new sentences take fewer cards; no déjà-vu runs; more misses on day 2 (that's the point).
- **Check-in questions:**
  1. When you learned a new sentence, how many cards did it take? Did the immediate check feel useful or like busywork?
  2. Did you see two cards from the same sentence or same word in one session?
  3. Are next-day tests harder than before? Too hard?
- **Rollback:** restore same-session `cz` after `lr` (pre-T26 `composeSession`).
- **Observations:** _none yet_

## EXP-03 · Whole sentence later, part-level credit · [T27](tasks/T27-whole-sentence-later.md)

- **Status:** planned
- **Complaint:** "Maybe I should write up the whole sentence." The owner was unsure how to test known sentences without re-blanking everything.
- **Hypothesis:** once a sentence's new forms are past their first rung, typing the whole sentence EN→RO is a better, less repetitive test. Sending only the *missed* parts back to single-form review avoids redoing the whole sentence.
- **Change:** `er` unlocks once every cloze form's `fm` is at ≥4 d. Grading aligns the answer and gives Again only to the wrong units' `fm` cards.
- **Expected felt difference:** sentence-level tests appear for "known" sentences; a slip on one word doesn't punish the rest.
- **Check-in questions:**
  1. Did you get whole-sentence (EN→RO) tests? Did they come at the right time, or too early/late?
  2. When you missed one word, did that word come back on its own? Was that the right word (did the alignment blame the right part)?
  3. Does writing the whole sentence feel like real speaking practice?
- **Rollback:** revert `er` grading to all-or-nothing.
- **Observations:** _none yet_

## EXP-04 · "I can produce this" claims · [T28](tasks/T28-produce-claims.md)

- **Status:** planned
- **Complaint:** "If I … already know it, I don't want to see a test for the word Cluj again."
- **Hypothesis:** letting the owner claim a form they can produce (trusted, with undo) removes trivially easy blanks without the app guessing what's trivial.
- **Change:** tap a word in feedback or on the word page → "I can produce *X* (gloss)". That form is never blanked again unless an EN→RO miss shows otherwise.
- **Expected felt difference:** names, cities and cognates disappear from tests after one tap.
- **Check-in questions:**
  1. How often did you use the claim? On what kinds of words?
  2. Did any claimed word get taken back by an EN→RO miss? Was that fair?
  3. Is the tap easy to find, or do you need it somewhere else (e.g. during learning)?
- **Rollback:** clear `state.claimed`. It's a separate key, so nothing else is touched.
- **Observations:** _none yet_

## EXP-05 · Sentence families as paradigms · [T29](tasks/T29-sentence-families.md)

- **Status:** planned
- **Complaint:** *he lives / you live / I live in Cluj* are drilled as if each were new.
- **Hypothesis:** introducing a family once as a small paradigm, then probing one random member per review, tests the *form choice* (the real skill) and stops near-identical repeats.
- **Change:** family detection; a paradigm card for up to 3 members; at most one due card per family per session; random-member carriers.
- **Expected felt difference:** fewer "same sentence again" moments; reviews make you choose the person/number.
- **Check-in questions:**
  1. Did you see a paradigm card? Was it clear and worth the time?
  2. In reviews, could you predict which form was coming? (You shouldn't be able to.)
  3. Any family members that weren't really one family (wrongly grouped)?
- **Rollback:** turn off family grouping; members return to being independent sentences.
- **Observations:** _none yet_

## EXP-06 · Leipzig glosses on slot-building cards · [T30](tasks/T30-leipzig-slot-glosses.md)

- **Status:** live since 2026-10-30
- **Complaint:** `[I / you]` was read as a pronoun cue and the owner typed the form for *I* when *you* was wanted. "It's adding confusion by trying to make it easier."
- **Hypothesis:** form-specific Leipzig glosses (`[be.PRS.2SG]`) remove wrong answers caused by an ambiguous label.
- **Change:** slot labels come from the target form (`<gloss>.<LEIPZIG>`), falling back to the pattern label only when the form can't be resolved.
- **Expected felt difference:** no more "I answered the label, not the task" misses.
- **Check-in questions:**
  1. Have any slot-building answers been marked wrong because of the label since the change?
  2. Are the glosses notated the way you'd expect (abbreviations, order, clitic/oblique marking)? Any you'd change?
  3. Would you want the same glossing elsewhere (key-form labels, cloze cues, feedback)? (Originally scoped to slot cards only.)
- **Rollback:** use `slotLabel` again.
- **Observations:** _none yet_
