import test from 'node:test';
import assert from 'node:assert/strict';
import { issueUrl, flagsMarkdown, MAX_URL } from '../app/js/ui/components/flag-button.js';

const sentence = { ro: 'Bună dimineața, ce mai faci?', en: 'Good morning, how are you?' };
const flag = { sentenceId: 'st-001', note: 'He said "ce faci" instead', ts: Date.UTC(2026, 0, 2) };

test('issueUrl: title, label, repo', () => {
  const u = new URL(issueUrl(flag, sentence, 'v7'));
  assert.equal(u.origin + u.pathname, 'https://github.com/xferguson/DaciaGlot/issues/new');
  assert.equal(u.searchParams.get('title'), 'Content flag: st-001');
  assert.equal(u.searchParams.get('labels'), 'content-flag');
});

test('issueUrl: diacritics and quotes survive a round trip, raw URL is ASCII', () => {
  const raw = issueUrl(flag, sentence, 'v7');
  assert.match(raw, /^[\x21-\x7e]+$/);
  const body = new URL(raw).searchParams.get('body');
  assert.ok(body.includes('Bună dimineața, ce mai faci?'));
  assert.ok(body.includes('He said "ce faci" instead'));
  assert.ok(body.includes('v7'));
  assert.ok(body.includes('Good morning, how are you?'));
});

test('issueUrl: length cap truncates the note', () => {
  const long = { ...flag, note: 'ș'.repeat(5000) };
  const raw = issueUrl(long, sentence, 'v7');
  assert.ok(raw.length < MAX_URL);
  assert.ok(new URL(raw).searchParams.get('body').includes('Bună dimineața'));
});

test('issueUrl: missing sentence and empty note still work', () => {
  const raw = issueUrl({ ...flag, note: '' }, undefined);
  assert.ok(new URL(raw).searchParams.get('body').includes('(none)'));
});

test('flagsMarkdown lists each flag', () => {
  const content = { sentences: new Map([['st-001', sentence]]) };
  const md = flagsMarkdown([flag, { sentenceId: 'gone', note: '', ts: 0 }], content);
  const lines = md.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('2026-01-02') && lines[0].includes('Bună dimineața'));
  assert.ok(lines[1].includes('not found'));
});
