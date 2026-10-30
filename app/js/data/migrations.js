/** Schema migrations, keyed by the schemaVersion they migrate FROM. */

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Merge one CardState into the `fm` card for a unit: the strongest state wins (highest `stability`, ties the
 * latest `lastReview`) and `lapses` are summed. Mutates `cards`.
 */
function mergeInto(cards, fmId, card) {
  const cur = cards[fmId];
  if (!cur) { cards[fmId] = { ...card }; return; }
  const win = card.stability > cur.stability || (card.stability === cur.stability && (card.lastReview ?? 0) > (cur.lastReview ?? 0));
  cards[fmId] = { ...(win ? card : cur), lapses: (cur.lapses ?? 0) + (card.lapses ?? 0) };
}

/** `kf:<lex>:<form>` → `fm:<lex>:<form>` (same lexeme and form, so it needs no content). */
const kfToFm = (id) => `fm:${id.slice(3)}`;

/** @type {Record<number, (state: object) => object>} */
export const migrations = {
  // 1 → 2: one schedule per word form. `kf` cards fold into `fm` here; `cz` cards need the content to find
  // their token's units, so `foldClozeCards` finishes the job once it is loaded (idempotent).
  1: (s) => {
    const cards = {};
    for (const [id, c] of Object.entries(s.cards ?? {})) {
      if (id.startsWith("kf:")) mergeInto(cards, kfToFm(id), c);
      else cards[id] = c;
    }
    const difficult = {};
    for (const [id, ts] of Object.entries(s.difficult ?? {})) difficult[id.startsWith("kf:") ? kfToFm(id) : id] = ts;
    return { ...s, schemaVersion: 2, cards, difficult };
  },
};

/** True if the state still holds old `cz` cards (or `difficult` entries) that `foldClozeCards` has to fold. */
export function hasLegacyCloze(state) {
  return Object.keys(state.cards ?? {}).some((id) => id.startsWith("cz:"))
    || Object.keys(state.difficult ?? {}).some((id) => id.startsWith("cz:"));
}

/**
 * Finish the 1 → 2 migration: fold each `cz:<sid>:<i>` card into the `fm` card of every lexeme-form unit of that
 * token (strongest state wins, lapses summed), and remap `difficult` the same way. A `cz` card whose sentence or
 * token is no longer in the content is dropped. `attempts` and `unitAggregates` are untouched. Returns the same
 * state object when there is nothing to fold.
 * @param {object} state
 * @param {{sentences: Map<string, {tokens: {units: {lex: string, form: string}[]}[]}>}} content
 */
export function foldClozeCards(state, content) {
  if (!hasLegacyCloze(state)) return state;
  const fmIdsFor = (czId) => {
    const [, sid, i] = czId.split(":");
    const units = content.sentences.get(sid)?.tokens[Number(i)]?.units ?? [];
    return [...new Set(units.map((u) => `fm:${u.lex}:${u.form}`))];
  };
  const cards = {};
  const legacy = [];
  for (const [id, c] of Object.entries(state.cards)) {
    if (id.startsWith("cz:")) legacy.push([id, c]);
    else cards[id] = c;
  }
  for (const [id, c] of legacy) for (const fm of fmIdsFor(id)) mergeInto(cards, fm, c);
  const difficult = {};
  for (const [id, ts] of Object.entries(state.difficult ?? {})) {
    for (const key of id.startsWith("cz:") ? fmIdsFor(id) : [id]) difficult[key] = Math.max(ts, difficult[key] ?? 0);
  }
  return { ...state, cards, difficult };
}

/**
 * Run every pending migration in order.
 * @param {object} state  parsed state with a numeric schemaVersion <= CURRENT_SCHEMA_VERSION
 * @returns {object}
 */
export function migrate(state) {
  let s = state;
  while (s.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = migrations[s.schemaVersion];
    if (!step) throw new Error(`No migration from schemaVersion ${s.schemaVersion}`);
    s = step(s);
  }
  return s;
}
