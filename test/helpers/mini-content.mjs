import { indexContent } from "../../app/js/data/content.js";
import { defaultState } from "../../app/js/data/store.js";

export const NOW = Date.UTC(2026, 0, 10, 12);

export function sentence(id, ro, units, extra = {}) {
  return {
    id, ro, en: ro, level: "A1", stage: 1, situations: ["x"], patterns: [], register: "neutral",
    tokens: ro.split(" ").map((t, i) => ({ t, units: [units[i]], cloze: i === 0 || undefined })),
    ...extra,
  };
}

export function makeContent(sentences, lexemes = [], patterns = []) {
  return indexContent({ manifest: { contentVersion: "t" }, patterns, lexemes, sentences, levels: [] });
}

export const state = () => defaultState(NOW);
