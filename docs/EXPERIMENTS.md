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
- **Observations:**
  - **2026-11-01 · check-in.** Owner: reviews have "still some repeats" but no concrete example to hand ("trust me that I'm being honest about it"). The bigger complaint is volume and pace, not back-to-back repeats (see the 2026-11-01 check-in below).
    - **Decision: keep.** Next check-in: ask for one example as soon as it happens (sentence or word, and how soon it came back).

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
- **Observations:**
  - **2026-10-31 · owner report (unprompted).** "Did we revert all of the changes we just had to space out cards? … I just had the sentence *What will you have to eat?* as a learning sentence, and then immediately was asked the closed test for *will you have*, and then immediately after that, the closed test for *to eat*. So I heard the whole sentence 6 times in a row with no spaces. Of course, it's all in my working memory. That just doesn't help at all. What a waste of my time."
    - Cause: T26 (as specified) glued **one check per new form** directly after the `lr`, outside `spaceOut`, and every cloze autoplayed the full sentence on show *and* after the answer, so the audio also gave each blank away.
    - Follow-up interview: the learn day should be **one combined check late in the session** (≥ ~8 unrelated cards after the listen card), and a cloze should be **silent until answered**. The owner isn't sure yet whether reviews also feel back-to-back.
    - **Decision: revise → [T31](tasks/T31-spaced-combined-check.md)** (one check per sentence, ≥ 8 cards later, never adjacent; cloze audio only after answering).
    - Next check-in: ask whether the learn step still feels repetitive, and whether *reviews* have back-to-back repeats (this time's question 3 was "not sure yet").
  - **2026-11-01 · check-in.** Owner reports "still some repeats" in reviews, no example to hand. Not separable yet from the general volume complaint.
    - **Decision: keep.** Next check-in: get one concrete example (card, sentence, how soon).

## EXP-03 · Whole sentence later, part-level credit · [T27](tasks/T27-whole-sentence-later.md)

- **Status:** live since 2026-10-31
- **Complaint:** "Maybe I should write up the whole sentence." The owner was unsure how to test known sentences without re-blanking everything.
- **Hypothesis:** once a sentence's new forms are past their first rung, typing the whole sentence EN→RO is a better, less repetitive test. Sending only the *missed* parts back to single-form review avoids redoing the whole sentence.
- **Change:** `er` unlocks once every cloze form's `fm` is at ≥4 d. Grading aligns the answer and gives Again only to the wrong units' `fm` cards.
- **Expected felt difference:** sentence-level tests appear for "known" sentences; a slip on one word doesn't punish the rest.
- **Check-in questions:**
  1. Did you get whole-sentence (EN→RO) tests? Did they come at the right time, or too early/late?
  2. When you missed one word, did that word come back on its own? Was that the right word (did the alignment blame the right part)?
  3. Does writing the whole sentence feel like real speaking practice?
- **Rollback:** revert `er` grading to all-or-nothing.
- **Observations:**
  - **2026-11-01 · check-in.** Owner wants whole-sentence tests **sooner**: "if something is easy, chunk it into harder material instead of wasting time reviewing." The 4-day gate holds easy sentences in single-form review.
    - **Decision: revise → [T32](tasks/T32-easy-compose-up.md)** (EXP-07: `er` unlocks once each form is easy, and easy forms are reviewed together in one composite sentence).

## EXP-04 · "I can produce this" claims · [T28](tasks/T28-produce-claims.md)

- **Status:** live since 2026-10-30
- **Complaint:** "If I … already know it, I don't want to see a test for the word Cluj again."
- **Hypothesis:** letting the owner claim a form they can produce (trusted, with undo) removes trivially easy blanks without the app guessing what's trivial.
- **Change:** tap a word in feedback or on the word page → "I can produce *X* (gloss)". That form is never blanked again unless an EN→RO miss shows otherwise.
- **Expected felt difference:** names, cities and cognates disappear from tests after one tap.
- **Check-in questions:**
  1. How often did you use the claim? On what kinds of words?
  2. Did any claimed word get taken back by an EN→RO miss? Was that fair?
  3. Is the tap easy to find, or do you need it somewhere else (e.g. during learning)?
- **Rollback:** clear `state.claimed`. It's a separate key, so nothing else is touched.
- **Observations:**
  - **2026-11-01 · check-in.** Not asked directly. The owner wants material transparent from French/Italian/Spanish/Portuguese fast-tracked automatically, which is a content-side complement to manual claims, not a replacement.
    - **Decision: keep.** Ask the original questions next time.

## EXP-05 · Sentence families as paradigms · [T29](tasks/T29-sentence-families.md)

- **Status:** live since 2026-10-31
- **Complaint:** *he lives / you live / I live in Cluj* are drilled as if each were new.
- **Hypothesis:** introducing a family once as a small paradigm, then probing one random member per review, tests the *form choice* (the real skill) and stops near-identical repeats.
- **Change:** family detection; a paradigm card for up to 3 members; at most one due card per family per session; random-member carriers.
- **Expected felt difference:** fewer "same sentence again" moments; reviews make you choose the person/number.
- **Check-in questions:**
  1. Did you see a paradigm card? Was it clear and worth the time?
  2. In reviews, could you predict which form was coming? (You shouldn't be able to.)
  3. Any family members that weren't really one family (wrongly grouped)?
- **Rollback:** turn off family grouping; members return to being independent sentences.
- **Observations:**
  - **2026-11-01 · check-in.** No specific feedback; pace dominated the interview.
    - **Decision: keep.** Ask the original questions next time.

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
- **Observations:**
  - **2026-11-01 · check-in.** No specific feedback; pace dominated the interview.
    - **Decision: keep.** Ask the original questions next time.

---

## Check-in · 2026-11-01 · pace

**What's working (owner's words, paraphrased):** "What we've created so far is actually pretty cool. I really like the design." Switching between words and sentences, cloze and transformations, "is really nice". Picking specific topics has given "enough repetition to actually notice the differences and start to internalize them. So that's a real positive experience."

**What isn't:**
- "Any system that asks me to go slow … too much repetition, too slow of activity can really, really demotivate me." "Right now … it is going too slowly for me to be excited." "It's already getting really boring."
- "A big part of what is exciting is the pace at which I recognize new things so that I can internalize them." "I need … any system I'm using to keep track of if I'm going fast enough to be excited."
- Background: experienced polyglot with a linguistics and anthropology background (field methods, morphosyntax, phonology). Already speaks **French, Italian, Spanish and Portuguese**, so is used to learning Romance languages very quickly. Partly unexcited by Romanian itself, but doesn't want to accept that as the barrier.
- **Benchmark: Memrise.** "If I'm doing sentences or vocabulary more often with this app than I do in Memrise, then I'm definitely doing it too much." A good Memrise session is **10–20 new items in 5–10 minutes.** Uses Drops only for early sounds (past that), LingQ for reading (passive), Duolingo is "way too slow, way too constrictive". Has never had a good *production* tool; in real life, once a grammar pattern is understood, they work it into conversation well.

**Answers to the follow-up questions:**

| Question | Owner's answer |
|---|---|
| Where is it slow? | All four: too few new things, too many reviews, each card is slow, new grammar is drip-fed |
| What counts as a "new thing"? | All four: new vocabulary, new grammar patterns, new things I can say, faster recall |
| Mode used | Learn mode, picking topics |
| Slowest step in a card | **Typing answers** (mostly on a phone) |
| Use of their Romance languages | Fast-track the familiar; spend the time on what's different. (Not chosen: contrast notes on cards, a placement test.) |
| Recognition-first intake (Memrise-style) | Yes. "BUT I need a way to make reviews more aggressive about either chunking material in one view or widening review times because things are easy. Most beneficial for me is if something is easy, chunk it into harder material instead of wasting time reviewing. That's about grammar and vocab both." |
| What "chunk into harder material" means | Combine easy forms into a new sentence; whole sentence sooner. (Not chosen: transforms, bigger interval jumps alone.) |
| Faster answering | All of: say it aloud and self-grade, word tiles, lenient typing; mostly on a phone |
| Max review share | "Don't care if fast": the share matters less than each review being quick and actually testing |
| Repeats since Oct 30–31 | "Still some repeats", no example to hand |
| Build which experiments? | All four (EXP-07 to EXP-10), sequenced |

**Causes found in the code:** Learn mode gives `newPerSession` = 8 sentences at ~40 s each (Memrise pace is ~2–4× that). In Mix mode new sentences drop toward 0 as reviews fill `MIX_BUDGET_SEC`, so intake shrinks the more the app is used. An easy form still climbs 1 → 4 → 16 d one single review at a time, and `er` waits for a ≥ 4 d gap on every form. Nothing in content marks what a French/Italian/Spanish/Portuguese speaker can guess, so *Eu locuiesc în Cluj* costs as much as clitic doubling. Production cards are typed, and the feedback screen needs a tap to continue. No screen shows the learner their *intake* pace.

**Decision:** four new experiments, built one at a time so each can be judged at the next check-in: EXP-07 → EXP-08 → EXP-09 → EXP-10 (EXP-09 and EXP-10 touch different files and may run in parallel with the others). Measurement stays interview-only; EXP-10's pace display is shown to the owner on their device and never leaves it.

---

## EXP-07 · Easy becomes harder work · [T32](tasks/T32-easy-compose-up.md)

- **Status:** live since 2026-11-01
- **Complaint:** "If something is easy, chunk it into harder material instead of wasting time reviewing. That's about grammar and vocab both."
- **Hypothesis:** if forms the owner finds easy stop getting their own single-form reviews and are instead tested 2–4 at a time inside one EN→RO sentence (with only missed parts sent back), review time per form drops sharply and each review feels like a real production test.
- **Change:** a form is *easy* when its last counted grade was Easy, or it is claimed, or its `fm` gap is ≥ 4 d. `er` unlocks as soon as every cloze form of the sentence is easy (revises FR-R3's 4-day-only gate). Due easy forms are reviewed through a **composite** `er`: the sentence (seen or unseen) that covers the most due easy forms while every other unit is known. One answer reviews all of them, with part-level credit (T27).
- **Expected felt difference:** far fewer single-blank cards for things you know; more whole sentences; reviews that combine.
- **Check-in questions:**
  1. When you marked something Easy, did it stop coming back on its own? Did it reappear inside a bigger sentence?
  2. Did the combined sentences feel like a real test, or like a pile of things you already knew?
  3. When you missed one part of a combined sentence, was the right part sent back?
  4. Did whole-sentence tests arrive at the right time now (too early / about right / still too late)?
- **Rollback:** restore the 4-day `er` gate and turn off composite carriers (easy forms go back to single `fm` reviews; schedules are unaffected).
- **Observations:** _none yet_

## Owner preferences (standing)

- **No auto-advance, ever (2026-11-01).** The app must never move to the next card by itself. It cut off audio the owner wanted to hear and removed the chance to tap words in the sentence to turn them off (claims). Every card ends on an explicit Continue or Hard/Medium/Easy tap. Removed in 0.19.3 (0.19.2 collided with another release, so cached phones kept the old code), with the `autoAdvance` setting; do not reintroduce.

## EXP-08 · Fast intake, Romance fast-track · [T33](tasks/T33-fast-intake.md), [T34](tasks/T34-romance-fast-track.md)

- **Status:** live since 2026-11-01 (T33 and T34)
- **Complaint:** too few new things per session; the app treats a speaker of four Romance languages like a beginner. Memrise gives 10–20 new items in 5–10 minutes.
- **Hypothesis:** a Learn batch built for 15–20 new items in about 10 minutes, recognition first with the first production test the next day, plus fast-tracking material a French/Italian/Spanish/Portuguese speaker can guess, gets the owner to Memrise pace and puts the repetition on what's genuinely Romanian.
- **Change:** T33: Learn mode intake measured in *new items* (new forms + new sentences), target 15–20 per ~10 min; a lighter `lr` (one tap; its auto-advance was removed 2026-11-01); Mix mode keeps a floor of new material instead of dropping to 0. T34: content marks lexemes and patterns as **transparent** (guessable from FR/IT/ES/PT) or **divergent** (Romanian-specific: enclitic article, cases, clitic doubling, `să` subjunctive, `o să` future, `mi-e`, neuter plurals). Transparent forms that pass their first check skip ahead on the ladder and count less toward the novelty cap; divergent patterns keep full repetition.
- **Expected felt difference:** more new things per session; cognates and familiar structures fly by; time goes to the hard Romanian bits.
- **Check-in questions:**
  1. How many new things did a Learn session give you, and how long did it take? Close to Memrise?
  2. Did familiar (cognate) words fly by? Any that were marked familiar but that you actually found hard?
  3. Were the Romanian-specific patterns getting enough repetition, or too much?
  4. Did recognition-first feel too passive?
- **Rollback:** batch size back to 8 sentences; ignore `transparent` (treat everything as divergent).
- **Observations:** _none yet_

## EXP-09 · Faster answers · [T35](tasks/T35-faster-answers.md)

- **Status:** live since 2026-11-01
- **Complaint:** typing is the slowest step, mostly on a phone.
- **Hypothesis:** letting the owner answer production cards by **saying the sentence aloud and self-grading** (default), building it from **word tiles**, or **lenient typing**, roughly halves the time per card without losing production. Speaking aloud is also closest to the real goal.
- **Change:** an answer mode per card (`speak` / `tiles` / `type`, default `speak` on whole-sentence cards) with a quick switch on the card. Speak: English prompt → say it → reveal (with audio) → tap any words you got wrong (part-level credit via `erMisses`) or "All right". Tiles: the sentence's tokens plus distractor forms of the same lexemes. Type: a one-letter typo in a long word counts as correct (shown), and (auto-advance was removed 2026-11-01; see Owner preferences).
- **Expected felt difference:** cards take a few seconds; you're speaking more.
- **Check-in questions:**
  1. Which mode did you end up using most? Where?
  2. Was self-grading honest and easy (tapping the wrong words)?
  3. Did tiles make it too easy (guessable from the tiles)?
  4. ~~Did auto-advance ever skip something you wanted to look at?~~ Answered 2026-11-01: yes; auto-advance removed (see Owner preferences).
- **Rollback:** typing only, Continue button.
- **Observations:** _none yet_

## EXP-10 · Show the pace · [T36](tasks/T36-pace-meter.md)

- **Status:** live since 2026-11-01
- **Complaint:** "I need … any system I'm using to keep track of if I'm going fast enough to be excited."
- **Hypothesis:** showing the owner their **intake pace** (new items per 10 minutes, new patterns met) against a target they set, and letting the next Learn batch grow when they're under target and getting checks right, keeps momentum visible and stops the app quietly slowing down.
- **Change:** session summary leads with "New this session: N words · M sentences · pattern X" and items per 10 min vs the target (setting, default 15). Dashboard adds a weekly intake trend. A review-heavy session (no new items) is labelled as such. Learn batch size adapts: under target with ≥ 85 % on immediate checks → next batch +25 %; under 60 % → −25 % (bounded by the setting). Local only; nothing is exported.
- **Expected felt difference:** you can see you're moving; the app speeds up when you're coasting.
- **Check-in questions:**
  1. Do you look at the pace numbers? Do they match how fast it felt?
  2. Did the batch size grow or shrink? Was that the right call?
  3. Is the target (15 per 10 min) right?
- **Rollback:** hide the pace block; fixed batch size.
- **Observations:** _none yet_

---

## Check-in · 2026-11-04 · review load

**Owner:** "Things don't go fast enough because of the amount of reviews, and my success rate with reviews is way too high for what would be effective." Two standing rules from the owner: **every subsequent success should lengthen the time to the next review, whatever the rating**, and the Hard/Medium/Easy spacing should fit them. A second complaint: being tested on words they already marked *I can produce this*, or on a word that was on screen a card or two earlier ("it's still in my working memory").

**Causes found in the code:**

- Hard on a young card loops. At the 1-day rung it comes back in 10 minutes, every session, until the owner answers Medium. At the 256-day rung, Hard shortens the gap to 250 days.
- The Medium ladder (1 → 4 → 16 → 64 → 256 d) and Easy (3× that) are fixed, and FSRS runs on default weights that were never fitted to the owner. Under those defaults the ladder already expects about 96 %, 93 %, 90 %, 87 % and 85 % recall at the five rungs.
- A word typed correctly inside a whole-sentence card gives its own `fm` card no credit (a miss does fail it).
- `spaceOut` keeps related cards only 2 apart, and it only knows *tested* words, not words that were on screen.
- A sentence of only claimed words still becomes an EN→RO card.

**Research summary:**

- **Default targets elsewhere.** Anki FSRS targets 90 % retention and fits weights to the user. SuperMemo defaults to about 95 % retention (forgetting index 10 %, recommended 5–14 %). Classic Anki uses ×2.5 per success, with Hard ×1.2 and Easy ×1.3.
- **Workload.** Total review time against target retention is U-shaped (FSRS wiki).
- **Gap and test delay.** The optimal gap shrinks from 20–40 % of the test delay at 1 week to 5–10 % at 1 year (Cepeda et al. 2008).
- **Effortful success.** Successful retrieval after some forgetting builds more memory than easy success (Bjork's desirable difficulties; Pyc & Rawson 2009).
- **Working backwards from success rate.** Under the FSRS forgetting curve, an observed 95 % implies gaps about 2.2× too short for a 90 % target and about 3.6× too short for 85 %; 97 % implies about 3.7× and 6×.
- **Implicit credit.** Math Academy's FIRe gives discounted credit to items practised inside other items, because such repetitions are "often too early to count for full credit". Anki only buries siblings of the same note.
- **Priming.** High retrieval strength means little gain in storage strength (Bjork & Bjork), so a right answer just after an exposure is weak evidence.

**Decisions:**

| Question | Decision |
|---|---|
| Spacing | Every success lengthens. Hard 2 d then ×1.5, Medium 4 d then ×3, Easy 10 d then ×6, times a personal multiplier. |
| Hard in session | Not re-queued; next review on a later day. Only wrong answers come back in the session. |
| Target retention | Setting, default **85 %**. The multiplier is nudged **daily** toward it (≤ ±5 %/day, 0.5×–4×). |
| Export for a starting point | No. Start at 1.0 and let the daily nudge find it. |
| Familiarity / priming | Split into separate tasks so they can run in parallel. A primed correct answer gets **partial** credit. |

---

## EXP-11 · Spacing that fits you · [T37](tasks/T37-calibrated-spacing.md)

- **Status:** built in T37, goes live on merge
- **Complaint:** "My success rate with reviews is way too high for what would be effective."
- **Hypothesis:** if every success lengthens the gap and a personal multiplier is nudged each day toward an 85 % target, reviews per day drop and each review takes some effort, with no rise in long-gap failures beyond the target.
- **Change:** new gap rules (Hard 2 d / ×1.5, Medium 4 d / ×3, Easy 10 d / ×6, never shorter than the last gap, cap 365 d). Hard is no longer re-queued in the session. Daily nudge on due reviews with a gap of ≥ 4 d; a target-retention slider (default 85 %); a dashboard line "target vs actual · gaps ×m".
- **Expected felt difference:** noticeably fewer reviews; reviews that sometimes make you think; a Hard answer no longer sends a card straight back.
- **Check-in questions:**
  1. Did the daily review count drop? By roughly how much?
  2. What does the dashboard say your actual rate is? Does that match how it feels?
  3. Is 85 % the right target, or do misses feel too frequent?
  4. Did anything come back much too late?
- **Rollback:** multiplier fixed at 1 and the old ladder restored (`baseGap` is ignored by the old code).
- **Observations:** _none yet_

## EXP-12 · Credit what you already know · [T38](tasks/T38-credit-produced-words.md)–[T42](tasks/T42-claims-shape-cards.md)

- **Status:** live since 2026-11-04 (T38, T41 merged; T39, T40, T42 still to come)
- **Complaint:** "How often am I being tested on something that I've marked I can produce this … if the first sentence contained the second sentence's word, then it's still in my working memory."
- **Hypothesis:** if words get credit when produced or met in other cards (T38, T39), aren't tested right after they were on screen (T40), near-identical sentences are spread apart (T41), and claimed words stop generating tests (T42), the review count drops further and the reviews that remain feel like real recall.
- **Change:**
  - T38: a correct part of an EN→RO, transform or slot card reviews that word's own card when it's on time.
  - T39: a discounted bump for words met in context (25 % seen, 50 % produced early).
  - T40: a card is moved or deferred if its word was on screen earlier in the session; a forced primed success gets 25 % credit.
  - T41 (built, `g:` key in `cardKeys`): sentences sharing ≥ 50 % of their content words count as siblings.
  - T42: all-claimed sentences only get a 60-day claim check; all-but-one-claimed becomes one card, not two.
- **Expected felt difference:** fewer "I just saw that" moments; fewer cards for things you've claimed; a sentence answer counts for its words.
- **Check-in questions:**
  1. Do you still get a word tested shortly after it was on screen?
  2. Do claimed words still turn up as tests? When they do (the claim check), does it feel fair?
  3. Did near-identical sentences stop coming back to back?
  4. Does anything feel like it comes back too rarely now?
- **Rollback:** each task is independent. Remove its hook (credit, guard, `g:` key or queue step) and the schedules stay valid.
- **Observations:** _none yet_
