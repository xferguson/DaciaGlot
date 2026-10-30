// Service worker. Keep APP_VERSION equal to js/version.js (the validator checks).
const APP_VERSION = "0.9.0";
const PREFIX = "dg-";

// Every file under js/, css/ and icons/ must be listed (validator rule 11).
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/icon-maskable.svg",
  "icons/icon.svg",
  "js/core/cards.js",
  "js/core/carrier.js",
  "js/core/check.js",
  "js/core/equivalences.js",
  "js/core/fsrs.js",
  "js/core/mastery.js",
  "js/core/select.js",
  "js/core/normalize.js",
  "js/core/session.js",
  "js/core/units.js",
  "js/data/content.js",
  "js/data/migrations.js",
  "js/data/store.js",
  "js/data/tts.js",
  "js/main.js",
  "js/router.js",
  "js/ui/components/answer-input.js",
  "js/ui/components/audio-button.js",
  "js/ui/components/banner.js",
  "js/ui/components/chart.js",
  "js/ui/components/diacritic-bar.js",
  "js/ui/components/feedback.js",
  "js/ui/components/flag-button.js",
  "js/ui/components/ring.js",
  "js/ui/components/toast.js",
  "js/ui/views/card-cloze.js",
  "js/ui/views/card-enro.js",
  "js/ui/views/card-keyform.js",
  "js/ui/views/cando.js",
  "js/ui/views/card-lr.js",
  "js/ui/views/card-slot.js",
  "js/ui/views/card-transform.js",
  "js/ui/views/dashboard.js",
  "js/ui/views/home.js",
  "js/ui/views/lexeme.js",
  "js/ui/views/lists.js",
  "js/ui/views/session.js",
  "js/ui/views/summary.js",
  "js/ui/views/settings.js",
  "js/version.js"
];

async function contentVersion() {
  try {
    const res = await fetch("content/manifest.json", { cache: "no-store" });
    const manifest = await res.clone().json();
    return { version: manifest.contentVersion, res };
  } catch {
    return { version: null, res: null };
  }
}

async function cacheName() {
  const { version } = await contentVersion();
  return version ? `${PREFIX}${APP_VERSION}-${version}` : null;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const { version, res } = await contentVersion();
    if (!version) throw new Error("content manifest unavailable");
    const cache = await caches.open(`${PREFIX}${APP_VERSION}-${version}`);
    await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })));
    await cache.put("content/manifest.json", res);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const current = await cacheName();
    for (const key of await caches.keys()) {
      if (!key.startsWith(PREFIX)) continue;
      // Offline at activation: keep this app version's caches rather than guess.
      const keep = current ? key === current : key.startsWith(`${PREFIX}${APP_VERSION}-`);
      if (!keep) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isContent = /\/content\/.+\.json$/.test(url.pathname);
  event.respondWith(isContent ? staleWhileRevalidate(req) : cacheFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (err) {
    if (req.mode === "navigate") {
      const shell = await caches.match("index.html");
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const name = (await caches.keys()).filter((k) => k.startsWith(`${PREFIX}${APP_VERSION}-`)).pop();
  const cache = name ? await caches.open(name) : null;
  const hit = await caches.match(req);
  const refresh = fetch(req).then((res) => {
    if (res.ok && cache) cache.put(req, res.clone());
    return res;
  });
  if (hit) {
    refresh.catch(() => {});
    return hit;
  }
  return refresh;
}
