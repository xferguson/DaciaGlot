#!/usr/bin/env node
// Content integrity validator (CONTENT_GUIDE §4). Usage:
//   node scripts/validate-content.mjs [--content <dir>] [--phase <n>] [--coverage] [--strict-a1]
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packPaths } from "../app/js/data/content.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const SITUATIONS = ["standup", "decisions", "coaching", "domain", "table", "me", "getting-to-know", "news", "meta"];
export const REGISTERS = ["colloquial", "neutral", "formal", "written"];
const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
const TENSES = ["pres", "perf", "fut", "cond", "impf"];
const ACC = ["acc-3sg-m", "acc-3sg-f", "acc-3pl-m", "acc-3pl-f", "acc-1sg", "acc-2sg", "acc-1pl", "acc-2pl"];
const DAT = ACC.map((p) => p.replace("acc-", "dat-"));
const SIMPLE_OPS = ["negate", "affirm", "question", "plural", "singular", "definite", "indefinite", "formal"];

export function isValidOp(op) {
  if (SIMPLE_OPS.includes(op)) return true;
  const [name, arg] = String(op).split(/:(.*)/s);
  if (arg === undefined) return false;
  if (name === "person" || name === "tense") {
    const m = arg.match(/^([a-z0-9]+)>([a-z0-9]+)$/);
    const set = name === "person" ? PERSONS : TENSES;
    return !!m && set.includes(m[1]) && set.includes(m[2]);
  }
  if (name === "add-obj") return ACC.includes(arg);
  if (name === "add-dat") return DAT.includes(arg);
  if (name === "modal") return ["vrea", "putea", "trebui"].includes(arg);
  return false;
}

/** Lowercase and keep letters only, so punctuation, hyphens and spaces never block a substring match. */
const squash = (s) => String(s).normalize("NFC").toLowerCase().replace(/[^\p{L}]/gu, "");

/** Form values may carry a lemma/subjunctive prefix that is not part of the token itself. */
function formCandidates(value) {
  const out = [squash(value)];
  const stripped = String(value).replace(/^(a|să) /, "");
  if (stripped !== value) out.push(squash(stripped));
  return out;
}

/**
 * Run every rule over parsed content.
 * @param {{manifest: object, patterns: object[], lexemes: object[], sentences: object[], levels: object[]}} raw
 * @param {{fileOf?: Map<object,string>, phase?: number}} [opts]
 * @returns {{errors: object[], warnings: object[]}} entries are `{file, id, rule?, message}`
 */
