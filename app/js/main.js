import { start } from "./router.js";
import * as store from "./data/store.js";
import { loadContent } from "./data/content.js";
import * as tts from "./data/tts.js";
import { showBanner } from "./ui/components/banner.js";

const placeholder = (title) => async () => ({
  render(root) {
    root.innerHTML = `<h1></h1><p class="muted">Coming soon.</p><a class="btn secondary" href="#/home">Home</a>`;
    root.querySelector("h1").textContent = title;
  },
});

async function boot() {
  const ctx = {
    state: store.load(),
    content: null,
    store,
    tts,
    voices: [],
    navigate(hash) {
      if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = hash;
    },
  };

  store.onError(() => showBanner({
    id: "quota",
    text: "Could not save your progress (storage full or blocked). Export a backup from Settings.",
    action: { label: "Settings", onClick: () => ctx.navigate("#/settings") },
  }));
  if (ctx.state._recovered) {
    showBanner({ id: "recovered", text: "Your saved data was unreadable and has been reset. A copy was kept on this device." });
  }

  try {
    ctx.content = await loadContent("./content/");
  } catch (err) {
    document.getElementById("app").textContent = `Could not load content: ${err.message}`;
    return;
  }
  if (ctx.state.contentVersion !== ctx.content.contentVersion) {
    ctx.state = { ...ctx.state, contentVersion: ctx.content.contentVersion };
    store.save(ctx.state);
  }

  // First run: ask the browser not to evict our storage.
  navigator.storage?.persist?.().catch?.(() => {});

  tts.init({ voiceURI: ctx.state.settings.voiceURI }).then(({ available, voices }) => {
    ctx.voices = voices;
    if (!available && !ctx.state.settings.ttsBannerDismissed) {
      showBanner({
        id: "tts",
        text: tts.noVoiceHelp,
        action: {
          label: "Dismiss for good",
          onClick: () => {
            ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, ttsBannerDismissed: true } };
            store.save(ctx.state);
            document.querySelector('#banners [data-id="tts"]')?.remove();
          },
        },
      });
    }
  });

  start({
    home: () => import("./ui/views/home.js"),
    settings: () => import("./ui/views/settings.js"),
    session: () => import("./ui/views/session.js"),
    lists: placeholder("Lists"),
    dashboard: placeholder("Dashboard"),
    lexeme: placeholder("Word"),
  }, ctx);
}

boot();
