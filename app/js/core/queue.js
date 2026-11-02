// Building a session queue: modes as data and the pipeline selectDue → trimToBudget → pickNew → groupNew → interleave → estimate (ARCHITECTURE §8). Pure.
import { buildCardId, isCardType, cardsForSentence, newKfCards, newTransformCards, newErCards, pickPerSentence, parseCardId } from "./cards.js";
import { unitsForSentence, isKnown } from "./units.js";
import { pickNewSentences, focusList, siblingsOf, newItemCount } from "./select.js";
import { learnBatch } from "./pace.js";
import { pickOne } from "./random.js";
import { cardKeys, dueCards, dueInFocus, inFocus, onePerFamily, composeReviews, burySiblings } from "./due.js";
import { isClaimedCard } from "./review.js";
import { spaceOut, placeChecks } from "./spacing.js";

export const QUICK_CAP = 15;
export const SEC_PER_REVIEW = 12;
export const SEC_PER_NEW = 40;
/** T33: a new sentence in Learn mode (fast `lr`, one tap) including its share of the combined check. */
export const SEC_PER_NEW_FAST = 25;
/** Mix never drops below this many new sentences because of reviews; the review part is trimmed instead (T33). */
export const MIX_MIN_NEW = 3;
/** Mix aims for a session of about this long: due reviews first, new sentences fill what's left. */
export const MIX_BUDGET_SEC = 12 * 60;
/** With a focus, Mix also brings in up to this many of the most overdue cards from outside it (FR-S8). */
export const MIX_OUTSIDE = 3;
/** Below this many seen sentences, new sessions top up with the easiest sentences (FR-S4 order) when i+1 finds too few. */
export const COLD_START_SEEN = 30;
/** A new sentence costs `SEC_PER_NEW` for one `lr` plus one new form to check; each form more (or fewer) scales it (FR-R2). */
export const newSentenceSec = (forms, perNew = SEC_PER_NEW) => (perNew * (1 + forms)) / 2;
/** Each extra member of a paradigm card adds this much reading time to the estimate. */
const SEC_PER_PARADIGM_ROW = 10;

/**
 * Mix mode: how many new sentences to add given the review load. All due cards stay in; new
 * sentences fill the rest of `MIX_BUDGET_SEC`, at most `newPerSession`, but never fewer than `MIX_MIN_NEW`
 * (or `newPerSession` if lower): once reviews fill the budget they are trimmed instead (T33).
 * `reviewPct` is the review share of the estimated time.
 * @returns {{newCount: number, reviewPct: number}}
 */
export function mixPlan(due, newPerSession) {
  const room = Math.floor((MIX_BUDGET_SEC - due * SEC_PER_REVIEW) / SEC_PER_NEW);
  const newCount = Math.max(Math.min(MIX_MIN_NEW, newPerSession), Math.min(newPerSession, room));
  const total = due * SEC_PER_REVIEW + newCount * SEC_PER_NEW;
  return { newCount, reviewPct: total ? Math.round((100 * due * SEC_PER_REVIEW) / total) : 0 };
}

/**
 * Learn mode (T33): new sentences until their new-item count reaches `settings.newItemsPerLearn`
 * (paradigm batches count each member's new forms). Same result shape as `pickNewSentences`, plus `items`.
 */
export function learnPlan(state, content, focus, now, rng) {
  const items = learnBatch(state);
  return pickNewSentences(Infinity, { focus, state, content, now, rng, items });
}

/** PRD FR-S4 interim order: stage ↑, fewest unknown units ↑, id. */
export function interimNewSentences(n, state, content) {
  const registers = state.settings.registers;
  return [...content.sentences.values()]
    .filter((s) => !(s.id in state.seenSentences) && registers.includes(s.register))
    .map((s) => ({ s, unknown: unitsForSentence(s).filter((u) => !isKnown(u, state, content)).length }))
    .sort((a, b) => a.s.stage - b.s.stage || a.unknown - b.unknown || (a.s.id < b.s.id ? -1 : 1))
    .slice(0, n)
    .map((x) => x.s.id);
}