export function validateContent(raw, { fileOf = new Map(), phase = 1 } = {}) {
  const errors = [];
  const warnings = [];
  const fileFor = (item, fallback) => fileOf.get(item) ?? fallback;
  const err = (item, fallback, rule, message) => errors.push({ file: fileFor(item, fallback), id: item?.id ?? "-", rule, message });
  const warn = (item, fallback, message) => warnings.push({ file: fileFor(item, fallback), id: item?.id ?? "-", message });

  const { manifest, patterns, lexemes, sentences, levels } = raw;
  const lexById = new Map(lexemes.map((l) => [l.id, l]));
  const patById = new Map(patterns.map((p) => [p.id, p]));
  const manifestLevels = new Set(manifest.levels ?? []);
  const canDoIds = new Set(levels.flatMap((lv) => (lv.canDos ?? []).map((c) => c.id)));

  // Rule 1 — duplicate ids per type
  const dupes = (items, type, fallback) => {
    const seen = new Set();
    for (const it of items) {
      if (seen.has(it.id)) err(it, fallback, 1, `duplicate ${type} id "${it.id}"`);
      seen.add(it.id);
    }
  };
  dupes(patterns, "pattern", "patterns.json");
  dupes(lexemes, "lexeme", "lexemes");
  dupes(sentences, "sentence", "sentences");
  dupes(levels, "level", "levels");
  dupes(levels.flatMap((lv) => lv.canDos ?? []), "can-do", "levels");

  // Rule 6 — requires: known, same-or-lower stage, acyclic
  for (const p of patterns) {
    for (const r of p.requires ?? []) {
      const dep = patById.get(r);
      if (!dep) err(p, "patterns.json", 6, `requires unknown pattern "${r}"`);
      else if (dep.stage > p.stage) err(p, "patterns.json", 6, `requires "${r}" from a higher stage (${dep.stage} > ${p.stage})`);
    }
  }
  const state = new Map(); // 1 = visiting, 2 = done
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const p = patById.get(id);
      err(p, "patterns.json", 6, `requires cycle: ${[...path.slice(path.indexOf(id)), id].join(" → ")}`);
      return;
    }
    state.set(id, 1);
    for (const r of patById.get(id)?.requires ?? []) if (patById.has(r)) visit(r, [...path, id]);
    state.set(id, 2);
  };
  for (const p of patterns) visit(p.id, []);

  // Per-sentence rules
  const usedLexemes = new Set();
  for (const s of sentences) {
    const f = "sentences";
    const tokens = s.tokens ?? [];

    // Rule 3
    const joined = tokens.map((t) => t.t).join(" ");
    if (joined !== s.ro) err(s, f, 3, `tokens joined "${joined}" ≠ ro "${s.ro}"`);

    // Rules 2 and 4
    const squashedRo = squash(s.ro);
    tokens.forEach((tok, i) => {
      const multi = (tok.units ?? []).length > 1;
      for (const unit of tok.units ?? []) {
        const lex = lexById.get(unit.lex);
        if (!lex) {
          err(s, f, 2, `token ${i} "${tok.t}": unknown lexeme "${unit.lex}"`);
          continue;
        }
        usedLexemes.add(lex.id);
        const value = lex.forms?.[unit.form] ?? (unit.form === "base" ? lex.lemma : undefined);
        if (value === undefined) {
          err(s, f, 2, `token ${i} "${tok.t}": lexeme "${lex.id}" has no form "${unit.form}"`);
          continue;
        }
        const haystack = lex.pos === "phrase" ? squashedRo : squash(tok.t);
        if (!formCandidates(value).some((c) => haystack.includes(c))) {
          err(s, f, 4, `token ${i} "${tok.t}": form "${value}" (${lex.id}.${unit.form}) not found in ${lex.pos === "phrase" ? "sentence" : multi ? "token (cluster)" : "token"}`);
        }
      }
    });

    // Rule 5
    const heads = new Map();
    for (const tok of tokens) {
      for (const unit of tok.units ?? []) {
        if (unit.pattern && !(s.patterns ?? []).includes(unit.pattern)) {
          err(s, f, 5, `token "${tok.t}": unit pattern "${unit.pattern}" is not listed in patterns[]`);
        }
        if (unit.pattern && unit.head) heads.set(unit.pattern, (heads.get(unit.pattern) ?? 0) + 1);
      }
    }
    for (const p of s.patterns ?? []) {
      if (!patById.has(p)) err(s, f, 5, `unknown pattern "${p}"`);
      else if ((heads.get(p) ?? 0) !== 1) err(s, f, 5, `pattern "${p}" needs exactly one head unit, found ${heads.get(p) ?? 0}`);
    }

    // Rule 7
    const maxStage = Math.max(0, ...(s.patterns ?? []).map((p) => patById.get(p)?.stage ?? 0));
    if (s.stage < maxStage) err(s, f, 7, `stage ${s.stage} is below its patterns' max stage ${maxStage}`);

    // Rule 9
    if (!REGISTERS.includes(s.register)) err(s, f, 9, `register "${s.register}" not in ${REGISTERS.join("|")}`);
    for (const sit of s.situations ?? []) {
      if (!SITUATIONS.includes(sit)) err(s, f, 9, `situation "${sit}" not allowed`);
    }
    for (const t of s.transforms ?? []) {
      if (!isValidOp(t.op)) err(s, f, 9, `transform op "${t.op}" is not in the vocabulary`);
    }

    // Rule 10
    if (!manifestLevels.has(s.level)) err(s, f, 10, `level "${s.level}" is not in the manifest`);
    for (const c of s.canDo ?? []) {
      if (!canDoIds.has(c)) err(s, f, 10, `canDo "${c}" is unknown`);
    }

    // Warnings
    if (!tokens.some((t) => t.cloze)) warn(s, f, "no cloze token");
    if (phase >= 2 && !(s.transforms ?? []).length) warn(s, f, "no transforms");
    for (const t of s.transforms ?? []) {
      if (String(t.op).startsWith("person:") && !t.en) warn(s, f, `transform ${t.op} has no en`);
    }
  }

  // Rule 10 — pattern/level references in other files
  for (const p of patterns) {
    if (p.level && !manifestLevels.has(p.level)) err(p, "patterns.json", 10, `level "${p.level}" is not in the manifest`);
  }

  // Rule 8 — cedilla and ã anywhere in content
  const bad = /[şţŞŢã]/u;
  const scan = (item, fallback, value, path) => {
    if (typeof value === "string") {
      const m = value.match(bad);
      if (m) err(item, fallback, 8, `forbidden character "${m[0]}" at ${path} ("${value}")`);
    } else if (Array.isArray(value)) value.forEach((v, i) => scan(item, fallback, v, `${path}[${i}]`));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) scan(item, fallback, v, `${path}.${k}`);
  };
  scan(manifest, "manifest.json", manifest, "manifest");
  for (const [items, fallback] of [[patterns, "patterns.json"], [lexemes, "lexemes"], [sentences, "sentences"], [levels, "levels"]]) {
    for (const item of items) scan(item, fallback, item, "$");
  }

  // Warning: lexemes never used by any sentence
  for (const l of lexemes) {
    if (!l.retired && !usedLexemes.has(l.id)) warn(l, "lexemes", "lexeme is not used by any sentence");
  }

  return { errors, warnings };
}

