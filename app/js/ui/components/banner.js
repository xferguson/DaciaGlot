// Persistent banners at the top of the page, keyed by id.

export function showBanner({ id, text, action, dismissible = true }) {
  const host = document.getElementById("banners");
  hideBanner(id);
  const el = document.createElement("div");
  el.className = "banner";
  el.dataset.id = id;
  el.setAttribute("role", "status");
  const span = document.createElement("span");
  span.textContent = text;
  el.append(span);
  if (action) {
    const b = document.createElement("button");
    b.className = "btn secondary";
    b.textContent = action.label;
    b.addEventListener("click", action.onClick);
    el.append(b);
  }
  if (dismissible) {
    const x = document.createElement("button");
    x.className = "btn secondary";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "×";
    x.addEventListener("click", () => hideBanner(id));
    el.append(x);
  }
  host.append(el);
  return el;
}

export function hideBanner(id) {
  for (const el of document.querySelectorAll("#banners .banner")) {
    if (el.dataset.id === id) el.remove();
  }
}
