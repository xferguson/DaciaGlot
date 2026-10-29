import { start } from "./router.js";

// Stubs: real state arrives with T05, real content with T02.
const state = {};
const content = { sentences: [] };

const ctx = {
  state,
  content,
  navigate(hash) {
    if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = hash;
  },
};

// Views not built yet render a placeholder.
const placeholder = (title) => async () => ({
  render(root) {
    root.innerHTML = `<h1></h1><p class="muted">Coming soon.</p><a class="btn secondary" href="#/home">Home</a>`;
    root.querySelector("h1").textContent = title;
  },
});

start({
  home: () => import("./ui/views/home.js"),
  settings: () => import("./ui/views/settings.js"),
  session: placeholder("Session"),
  lists: placeholder("Lists"),
  dashboard: placeholder("Dashboard"),
  lexeme: placeholder("Word"),
}, ctx);
