import { checkAnswer } from "../../core/check.js";

/** Pure: first letter of each expected token that is still wrong or missing. */
export function hintFor(input, expected, accept = []) {
  const { diff } = checkAnswer(input, expected, accept);
  return diff.filter((d) => d.status === "wrong" || d.status === "missing")
    .map((d) => [...d.token][0] + "…").join(" ");
}
