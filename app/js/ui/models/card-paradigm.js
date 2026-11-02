import { differingToken } from "../../core/families.js";
import { labelFor } from "../../core/cards.js";
import { parseUnitId } from "../../core/unit-id.js";

/** Pure: one row per member: `{id, ro, en, token, label}` (`token`/`label` are null when no word differs). */
export function paradigmRows(members, content) {
  return members.map((id) => {
    const s = content.sentences.get(id);
    const d = differingToken(s, (content.families.get(content.familyOf.get(id)) ?? []).filter((m) => m !== id), content.sentences);
    return { id, ro: s.ro, en: s.en, token: d?.token ?? null, label: d ? labelFor(parseUnitId(d.unit).form) : null };
  });
}
