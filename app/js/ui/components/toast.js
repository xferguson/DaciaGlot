export function toast(text, { action, ms = 4000 } = {}) {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  const span = document.createElement("span");
  span.textContent = text;
  el.append(span);
  const close = () => el.remove();
  if (action) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = action.label;
    b.addEventListener("click", () => { action.onClick(); close(); });
    el.append(b);
  }
  host.append(el);
  setTimeout(close, ms);
  return close;
}