export const TARGETS = { patternSentences: 10, patternHeads: 6, canDoSentences: 5, situationSentences: 10, lexemeSentences: 2 };
/** Patterns whose head can only ever be one lexeme (T09), so the head-lexeme target does not apply. */
const SINGLE_HEAD_PATTERNS = new Set(["be-pres", "have-pres", "neg-nu"]);

/**
 * Coverage statistics (CONTENT_GUIDE §4). Rows carry `low: true` when below target.
 * @param {{patterns: object[], lexemes: object[], sentences: object[], levels: object[]}} raw
 */
export function computeCoverage({ patterns, lexemes, sentences, levels }) {
  const patRows = patterns.map((p) => ({ id: p.id, sentences: 0, heads: new Set(), glueCloze: 0 }));
  const patRow = new Map(patRows.map((r) => [r.id, r]));
  const sitRows = new Map(SITUATIONS.map((id) => [id, { id, sentences: 0 }]));
  const canDos = levels.flatMap((lv) => (lv.canDos ?? []).map((c) => ({ ...c, level: lv.id })));
  const cdRows = new Map(canDos.map((c) => [c.id, { id: c.id, level: c.level, sentences: 0 }]));
  const lexCount = new Map(lexemes.map((l) => [l.id, new Set()]));

  for (const s of sentences) {
    for (const p of s.patterns ?? []) if (patRow.has(p)) patRow.get(p).sentences++;
    for (const sit of s.situations ?? []) if (sitRows.has(sit)) sitRows.get(sit).sentences++;
    for (const c of s.canDo ?? []) if (cdRows.has(c)) cdRows.get(c).sentences++;
    for (const tok of s.tokens ?? []) {
      for (const u of tok.units ?? []) {
        lexCount.get(u.lex)?.add(s.id);
        const row = u.pattern && patRow.get(u.pattern);
        if (!row) continue;
        if (u.head) row.heads.add(u.lex);
        if (tok.glue && tok.cloze) row.glueCloze++;
      }
    }
  }
  const patternsOut = patRows.map((r) => ({
    id: r.id, sentences: r.sentences, heads: r.heads.size, glueCloze: r.glueCloze,
    low: r.sentences < TARGETS.patternSentences || (!SINGLE_HEAD_PATTERNS.has(r.id) && r.heads.size < TARGETS.patternHeads),
  }));
  const situations = [...sitRows.values()].map((r) => ({ ...r, low: r.sentences < TARGETS.situationSentences }));
  const canDosOut = [...cdRows.values()].map((r) => ({ ...r, low: r.sentences < TARGETS.canDoSentences }));
  const thinLexemes = lexemes
    .filter((l) => !l.retired && lexCount.get(l.id).size < TARGETS.lexemeSentences)
    .map((l) => ({ id: l.id, sentences: lexCount.get(l.id).size }));
  return { patterns: patternsOut, situations, canDos: canDosOut, thinLexemes };
}

