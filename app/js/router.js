// Hash router. routes: { name: () => import(...) } where each module exports render(root, ctx).

const KNOWN = ["home", "session", "settings", "lists", "dashboard", "lexeme"];

export function parseHash(hash) {
  const raw = (hash || "").replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const [name, ...rest] = path.split("/");
  const params = Object.fromEntries(new URLSearchParams(query));
  if (name === "lexeme" && rest[0]) params.id = decodeURIComponent(rest[0]);
  return { name, params, known: KNOWN.includes(name) && (name !== "lexeme" || !!params.id) };
}

export function start(routes, ctx) {
  const root = document.getElementById("app");
  let cleanup = null;
  let token = 0;

  async function show() {
    const route = parseHash(location.hash);
    if (!route.known || !routes[route.name]) {
      location.replace("#/home");
      return;
    }
    const mine = ++token;
    const mod = await routes[route.name]();
    if (mine !== token) return;
    if (typeof cleanup === "function") cleanup();
    cleanup = null;
    root.replaceChildren();
    ctx.route = route;
    cleanup = mod.render(root, ctx) || null;
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", show);
  return show();
}
