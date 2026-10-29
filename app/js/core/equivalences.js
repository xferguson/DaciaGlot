// Contraction equivalence table (ARCHITECTURE §5, PRD FR-A3). Pure.
import { stripDiacritics, tokenKey } from './normalize.js';

/** Each row is a set of interchangeable spellings; the first member is canonical. */
export const EQUIVALENCE_SETS = [
  ['n-am', 'nu am'],
  ['n-ai', 'nu ai'],
  ['n-a', 'nu a'],
  ['n-au', 'nu au'],
  ['n-are', 'nu are'],
  ['n-o să', 'nu o să'],
  ['nu-i', 'nu e', 'nu este'],
  ['mi-e', 'îmi e', 'îmi este'],
  ['ți-e', 'îți e', 'îți este'],
  ['i-e', 'îi e', 'îi este'],
  ['ne e', 'ne este'],
  ['e', 'este'],
];

const MAX_SPAN = Math.max(...EQUIVALENCE_SETS.flat().map((m) => m.split(' ').length));

function buildLookup(strip) {
  const map = new Map();
  for (const row of EQUIVALENCE_SETS) {
    const canon = row[0];
    for (const member of row) {
      const key = member.split(' ').map((t) => (strip ? stripDiacritics(tokenKey(t)) : tokenKey(t))).join(' ');
      map.set(key, canon);
    }
  }
  return map;
}

const LOOKUPS = { strict: buildLookup(false), loose: buildLookup(true) };

/**
 * Map raw tokens to canonical items, longest span first.
 * Returns [{ canon, start, end }] where [start, end) indexes the raw tokens consumed.
 * Pure-punctuation tokens are dropped. With `strip`, diacritics are ignored when matching and in `canon`.
 */
export function canonicalize(tokens, strip = false) {
  const lookup = strip ? LOOKUPS.loose : LOOKUPS.strict;
  const keys = tokens.map((t) => {
    const k = tokenKey(t);
    return strip ? stripDiacritics(k) : k;
  });
  const items = [];
  let i = 0;
  while (i < tokens.length) {
    if (keys[i] === '') { i++; continue; }
    let matched = false;
    for (let len = Math.min(MAX_SPAN, tokens.length - i); len >= 1; len--) {
      const span = keys.slice(i, i + len);
      if (span.includes('')) continue;
      const canon = lookup.get(span.join(' '));
      if (canon !== undefined) {
        items.push({ canon: strip ? stripDiacritics(canon) : canon, start: i, end: i + len });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      items.push({ canon: keys[i], start: i, end: i + 1 });
      i++;
    }
  }
  return items;
}