/** Render the coverage statistics as Markdown tables; below-target rows are marked ⚠. */
export function coverageReport(raw) {
  const cov = computeCoverage(raw);
  const mark = (r) => (r.low ? "⚠ " : "");
  const table = (title, head, rows) => [`### ${title}`, "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`), ""].join("\n");
  return [
    "## Content coverage",
    "",
    table("Patterns", ["Pattern", "Sentences", "Head lexemes", "Glue clozes"], cov.patterns.map((r) => [mark(r) + r.id, r.sentences, r.heads, r.glueCloze])),
    table("Situations", ["Situation", "Sentences"], cov.situations.map((r) => [mark(r) + r.id, r.sentences])),
    table("Can-dos", ["Can-do", "Level", "Sentences"], cov.canDos.map((r) => [mark(r) + r.id, r.level, r.sentences])),
    cov.thinLexemes.length
      ? table(`Lexemes with < ${TARGETS.lexemeSentences} sentences (key-forms would never unlock)`, ["Lexeme", "Sentences"], cov.thinLexemes.map((r) => ["⚠ " + r.id, r.sentences]))
      : `### Lexemes with < ${TARGETS.lexemeSentences} sentences\n\nNone.\n`,
    `Targets: pattern ≥ ${TARGETS.patternSentences} sentences and ≥ ${TARGETS.patternHeads} head lexemes (not ${[...SINGLE_HEAD_PATTERNS].join(", ")}); situation ≥ ${TARGETS.situationSentences}; can-do ≥ ${TARGETS.canDoSentences}.`,
    "",
  ].join("\n");
}

/** `--strict-a1`: messages for A1 can-dos and required patterns that are below target. */
export function strictA1Failures(raw) {
  const cov = computeCoverage(raw);
  const a1 = raw.levels.find((lv) => lv.id === "A1");
  if (!a1) return ["no A1 level in the manifest"];
  const out = [];
  for (const c of cov.canDos) if (c.level === "A1" && c.sentences < TARGETS.canDoSentences) out.push(`can-do ${c.id}: ${c.sentences} sentence(s), need ≥ ${TARGETS.canDoSentences}`);
  const byId = new Map(cov.patterns.map((p) => [p.id, p]));
  for (const id of a1.requiredPatterns ?? []) {
    const p = byId.get(id);
    if (!p) out.push(`pattern ${id}: unknown`);
    else if (p.low) out.push(`pattern ${id}: ${p.sentences} sentence(s), ${p.heads} head lexeme(s), below target`);
  }
  return out;
}

/** Rule 11 — every file under app/js, app/css and app/icons appears in the sw.js precache list. */
export function checkPrecache(appDir) {
  const swPath = join(appDir, "sw.js");
  if (!existsSync(swPath)) return { skipped: true, errors: [] };
  const sw = readFileSync(swPath, "utf8");
  const errors = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const rel = relative(appDir, full).split("\\").join("/");
        if (!sw.includes(rel)) errors.push({ file: "app/sw.js", id: rel, rule: 11, message: `"${rel}" is missing from the precache list` });
      }
    }
  };
  walk(join(appDir, "js"));
  walk(join(appDir, "css"));
  walk(join(appDir, "icons"));
  const ver = /APP_VERSION\s*=\s*"([^"]+)"/;
  const swVer = sw.match(ver)?.[1];
  const appVer = existsSync(join(appDir, "js/version.js")) ? readFileSync(join(appDir, "js/version.js"), "utf8").match(ver)?.[1] : null;
  if (appVer && swVer !== appVer) errors.push({ file: "app/sw.js", id: "APP_VERSION", rule: 11, message: `sw.js APP_VERSION "${swVer}" does not match js/version.js "${appVer}"` });
  return { skipped: false, errors };
}

/** Read a content directory from disk, remembering which file each item came from. */
export function readContentDir(dir) {
  const fileOf = new Map();
  const read = (rel) => {
    const path = join(dir, rel);
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      throw new Error(`${rel}: ${e.message}`);
    }
  };
  const tag = (items, rel) => {
    for (const it of items) fileOf.set(it, rel);
    return items;
  };
  const manifest = read("manifest.json");
  const paths = packPaths(manifest);
  const raw = {
    manifest,
    patterns: tag(read("patterns.json"), "patterns.json"),
    lexemes: paths.lexemes.flatMap((p) => tag(read(p), p)),
    sentences: paths.sentences.flatMap((p) => tag(read(p), p)),
    levels: paths.levels.map((p) => tag([read(p)], p)[0]),
  };
  return { raw, fileOf };
}

function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const contentDir = resolve(arg("--content") ?? join(ROOT, "app/content"));
  const phase = Number(arg("--phase") ?? 1);
  let loaded;
  try {
    loaded = readContentDir(contentDir);
  } catch (e) {
    console.error(`error: ${e.message}`);
    return 1;
  }
  const { errors, warnings } = validateContent(loaded.raw, { fileOf: loaded.fileOf, phase });

  if (!arg("--content")) {
    const pre = checkPrecache(join(ROOT, "app"));
    if (pre.skipped) console.log("notice: app/sw.js does not exist yet; skipping rule 11 (precache)");
    errors.push(...pre.errors);
  }
  if (argv.includes("--coverage")) console.log(coverageReport(loaded.raw));
  if (argv.includes("--strict-a1")) {
    for (const m of strictA1Failures(loaded.raw)) errors.push({ file: "levels/A1.json", id: "strict-a1", rule: "strict-a1", message: m });
  }

  for (const w of warnings) console.log(`warning: ${w.file}:${w.id}: ${w.message}`);
  for (const e of errors) console.error(`error: ${e.file}:${e.id}: [rule ${e.rule}] ${e.message}`);
  const { sentences, lexemes, patterns } = loaded.raw;
  console.log(`${errors.length} error(s), ${warnings.length} warning(s) — ${sentences.length} sentences, ${lexemes.length} lexemes, ${patterns.length} patterns`);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
