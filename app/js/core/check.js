// Answer checking (ARCHITECTURE §5, PRD FR-A1…A4). Pure.
import { normalize, stripDiacritics, tokenize } from './normalize.js';
import { canonicalize } from './equivalences.js';

export { normalize, stripDiacritics, tokenize };

const RANK = { correct: 0, 'correct-diacritics': 1, wrong: 2 };

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

function compare(inp, exp) {
  const status = new Array(exp.items.length).fill('wrong');
  const extraItems = [];
  const pairs = lcsPairs(exp.items.map((x) => x.canon), inp.items.map((x) => x.canon));
  const anchors = [...pairs, [exp.items.length, inp.items.length]];
  let pe = 0, pi = 0;
  for (const [ei, ii] of anchors) {
    const e = ei - pe, i = ii - pi;
    const paired = Math.min(e, i);
    for (let k = 0; k < e; k++) status[pe + k] = k < paired ? 'wrong' : 'missing';
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
  else result = status.includes('diacritic') ? 'correct-diacritics' : 'correct';
  return { result, diff, extra, score: bad + extra.length };
}

/**
 * Check `input` against `expected` and every `accept` alternative; the best candidate wins.
 * `diff` is over the winning candidate's expected tokens.
 */
export function checkAnswer(input, expected, accept = []) {
  const inp = analyse(input);
  let best = null;
  for (const candidate of [expected, ...accept]) {
    const r = compare(inp, analyse(candidate));
    if (!best || RANK[r.result] < RANK[best.result]
      || (r.result === best.result && r.score < best.score)) best = r;
  }
  return { result: best.result, diff: best.diff, extra: best.extra };
}
