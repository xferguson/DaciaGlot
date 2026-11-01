// One way to make a button and run what it does. Every tap goes through `runAction`, so a handler that
// throws is logged and reported instead of silently leaving the screen dead (the "Continue does nothing" bug).
import { toast } from "./toast.js";

function fail(err, onFail) {
  console.error(err);
  try { onFail?.(err); } catch (e) { console.error(e); }
  try { toast("Something went wrong. Try again."); } catch { /* no toast host (tests) */ }
}

/** Run `fn`, catching sync throws and async rejections; `onFail` restores the UI (e.g. re-enables buttons). */
export function runAction(fn, onFail) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") r.then(undefined, (err) => fail(err, onFail));
  } catch (err) {
    fail(err, onFail);
  }
}

/** `<button type="button">` whose click runs `onClick` through `runAction`. `props` are assigned onto it. */
export function button(label, className, onClick, { onFail, ...props } = {}) {
  const b = Object.assign(document.createElement("button"), { type: "button", className, textContent: label }, props);
  if (onClick) b.addEventListener("click", (e) => runAction(() => onClick(e), onFail));
  return b;
}

/**
 * A button that moves on: it disables `group`'s buttons (or itself) before running `onClick`, so a double
 * tap can't fire twice, and re-enables them if the action fails, so the learner is never stuck.
 */
export function advanceButton(label, className, onClick, group = null) {
  const peers = () => (group ? [...group.querySelectorAll("button")] : [b]);
  const b = button(label, className, (e) => {
    if (b.disabled) return;
    for (const x of peers()) x.disabled = true;
    return onClick(e);
  }, { onFail: () => { for (const x of peers()) x.disabled = false; } });
  return b;
}
