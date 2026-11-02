// Lexeme-form unit ids `<lex>.<form>` (ARCHITECTURE §6.1). Pure leaf module: `units.js` re-exports it,
// and `cards.js` imports it from here so the two never form an import cycle.

/** `{lex, form}` → `<lex>.<form>`. */
export const unitId = (u) => `${u.lex}.${u.form}`;

/** `<lex>.<form>` → `{lex, form}`. The lexeme id never contains a dot; the form key may. */
export function parseUnitId(id) {
  const s = String(id);
  const dot = s.indexOf(".");
  if (dot < 0) throw new Error(`Bad unit id: ${id}`);
  return { lex: s.slice(0, dot), form: s.slice(dot + 1) };
}

/** True for a pattern unit `pat:<id>` (as opposed to a lexeme-form unit). */
export const isPatternUnit = (id) => String(id).startsWith("pat:");
