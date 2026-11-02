// The one place a card gets its `speak` and playback rate (Q14). The session view passes both ready-made;
// `tts` + `settings` is the fallback for callers (tests, previews) that build a card on its own.
import { SETTINGS_DEFAULTS } from "../../data/store.js";

/** @returns {{speak: (text: string, opts?: object) => any, rate: number}} */
export function speechFor({ speak, rate, tts, settings = {} }) {
  const r = rate ?? settings.ttsRate ?? SETTINGS_DEFAULTS.ttsRate;
  return { rate: r, speak: speak ?? ((text, opts) => tts?.speak?.(text, { rate: r, ...opts })) };
}
