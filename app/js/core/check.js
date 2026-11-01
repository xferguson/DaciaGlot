// Answer checking (ARCHITECTURE §5, PRD FR-A1…A4). Pure.
import { normalize, stripDiacritics, tokenize } from './normalize.js';
import { canonicalize } from './equivalences.js';

export { normalize, stripDiacritics, tokenize };

const RANK = { correct: 0, 'correct-diacritics': 1, 'correct-typo': 2, wrong: 3 };
export const TYPO_MIN_LEN = 5;

const plain = (t) => stripDiacritics(t).toLowerCase().replace(/[.,!?;:"“”„]+/g, '');

/** Exactly one insert / delete / substitute / adjacent transposition apart (not equal). */
export function oneEdit(a, b) {
  if (a === b) return false;
  const x = [...a], y = [...b];
  if (Math.abs(x.length - y.length) > 1) return false;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  if (x.length === y.length) {
    if (x.slice(i + 1).join('') === y.slice(i + 1).join('')) return true;
    return x[i] === y[i + 1] && x[i + 1] === y[i] && x.slice(i + 2).join('') === y.slice(i + 2).join('');
  }
  const [long, short] = x.length > y.length ? [x, y] : [y, x];
  return long.slice(i + 1).join('') === short.slice(i).join('');
}

function analyse(text) {
  const raw = tokenize(text);
  return { raw, items: canonicalize(raw, true) };
}

function spanText(a, item) {
  return a.raw.slice(item.start, item.end).join(' ');
}

/** Strict canonical form of a span (diacritics significant), for flagging diacritic-only differences. */
function strictKey(tokens) {
  return canonicalize(tokens, false).map((i) => i.canon).join(' ');
}

function lcsPairs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

function compare(inp, exp, avoid) {
  const status = new Array(exp.items.length).fill('wrong');
  const extraItems = [];
  const pairs = lcsPairs(exp.items.map((x) => x.canon), inp.items.map((x) => x.canon));
  const anchors = [...pairs, [exp.items.length, inp.items.length]];
  let pe = 0, pi = 0;
  for (const [ei, ii] of anchors) {
    const e = ei - pe, i = ii - pi;
    const paired = Math.min(e, i);
    for (let k = 0; k < e; k++) status[pe + k] = k < paired ? 'wrong' : 'missing';
    for (let k = 0; k < paired; k++) {
      const ei2 = exp.items[pe + k], ii2 = inp.items[pi + k];
      if (ei2.end - ei2.start !== 1 || ii2.end - ii2.start !== 1) continue;
      const want = plain(exp.raw[ei2.start]), got = plain(inp.raw[ii2.start]);
      if ([...want].length >= TYPO_MIN_LEN && !avoid.has(got) && oneEdit(want, got)) status[pe + k] = 'typo';
    }
    for (let k = paired; k < i; k++) extraItems.push(inp.items[pi + k]);
    if (ei < exp.items.length) {
      const same = strictKey(exp.raw.slice(exp.items[ei].start, exp.items[ei].end))
        === strictKey(inp.raw.slice(inp.items[ii].start, inp.items[ii].end));
      status[ei] = same ? 'ok' : 'diacritic';
    }
    pe = ei + 1;
    pi = ii + 1;
  }
  const diff = [];
  exp.items.forEach((item, idx) => {
    for (let t = item.start; t < item.end; t++) diff.push({ token: exp.raw[t], status: status[idx] });
  });
  const extra = extraItems.map((it) => spanText(inp, it));
  const bad = status.filter((s) => s === 'wrong' || s === 'missing').length;
  let result;
  if (bad > 0 || extra.length > 0) result = 'wrong';
  else if (status.includes('typo')) result = 'correct-typo';
  else result = status.includes('diacritic') ? 'correct-diacritics' : 'correct';
  return { result, diff, extra, score: bad + extra.length };
}

/**
 * Check `input` against `expected` and every `accept` alternative; the best candidate wins.
 * `diff` is over the winning candidate's expected tokens.
 * Typo tolerance (FR-A6): one edit in a single token of ≥ 5 letters is `correct-typo` (that token's status is `typo`),
 * unless the typed word is one of `avoid` (other forms of the same lexemes: that is a different answer, not a slip).
 */
export function checkAnswer(input, expected, accept = [], { avoid = [] } = {}) {
  const avoidSet = new Set([...avoid].map(plain));
  const inp = analyse(input);
  let best = null;
  for (const candidate of [expected, ...accept]) {
    const r = compare(inp, analyse(candidate), avoidSet);
    if (!best || RANK[r.result] < RANK[best.result]
      || (r.result === best.result && r.score < best.score)) best = r;
  }
  return { result: best.result, diff: best.diff, extra: best.extra };
}
