// Q11: golden test. `buildSession` output for every mode on the real content and a fixed seed, recorded before
// `core/session.js` was split. Regenerate only for an intended behavior change: UPDATE_GOLDEN=1 node --test test/session-golden.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexContent } from "../app/js/data/content.js";
import { readContentDir } from "../scripts/validate-content.mjs";
import { defaultState } from "../app/js/data/store.js";
import { newCard } from "../app/js/core/fsrs.js";
import { unitId } from "../app/js/core/unit-id.js";
import { fmIdForUnit, buildCardId } from "../app/js/core/cards.js";
import { buildSession } from "../app/js/core/session.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "fixtures/session-golden.json");
const { raw } = readContentDir(join(HERE, "../app/content"));
const content = indexContent(raw);
const NOW = Date.UTC(2026, 0, 10, 12);
const DAY = 86400000;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A profile that has met the first 45 sentences: `lr` cards at mixed ages, `fm` cards for their forms, a few claims. */
function seasoned() {
  const st = defaultState(NOW);
  const ids = [...content.sentences.keys()].slice(0, 45);
  ids.forEach((sid, i) => {
    st.seenSentences[sid] = NOW - (50 - i) * DAY;
    st.cards[buildCardId("lr", sid)] = { ...newCard(NOW), lastReview: NOW - 6 * DAY, due: NOW + (i % 5 - 3) * DAY, lastGrade: 3 };
    for (const t of content.sentences.get(sid).tokens) {
      for (const u of t.units) {
        st.attempts.push({ u: unitId(u), lx: u.lex, c: i % 7 === 0 ? 0 : 1, t: NOW - (45 - i) * DAY, card: `cz:${sid}:0` });
        const id = fmIdForUnit(unitId(u));
        if (!(id in st.cards)) {
          const gap = [1, 1, 4, 16][i % 4];
          st.cards[id] = { ...newCard(NOW), lastReview: NOW - gap * DAY - 1000, due: NOW + ((i % 3) - 2) * 3600e3, lastGrade: i % 4 === 3 ? 4 : 3 };
        }
      }
    }
  });
  const claim = Object.keys(st.cards).find((k) => k.startsWith("fm:"));
  st.claimed[claim.slice(3).replace(":", ".")] = NOW;
  return st;
}

const MODES = ["quick", "review", "learn", "mix", "session"];
const FOCI = [null, { type: "situation", id: "standup" }];

function run() {
  const out = {};
  for (const [label, mk] of [["new", () => defaultState(NOW)], ["seasoned", seasoned]]) {
    for (const mode of MODES) {
      for (const focus of FOCI) {
        const key = `${label}/${mode}/${focus ? focus.id : "all"}`;
        out[key] = buildSession({ mode, focus, state: mk(), content, now: NOW, rng: mulberry32(7) });
      }
    }
  }
  return JSON.parse(JSON.stringify(out));
}

test("buildSession golden: every mode, with and without a focus, new and seasoned profile", () => {
  const got = run();
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + "\n");
  const want = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(Object.keys(got), Object.keys(want));
  for (const k of Object.keys(want)) assert.deepEqual(got[k], want[k], k);
});

test("golden fixtures are not trivially empty", () => {
  const got = run();
  const sizes = Object.entries(got).map(([k, v]) => [k, v.queue.length]);
  assert.ok(got["seasoned/quick/all"].queue.length > 5);
  assert.ok(got["seasoned/learn/all"].queue.some((q) => q.isNew));
  assert.ok(got["seasoned/mix/all"].queue.some((q) => !q.isNew) && got["seasoned/mix/all"].queue.some((q) => q.isNew), JSON.stringify(sizes));
  assert.ok(got["new/learn/all"].queue.length > 5);
});
