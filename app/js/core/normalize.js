// Text normalization for answer checking (PRD FR-A1). Pure: no DOM, no storage.

const QUOTES_AND_PUNCT = '„”“"‚‘’\'«».,;:!?…()[]';
const EDGE = new RegExp(`^[${escapeForClass(QUOTES_AND_PUNCT)}\\s]+|[${escapeForClass(QUOTES_AND_PUNCT)}\\s-]+$`, 'gu');
const INNER = new RegExp(`[${escapeForClass(QUOTES_AND_PUNCT)}]`, 'gu');

function escapeForClass(s) {
  return s.replace(/[\]\\^-]/g, '\\$&');
}

const DIACRITICS = { ă: 'a', â: 'a', î: 'i', ș: 's', ț: 't', ş: 's', ţ: 't' };

/** PRD FR-A1: NFC, lowercase, cedilla→comma-below, hyphen variants→"-", collapse whitespace, strip edge punctuation/quotes. */
export function normalize(s) {
  return String(s)
    .normalize('NFC')
    .toLowerCase()
    .replace(/ş/g, 'ș')
    .replace(/ţ/g, 'ț')
    .replace(/[‑–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(EDGE, '')
    .trim();
}

/** ă→a â→a î→i ș→s ț→t (also handles cedilla forms and capitals). */
export function stripDiacritics(s) {
  return String(s)
    .normalize('NFC')
    .replace(/[ăâîșțşţĂÂÎȘȚŞŢ]/g, (c) => {
      const lower = c.toLowerCase();
      const base = DIACRITICS[lower];
      return c === lower ? base : base.toUpperCase();
    });
}

/** Split on whitespace. Hyphenated clitic clusters (n-am, mi-e) stay one token. Raw text is preserved. */
export function tokenize(s) {
  return String(s).split(/\s+/).filter(Boolean);
}

/** Comparison key for one token: normalized, with punctuation inside the token removed. Empty for pure punctuation. */
export function tokenKey(token) {
  return normalize(token).replace(INNER, '').replace(/^-+|-+$/g, '');
}