/** Seconds one queue item takes: a composite review (FR-V1) is a whole sentence, so twice a single card. */
const itemSec = (q) => (q.composite ? 2 : 1) * SEC_PER_REVIEW;
const dueSec = (items) => items.reduce((n, q) => n + itemSec(q), 0);

/**
 * Modes (PRD FR-S6, FR-S7, FR-S10) as data. `due`: due cards are in the queue; `cap`: most of them; `outside`: with a
 * focus, this many of the most overdue cards from outside it are added; `newItems`: how new material is sized
 * (`null` none, `learn` by `learnPlan`, `mix` by `mixPlan`, `fixed` by `settings.newPerSession`). `session` is legacy.
 */
export const MODES = {
  quick: { due: true, cap: QUICK_CAP, outside: 0, newItems: null },
  review: { due: true, cap: Infinity, outside: 0, newItems: null },
  learn: { due: false, cap: Infinity, outside: 0, newItems: "learn" },
  mix: { due: true, cap: Infinity, outside: MIX_OUTSIDE, newItems: "mix" },
  session: { due: true, cap: Infinity, outside: 0, newItems: "fixed" },
};

/** Step 1. The due queue items for the mode, thinned per sentence (FR-D9), family and sibling (FR-R5, FR-R2). */
export function selectDue(spec, { focus, state, content, now, rng }) {
  let focused = dueInFocus(state, content, now, focus);
  if (focus && spec.outside) {
    const outside = dueCards(state, content, now).filter((id) => !inFocus(id, focus, content, state)).slice(0, spec.outside);
    focused = [...focused, ...outside];
  }
  const duePicked = pickPerSentence(focused);
  const { ids, comps } = composeReviews(onePerFamily(duePicked, content, rng), state, content, now, rng, focus);
  const items = burySiblings(ids, content).map((cardId) => {
    const units = isCardType(cardId, "er") ? comps.get(parseCardId(cardId).sentenceId) : null;
    return units ? { cardId, isNew: false, composite: true, units } : { cardId, isNew: false };
  });
  return { items, duePicked };
}

/** Step 2 (Mix only, T33). New material has a floor; the review part is trimmed to what is left of the budget (oldest-due stay). */
export function trimToBudget(due, newPerSession) {
  const plan = mixPlan(dueSec(due) / SEC_PER_REVIEW, newPerSession);
  const left = MIX_BUDGET_SEC - plan.newCount * SEC_PER_NEW;
  let used = 0;
  const kept = [];
  for (const q of due) {
    if (used + itemSec(q) > left) break;
    used += itemSec(q);
    kept.push(q);
  }
  if (kept.length === due.length) return { due, plan };
  return { due: kept, plan: mixPlan(dueSec(kept) / SEC_PER_REVIEW, newPerSession) };
}

/** New profile: i+1 finds few sentences yet, so top up with the easiest ones (FR-S4 order). */
function coldStartTopUp(ids, have0, want, { focus, state, content }) {
  if (have0 >= want || Object.keys(state.seenSentences).length >= COLD_START_SEEN) return ids;
  const have = new Set(ids);
  const extra = interimNewSentences(Infinity, state, content)
    .filter((id) => !have.has(id) && inFocus(buildCardId("lr", id), focus, content, state))
    .slice(0, want - have0);
  return [...ids, ...extra];
}

/**
 * Step 3. The new sentences to introduce: `newSentenceIds` as given, or chosen by `select.js` (FR-S5; the FR-S4 interim
 * order is the cold-start fallback). `{blocked, suggest}` when nothing new can be taught now.
 */
export function pickNew(spec, { plan, focus, state, content, now, rng, newSentenceIds }) {
  if (newSentenceIds) return { ids: newSentenceIds };
  const learn = spec.newItems === "learn";
  const want = plan ? plan.newCount : learn ? learnBatch(state) : state.settings.newPerSession;
  const pick = learn ? learnPlan(state, content, focus, now, rng) : pickNewSentences(want, { focus, state, content, now, rng });
  if (pick.blocked) return { blocked: true, suggest: pick.suggest };
  const ids = pick.sentences.length || focus ? pick.sentences : interimNewSentences(want, state, content);
  const have0 = learn ? newItemCount(ids, state, content) : ids.length;
  return { ids: coldStartTopUp(ids, have0, want, { focus, state, content }) };
}

