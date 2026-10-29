// Content loader. `indexContent` is pure so Node tests and the validator can use it without fetch.

/**
 * Paths (relative to the content root) of every file a manifest lists.
 * @param {{packs?: {lexemes?: string[], sentences?: string[]}, levels?: string[]}} manifest
 */
export function packPaths(manifest) {
  return {
    lexemes: manifest.packs?.lexemes ?? [],
    sentences: manifest.packs?.sentences ?? [],
    levels: (manifest.levels ?? []).map((id) => `levels/${id}.json`),
  };
}

function pushTo(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Build the in-memory Content from already-parsed JSON (ARCHITECTURE §2).
 * Retired sentences are dropped. Retired lexemes, patterns and levels stay, so ids in saved state still resolve.
 * @param {{manifest: object, patterns: object[], lexemes: object[], sentences: object[], levels: object[]}} raw
 */
export function indexContent(raw) {
  const sentences = new Map();
  const sentencesByPattern = new Map();
  const sentencesBySituation = new Map();
  const sentencesByLexeme = new Map();

  for (const s of raw.sentences) {
    if (s.retired) continue;
    sentences.set(s.id, s);
    for (const p of s.patterns ?? []) pushTo(sentencesByPattern, p, s.id);
    for (const sit of s.situations ?? []) pushTo(sentencesBySituation, sit, s.id);
    const seen = new Set();
    for (const tok of s.tokens ?? []) {
      for (const unit of tok.units ?? []) {
        if (seen.has(unit.lex)) continue;
        seen.add(unit.lex);
        pushTo(sentencesByLexeme, unit.lex, s.id);
      }
    }
  }

  return {
    contentVersion: raw.manifest.contentVersion,
    sentences,
    lexemes: new Map(raw.lexemes.map((l) => [l.id, l])),
    patterns: new Map(raw.patterns.map((p) => [p.id, p])),
    levels: new Map(raw.levels.map((l) => [l.id, l])),
    sentencesByPattern,
    sentencesBySituation,
    sentencesByLexeme,
  };
}

/** Fetch the manifest, then every listed pack in parallel, and index them. */
export async function loadContent(baseUrl = "./content/") {
  const getJson = async (path) => {
    const res = await fetch(baseUrl + path);
    if (!res.ok) throw new Error(`content: ${path} → HTTP ${res.status}`);
    return res.json();
  };
  const manifest = await getJson("manifest.json");
  const paths = packPaths(manifest);
  const [patterns, lexemePacks, sentencePacks, levels] = await Promise.all([
    getJson("patterns.json"),
    Promise.all(paths.lexemes.map(getJson)),
    Promise.all(paths.sentences.map(getJson)),
    Promise.all(paths.levels.map(getJson)),
  ]);
  return indexContent({
    manifest,
    patterns,
    lexemes: lexemePacks.flat(),
    sentences: sentencePacks.flat(),
    levels,
  });
}
