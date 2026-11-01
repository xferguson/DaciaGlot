import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, stripDiacritics, tokenize, checkAnswer } from '../app/js/core/check.js';
import { tokenKey } from '../app/js/core/normalize.js';
import { EQUIVALENCE_SETS, canonicalize } from '../app/js/core/equivalences.js';

const statuses = (r) => r.diff.map((d) => d.status);

test('normalize: case, whitespace, final punctuation, quotes', () => {
  assert.equal(normalize('  Bună   ZIUA!  '), 'bună ziua');
  assert.equal(normalize('„Mulțumesc."'), 'mulțumesc');
  assert.equal(normalize('Cât costă?'), 'cât costă');
});

test('normalize: cedilla → comma-below and hyphen variants', () => {
  assert.equal(normalize('ŞTIU, ţi-am spus'), 'știu, ți-am spus');
  assert.equal(normalize('n‑am'), 'n-am');
  assert.equal(normalize('n–am'), 'n-am');
  assert.equal(normalize('n—am'), 'n-am');
});

test('stripDiacritics', () => {
  assert.equal(stripDiacritics('ăâîșț'), 'aaist');
  assert.equal(stripDiacritics('ŞţĂÎ'), 'StAI');
});

test('tokenize keeps hyphenated clusters whole', () => {
  assert.deepEqual(tokenize('  Nu mi-e   foame. '), ['Nu', 'mi-e', 'foame.']);
  assert.deepEqual(tokenize(''), []);
});

test('tokenKey strips inner punctuation but not hyphens', () => {
  assert.equal(tokenKey('„Bună,'), 'bună');
  assert.equal(tokenKey('n-am'), 'n-am');
  assert.equal(tokenKey('—'), '');
});

test('canonicalize: spans before singles, punctuation dropped', () => {
  assert.deepEqual(canonicalize(['nu', 'am']).map((i) => i.canon), ['n-am']);
  assert.deepEqual(canonicalize(['nu', 'e']).map((i) => i.canon), ['nu-i']);
  assert.deepEqual(canonicalize(['este']).map((i) => i.canon), ['e']);
  assert.deepEqual(canonicalize(['a', '—', 'b']).map((i) => i.canon), ['a', 'b']);
  assert.deepEqual(canonicalize(['imi', 'este'], true).map((i) => i.canon), ['mi-e']);
  assert.ok(EQUIVALENCE_SETS.length > 0);
});

test('exact match', () => {
  const r = checkAnswer('Bună ziua', 'Bună ziua', []);
  assert.equal(r.result, 'correct');
  assert.deepEqual(statuses(r), ['ok', 'ok']);
  assert.deepEqual(r.extra, []);
});

test('case and whitespace', () => {
  assert.equal(checkAnswer('  bună   ZIUA ', 'Bună ziua.', []).result, 'correct');
});

test('cedilla input is accepted as correct', () => {
  assert.equal(checkAnswer('Nu ştiu', 'Nu știu', []).result, 'correct');
});

test('missing diacritics → correct-diacritics, marks those tokens', () => {
  const r = checkAnswer('Nu stiu cat costa', 'Nu știu cât costă', []);
  assert.equal(r.result, 'correct-diacritics');
  assert.deepEqual(statuses(r), ['ok', 'diacritic', 'diacritic', 'diacritic']);
});

test('n-am ↔ nu am, both directions', () => {
  assert.equal(checkAnswer('Nu am timp', "N-am timp", []).result, 'correct');
  assert.equal(checkAnswer("N-am timp", 'Nu am timp', []).result, 'correct');
  const r = checkAnswer("n-am timp", 'Nu am timp', []);
  assert.deepEqual(r.diff.map((d) => d.token), ['Nu', 'am', 'timp']);
  assert.deepEqual(statuses(r), ['ok', 'ok', 'ok']);
});

test('mi-e ↔ îmi este ↔ îmi e', () => {
  assert.equal(checkAnswer('Îmi este foame', 'Mi-e foame', []).result, 'correct');
  assert.equal(checkAnswer('Mi-e foame', 'Îmi este foame', []).result, 'correct');
  assert.equal(checkAnswer('îmi e foame', 'Îmi este foame', []).result, 'correct');
  assert.equal(checkAnswer('imi este foame', 'Mi-e foame', []).result, 'correct-diacritics');
});

test('e ↔ este and nu-i ↔ nu e', () => {
  assert.equal(checkAnswer('Aici este bine', 'Aici e bine', []).result, 'correct');
  assert.equal(checkAnswer('Nu e aici', 'Nu-i aici', []).result, 'correct');
});

