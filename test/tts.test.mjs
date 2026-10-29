import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVoice, splitText, init, speak } from "../app/js/data/tts.js";

const v = (voiceURI, lang) => ({ voiceURI, lang, name: voiceURI });
const voices = [v("en", "en-US"), v("md", "ro-MD"), v("ro", "ro-RO"), v("de", "de-DE")];

test("pickVoice prefers saved URI when present", () => {
  assert.equal(pickVoice(voices, "md").voiceURI, "md");
  assert.equal(pickVoice(voices, "de").voiceURI, "de");
});

test("pickVoice ignores a missing saved URI", () => {
  assert.equal(pickVoice(voices, "gone").voiceURI, "ro");
});

test("pickVoice prefers ro-RO over other ro*", () => {
  assert.equal(pickVoice(voices, null).voiceURI, "ro");
  assert.equal(pickVoice([v("a", "ro_RO")], null).voiceURI, "a");
});

test("pickVoice falls back to ro-MD", () => {
  assert.equal(pickVoice([v("en", "en-US"), v("md", "ro-MD")], null).voiceURI, "md");
});

test("pickVoice returns null when no Romanian voice", () => {
  assert.equal(pickVoice([v("en", "en-US"), v("rom", "rom-XX")], null), null);
  assert.equal(pickVoice([], null), null);
});

test("splitText keeps short text whole and splits long text at punctuation", () => {
  assert.deepEqual(splitText("Bună dimineața, ce mai faci?"), ["Bună dimineața, ce mai faci?"]);
  const long = "Aceasta este o propoziție lungă, ".repeat(15) + "gata.";
  const parts = splitText(long);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 200));
  assert.equal(parts.join(" ").replace(/\s+/g, " "), long.trim().replace(/\s+/g, " "));
});

test("splitText hard-cuts text with no spaces", () => {
  assert.ok(splitText("a".repeat(450)).every((p) => p.length <= 200));
});

test("init and speak degrade gracefully without speechSynthesis", async () => {
  assert.deepEqual(await init(), { available: false, voices: [] });
  await speak("Bună");
});