/** One check item per new sentence: all its new forms, blanked together in one card. */
function oneCheck(fmIds, from) {
  return fmIds.length ? [{ cardId: fmIds[0], isNew: true, from, check: true, forms: fmIds }] : [];
}

/** A paradigm (FR-R5): one card for the family, one immediate check on a random member, the rest due tomorrow. */
function paradigmGroup(s, sibs, { content, rng, newFms }) {
  const members = [s.id, ...sibs];
  const chosen = content.sentences.get(pickOne(members, rng));
  const checks = newFms(chosen);
  const deferred = members.flatMap((m) => (m === chosen.id ? [] : newFms(content.sentences.get(m))));
  return [
    { cardId: buildCardId("pg", content.familyOf.get(s.id)), isNew: true, members, deferred },
    ...oneCheck(checks, chosen.id),
  ];
}

/** The ids not yet in `assigned` and not claimed by the learner (FR-R4), in order; adds them to `assigned`. */
function takeOnce(ids, assigned, state) {
  const out = [];
  for (const id of ids) {
    if (isClaimedCard(id, state) || assigned.has(id)) continue;
    assigned.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Step 4. Each new sentence as a group of queue items: its `lr`/`cz` cards then one combined check, or a paradigm card
 * for a family. One schedule per word form: a form shared by two new sentences gets its `fm` card from the first.
 * @returns {{groups: object[][], assigned: Set<string>}} `assigned` is every card id already given to a group
 */
export function groupNew(ids, { state, content, rng }) {
  const assigned = new Set();
  const newFms = (s) => takeOnce(cardsForSentence(s, content, state).filter((cardId) => isCardType(cardId, "fm")), assigned, state);
  const grouped = new Set(ids);
  const groups = ids
    .map((id) => content.sentences.get(id))
    .filter(Boolean)
    .map((s) => {
      const sibs = siblingsOf(s.id, { state, content }).filter((m) => !grouped.has(m));
      if (sibs.length) {
        sibs.forEach((m) => grouped.add(m));
        return paradigmGroup(s, sibs, { content, rng, newFms });
      }
      const own = takeOnce(cardsForSentence(s, content, state), assigned, state);
      return [
        ...own.filter((cardId) => !isCardType(cardId, "fm")).map((cardId) => ({ cardId, isNew: true })),
        ...oneCheck(own.filter((cardId) => isCardType(cardId, "fm")), s.id),
      ];
    });
  return { groups, assigned };
}

/** Newly unlocked `kf` (T14), `xf`/`sb` (T15) and `er` (T20) drills, in that order; `kf` only without a focus. */
export function newDrills({ focus, state, content, duePicked, assigned }) {
  const item = (cardId) => ({ cardId, isNew: true });
  const kf = focus ? [] : newKfCards(state, content).filter((id) => !assigned.has(id) && !isClaimedCard(id, state)).map(item);
  const busy = new Set(duePicked.map(parseCardId).filter((p) => p.type === "xf" || p.type === "sb").map((p) => p.sentenceId));
  const xf = newTransformCards(state, content, { skip: busy }).filter((id) => inFocus(id, focus, content, state)).map(item);
  const taken = new Set([...busy, ...xf.map((x) => parseCardId(x.cardId).sentenceId)]);
  const er = newErCards(state, content, { skip: taken }).filter((id) => inFocus(id, focus, content, state)).map(item);
  return [...kf, ...xf, ...er];
}

/** Split a list into `parts` consecutive chunks of about equal size. */
function chunk(list, parts) {
  const out = Array.from({ length: parts }, () => []);
  list.forEach((x, i) => out[Math.min(parts - 1, Math.floor((i * parts) / list.length))].push(x));
  return out;
}

/** Step 5. Due cards spread between the new groups so two new sentences' `lr` cards are never adjacent; drills last. */
export function interleave(due, groups, drills) {
  const queue = [];
  if (groups.length === 0) queue.push(...due);
  else {
    const slots = chunk(due, 2 * groups.length + 1);
    queue.push(...slots[0]);
    groups.forEach((g, i) => {
      queue.push(g[0], ...slots[2 * i + 1], ...g.slice(1), ...slots[2 * i + 2]);
    });
  }
  return [...queue, ...drills];
}

/** Step 6. Seconds the queue takes: due reviews, each drill, and each new sentence by its forms (paradigms by their rows). */
export function estimate(due, groups, drills, learn) {
  const perNew = learn ? SEC_PER_NEW_FAST : SEC_PER_NEW;
  const sentenceSec = (g) => newSentenceSec(g.reduce((n, q) => n + (q.forms?.length ?? 0), 0), perNew)
    + (g[0].members ? SEC_PER_PARADIGM_ROW * (g[0].members.length - 1) : 0);
  return dueSec(due) + drills.length * SEC_PER_NEW + groups.reduce((sum, g) => sum + sentenceSec(g), 0);
}

/** `selectDue`, `trimToBudget` and the later steps wired by the mode's spec. */
function composeSession({ mode, focus: rawFocus = null, state, content, now, rng, newSentenceIds }) {
  const spec = MODES[mode] ?? MODES.session;
  const focus = focusList(rawFocus).length ? focusList(rawFocus) : null;
  const ctx = { focus, state, content, now, rng };
  const { items, duePicked } = selectDue(spec, ctx);
  if (!spec.newItems) {
    const queue = items.slice(0, spec.cap);
    return { queue, estimateSec: dueSec(queue) };
  }
  let due = spec.due ? items : [];
  let plan = null;
  if (spec.newItems === "mix") ({ due, plan } = trimToBudget(due, state.settings.newPerSession));
  if (plan && plan.newCount === 0 && !newSentenceIds) return { queue: due, estimateSec: dueSec(due), plan };
  const picked = pickNew(spec, { ...ctx, plan, newSentenceIds });
  if (picked.blocked) return { queue: due.slice(), estimateSec: dueSec(due), blocked: true, suggest: picked.suggest };
  const { groups, assigned } = groupNew(picked.ids, ctx);
  const drills = newDrills({ ...ctx, duePicked, assigned });
  const queue = interleave(due, groups, drills);
  const estimateSec = estimate(due, groups, drills, spec.newItems === "learn");
  return plan ? { queue, estimateSec, plan } : { queue, estimateSec };
}

/**
 * Build a session queue (PRD FR-S6, FR-S7, FR-S10; modes in `MODES`):
 * - `quick`: due cards only, capped at 15.
 * - `review`: every due card, nothing new.
 * - `learn`: new material only (no due cards): `newItemsPerLearn` new items (`learnPlan`) plus newly unlocked drills.
 * - `mix`: all due cards plus as many new sentences as `mixPlan` allows; no new drills when it allows none.
 * - `session` (legacy): all due cards plus `newPerSession` new sentences.
 * Any mode takes a `focus` (one topic or a list), which filters everything to those situations/patterns
 * (FR-S8): due cards, new sentences and drills; `kf` cards are left out. Mix with a focus also adds the
 * `MIX_OUTSIDE` most overdue cards from outside it.
 * A new profile (< `COLD_START_SEEN` seen sentences) is topped up to the wanted number of new sentences.
 * The queue is then spaced out (`spaceOut`) so related cards are not back to back, and the immediate checks placed.
 * @returns {{queue: {cardId: string, isNew: boolean}[], estimateSec: number, blocked?: true, suggest?: {type: string, id: string}|null, plan?: {newCount: number, reviewPct: number}}}
 */
export function buildSession(opts) {
  const out = composeSession(opts);
  return { ...out, queue: placeChecks(spaceOut(out.queue, opts.content)) };
}