test('one wrong token', () => {
  const r = checkAnswer('Bună seara', 'Bună ziua', []);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(statuses(r), ['ok', 'wrong']);
  assert.deepEqual(r.extra, []); // aligned wrong token is not "extra"
});

test('a missing token', () => {
  const r = checkAnswer('Nu stiu', 'Nu știu prea bine', []);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(statuses(r), ['ok', 'diacritic', 'missing', 'missing']);
  assert.deepEqual(r.extra, []);
});

test('an extra token', () => {
  const r = checkAnswer('Bună ziua frumoasă', 'Bună ziua', []);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(statuses(r), ['ok', 'ok']);
  assert.deepEqual(r.extra, ['frumoasă']);
});

test('punctuation differences are ignored, token text preserved', () => {
  const r = checkAnswer('Da multumesc', '„Da, mulțumesc!"', []);
  assert.equal(r.result, 'correct-diacritics');
  assert.deepEqual(r.diff.map((d) => d.token), ['„Da,', 'mulțumesc!"']);
  assert.equal(checkAnswer('da mulțumesc', '„Da, mulțumesc!"', []).result, 'correct');
});

test('accept alternative', () => {
  const r = checkAnswer('Salut', 'Bună', ['Salut', 'Hei']);
  assert.equal(r.result, 'correct');
  assert.deepEqual(r.diff.map((d) => d.token), ['Salut']);
});

test('best candidate wins for the diff', () => {
  const r = checkAnswer('Hei tu', 'Bună ziua tuturor', ['Hei toți']);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(r.diff.map((d) => d.token), ['Hei', 'toți']);
  assert.deepEqual(statuses(r), ['ok', 'wrong']);
});

test('empty input is wrong with all tokens missing', () => {
  const r = checkAnswer('', 'Bună ziua', []);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(statuses(r), ['missing', 'missing']);
});

test('typo: one edit in a long token is correct-typo, shown as typo', () => {
  const r = checkAnswer('Eu locuiesti aici', 'Eu locuiești aici', []);
  assert.equal(r.result, 'correct-diacritics', 'diacritic-only slip stays diacritics');
  const t = checkAnswer('Eu locuiestte aici', 'Eu locuiește aici', []);
  assert.equal(t.result, 'correct-typo');
  assert.deepEqual(statuses(t), ['ok', 'typo', 'ok']);
  for (const typed of ['Eu locuiestte aici', 'Eu locuiest aici', 'Eu locuiesre aici', 'Eu locuietse aici']) {
    assert.equal(checkAnswer(typed, 'Eu locuiește aici', []).result, 'correct-typo', typed);
  }
});

test('typo: two edits are wrong', () => {
  assert.equal(checkAnswer('Eu locuiest aicii', 'Eu locuiește aici', []).result, 'wrong');
  assert.equal(checkAnswer('Eu locxxeste aici', 'Eu locuiește aici', []).result, 'wrong');
});

test('typo: another form of the same lexeme is not a slip', () => {
  const avoid = ['locuiesc', 'locuiești', 'locuiește', 'locuim', 'locuiți', 'locuiesc'];
  assert.equal(checkAnswer('Ea locuiesc acasă', 'Ea locuiește acasă', [], { avoid }).result, 'wrong');
  assert.equal(checkAnswer('Ea locuiesc acasă', 'Ea locuiește acasă', []).result, 'wrong', '2 edits anyway');
  // a one-edit neighbour that is a real other form
  assert.equal(checkAnswer('Ei locuiti acum', 'Ei locuiți acum', []).result, 'correct-diacritics');
  assert.equal(checkAnswer('Vedeti casele', 'Vedeți casa', [], { avoid: ['casele'] }).result, 'wrong');
  assert.equal(checkAnswer('Am casae', 'Am case', [], { avoid: [] }).result, 'wrong', 'short token: no tolerance');
});

test('typo: short tokens are never tolerated', () => {
  assert.equal(checkAnswer('Am pern', 'Am parc', []).result, 'wrong');
  assert.equal(checkAnswer('Eu sut', 'Eu sunt', []).result, 'wrong', 'four letters');
  assert.equal(checkAnswer('Vei veni', 'Vei vini', []).result, 'wrong');
});

test('typo: an avoided adjacent form inside a long token', () => {
  assert.equal(checkAnswer('Avem timpp', 'Avem timp', []).result, 'wrong', 'expected is short');
  assert.equal(checkAnswer('Avem problemee', 'Avem probleme', []).result, 'correct-typo');
  assert.equal(checkAnswer('Avem problemee', 'Avem probleme', [], { avoid: ['problemee'] }).result, 'wrong');
});
