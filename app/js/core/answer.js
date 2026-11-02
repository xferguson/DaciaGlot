// Typed-answer card state machine (PRD FR-D6, FR-D8). Pure: one try plus one retry, and a rating only for a clean first try.

export const initialAnswer = (mode = "speak") => ({ attempts: 0, usedHint: false, finished: false, mode });

/**
 * `answerStep(state, event) → {state, effect}`; effect is `retry`, `finish` or `none`.
 * Events: `{type:"check", result}` (a non-empty answer was checked), `{type:"hint"}`,
 * `{type:"spoke"}` (self-graded in speak mode: ends the card), `{type:"mode", mode}` (only before the first try).
 */
export function answerStep(state, event) {
  if (state.finished) return { state, effect: "none" };
  switch (event.type) {
    case "check": {
      const attempts = state.attempts + 1;
      if (event.result !== "wrong" || attempts >= 2) return { state: { ...state, attempts, finished: true }, effect: "finish" };
      return { state: { ...state, attempts }, effect: "retry" };
    }
    case "hint": return { state: { ...state, usedHint: true }, effect: "none" };
    case "spoke": return { state: { ...state, attempts: 1, finished: true }, effect: "finish" };
    case "mode":
      if (state.attempts || event.mode === state.mode) return { state, effect: "none" };
      return { state: { ...state, mode: event.mode }, effect: "none" };
    default: return { state, effect: "none" };
  }
}

/** Pure: the learner may rate the card only after a first-try, hint-free, non-wrong answer. */
export const canRate = (state, result) => result !== "wrong" && state.attempts === 1 && !state.usedHint;
