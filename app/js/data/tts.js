// Romanian text-to-speech via the Web Speech API. Falls back quietly when unsupported.

export const DEFAULT_RATE = 0.9;
export const MAX_CHUNK = 200;
const INIT_TIMEOUT_MS = 2000;
const SPEAK_TIMEOUT_MS = 15000;

export const noVoiceHelp = [
  "No Romanian voice found. On Android:",
  "1. Settings → System → Languages → Text-to-speech output → Preferred engine: Speech Services by Google.",
  "2. Tap ⚙ → Install voice data → Romanian.",
].join("\n");

let voices = [];
let savedURI = null;

function synth() {
  return globalThis.speechSynthesis ?? null;
}

/** Prefer the saved voiceURI, then lang ro-RO, then any ro*; null if none. */
export function pickVoice(list, uri) {
  const all = Array.from(list ?? []);
  const lang = (v) => String(v.lang ?? "").replace("_", "-").toLowerCase();
  if (uri) {
    const saved = all.find((v) => v.voiceURI === uri);
    if (saved) return saved;
  }
  return (
    all.find((v) => lang(v) === "ro-ro") ??
    all.find((v) => lang(v) === "ro" || lang(v).startsWith("ro-")) ??
    null
  );
}

/** Split into pieces of at most `max` chars, preferring sentence/clause punctuation. */
export function splitText(text, max = MAX_CHUNK) {
  const out = [];
  let rest = String(text).trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(...[". ", "! ", "? ", "; ", ": ", ", "].map((p) => window.lastIndexOf(p) + 1 || 0));
    if (cut <= 0) cut = window.lastIndexOf(" ") + 1;
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function init({ voiceURI } = {}) {
  if (voiceURI !== undefined) savedURI = voiceURI;
  const s = synth();
  if (!s) return Promise.resolve({ available: false, voices: [] });
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      s.removeEventListener?.("voiceschanged", finish);
      voices = s.getVoices();
      resolve({ available: pickVoice(voices, savedURI) !== null, voices });
    };
    const timer = setTimeout(finish, INIT_TIMEOUT_MS);
    s.addEventListener?.("voiceschanged", finish);
    if (s.getVoices().length) finish();
  });
}

export function setVoiceURI(uri) {
  savedURI = uri;
}

function speakChunk(s, text, rate, voice) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ro-RO";
    if (voice) u.voice = voice;
    u.rate = rate;
    const timer = setTimeout(resolve, SPEAK_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    s.speak(u);
  });
}

let token = 0;

/** Cancels any current speech, then speaks. Never rejects or hangs. */
export async function speak(text, { rate = DEFAULT_RATE } = {}) {
  const s = synth();
  if (!s || !text) return;
  const mine = ++token;
  s.cancel();
  if (!voices.length) voices = s.getVoices();
  const voice = pickVoice(voices, savedURI);
  for (const chunk of splitText(text)) {
    if (mine !== token) return;
    await speakChunk(s, chunk, rate, voice);
  }
}
