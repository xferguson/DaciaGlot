import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, html, raw, el } from "../app/js/ui/dom.js";
import { renderCanDos } from "../app/js/ui/views/cando.js";
import { renderSummary } from "../app/js/ui/views/summary.js";
import { FakeEl, installFakeDom } from "./helpers/fake-dom.mjs";

// ---- esc ----

test("esc escapes & < > \" ' and maps null/undefined to empty", () => {
  assert.equal(esc(`a&b<c>d"e'f`), "a&amp;b&lt;c&gt;d&quot;e&#39;f");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  assert.equal(esc(false), "false");
  assert.equal(esc("ș ț ă î â"), "ș ț ă î â");
});

test("esc('\"><img>') is inert inside an attribute", () => {
  const payload = `"><img src=x onerror=alert(1)>`;
  for (const q of [`"`, `'`]) {
    const markup = `<a title=${q}${esc(payload)}${q}>x</a>`;
    // The attribute value has no quote that could close it and no tag opener.
    const value = markup.slice(`<a title=${q}`.length, markup.indexOf(`${q}>x</a>`));
    assert.ok(!/["'<>]/.test(value), `value ${value} must not contain quotes or angle brackets`);
    assert.equal(markup.match(/</g).length, 2, "only the <a> and </a> tags remain");
  }
});

// ---- html / raw ----

test("html escapes every interpolation", () => {
  const v = `<b class="x">'&'</b>`;
  assert.equal(String(html`<p title="${v}">${v}</p>`),
    `<p title="&lt;b class=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;">&lt;b class=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;</p>`);
});

test("html leaves raw() and nested html values alone, joins arrays, drops null/undefined", () => {
  const inner = html`<em>${"a<b"}</em>`;
  assert.equal(String(html`<p>${inner}${raw("<br>")}${null}${undefined}${0}</p>`), "<p><em>a&lt;b</em><br>0</p>");
  assert.equal(String(html`<ul>${["<x>", "y"].map((s) => html`<li>${s}</li>`)}</ul>`), "<ul><li>&lt;x&gt;</li><li>y</li></ul>");
  assert.equal(String(html`${["<a>", raw("<b>")]}`), "&lt;a&gt;<b>");
  assert.equal(String(raw(null)), "");
});

test("html result coerces to a string (as innerHTML does)", () => {
  const out = html`<i>${1}</i>`;
  assert.equal(`${out}`, "<i>1</i>");
  assert.equal(out + "", "<i>1</i>");
});

// ---- el ----

test("el creates an element, assigns props and appends children", () => {
  installFakeDom();
  const child = el("span", { textContent: "hi" });
  const p = el("p", { className: "muted", lang: "ro" }, child);
  assert.equal(p.tag, "p");
  assert.equal(p.className, "muted");
  assert.equal(p.lang, "ro");
  assert.deepEqual(p.children, [child]);
  const bare = el("div");
  assert.equal(bare.tag, "div");
  assert.deepEqual(bare.children, []);
});

// ---- characterization: the markup the views write (pinned before the switch to html``) ----

test("cando: checklist markup, escaped text, checkbox vs progress", () => {
  const root = { innerHTML: "", querySelectorAll: () => [] };
  const ctx = {
    state: { canDoChecked: { a: 1 } },
    content: {
      sentences: new Map(),
      levels: new Map([["A1", { canDos: [
        { id: "a", situation: "standup", text: `Say "hi" & <wave>` },
        { id: "b", situation: "odd<sit>", text: "Plain" },
      ] }]]),
    },
  };
  renderCanDos(root, ctx, "A1", { now: 0 });
  assert.equal(String(root.innerHTML),
    `<section class="card" aria-label="Can-do checklist"><h2>Can-do checklist</h2>`
    + `<h3>Stand-up</h3><ul class="plain"><li><label class="check"><input type="checkbox" data-id="a" checked><span>Say &quot;hi&quot; &amp; &lt;wave&gt;</span></label></li></ul>`
    + `<h3>odd&lt;sit&gt;</h3><ul class="plain"><li><label class="check"><span class="muted">0 / 0 sentences mastered</span><span>Plain</span></label></li></ul>`
    + `</section>`);
});

test("cando: unknown level renders an empty checklist", () => {
  const root = { innerHTML: "", querySelectorAll: () => [] };
  renderCanDos(root, { state: { canDoChecked: {} }, content: { levels: new Map(), sentences: new Map() } }, "A1", { now: 0 });
  assert.equal(String(root.innerHTML), `<section class="card" aria-label="Can-do checklist"><h2>Can-do checklist</h2></section>`);
});

function summaryRoot() {
  installFakeDom();
  const nodes = new Map();
  return {
    nodes,
    innerHTML: "",
    querySelector(sel) {
      if (!nodes.has(sel)) nodes.set(sel, new FakeEl(sel));
      return nodes.get(sel);
    },
  };
}
const baseSummary = { cards: 3, correct: 2, newSentences: 1, forms: 1, difficult: 0, changes: [], target: 15 };

test("summary: pace block markup escapes the pattern name", () => {
  const root = summaryRoot();
  const content = { patterns: new Map([["p1", { name: "a<b> & c" }]]) };
  const pace = { newForms: 4, newSentences: 2, newPatterns: ["p1"], perTen: 7.25 };
  renderSummary(root, { summary: { ...baseSummary, pace }, content, onMore() {} });
  const box = root.nodes.get("[data-pace]");
  assert.equal(box.hidden, undefined);
  assert.deepEqual(box.children.map((p) => String(p.innerHTML)), [
    "New this session: <strong>4</strong> words · <strong>2</strong> sentences · first <em>a&lt;b&gt; &amp; c</em>",
    "<strong>7.3</strong> per 10 min (target 15)",
  ]);
});

test("summary: pace block without a first pattern, review session, and no pace", () => {
  let root = summaryRoot();
  renderSummary(root, { summary: { ...baseSummary, pace: { newForms: 1, newSentences: 0, newPatterns: [], perTen: 3 } }, content: { patterns: new Map() }, onMore() {} });
  assert.deepEqual(root.nodes.get("[data-pace]").children.map((p) => String(p.innerHTML)), [
    "New this session: <strong>1</strong> words · <strong>0</strong> sentences",
    "<strong>3</strong> per 10 min (target 15)",
  ]);
  root = summaryRoot();
  renderSummary(root, { summary: { ...baseSummary, pace: { newForms: 0, newSentences: 0, newPatterns: [], perTen: 0 } }, content: { patterns: new Map() }, onMore() {} });
  assert.deepEqual(root.nodes.get("[data-pace]").children.map((p) => String(p.innerHTML)), ["<strong>Review session</strong>: nothing new this time."]);
  root = summaryRoot();
  renderSummary(root, { summary: { ...baseSummary, pace: null }, content: { patterns: new Map() }, onMore() {} });
  assert.equal(root.nodes.get("[data-pace]").hidden, true);
});
