// Flag a sentence (PRD FR-X9). Pure helpers (issueUrl, flagsMarkdown) plus a small DOM button + sheet.

const REPO_ISSUES = "https://github.com/xferguson/DaciaGlot/issues/new";
export const MAX_URL = 6000;

/**
 * Pure. Pre-filled GitHub issue URL for a flag. Always under MAX_URL characters;
 * the note is truncated first, then the body, if the encoded URL would be too long.
 * @param {{sentenceId:string, note:string, ts:number}} flag
 * @param {{ro:string, en:string}|null|undefined} sentence
 * @param {string} [contentVersion]
 */
export function issueUrl(flag, sentence, contentVersion = "") {
  const title = `Content flag: ${flag.sentenceId}`;
  const build = (note) => {
    const body = [
      `**Sentence:** ${flag.sentenceId}`,
      `**Romanian:** ${sentence?.ro ?? "(sentence not found in current content)"}`,
      `**English:** ${sentence?.en ?? ""}`,
      `**Note:** ${note || "(none)"}`,
      `**Content version:** ${contentVersion || "unknown"}`,
    ].join("\n\n");
    return `${REPO_ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=content-flag`;
  };
  let note = flag.note ?? "";
  let url = build(note);
  while (url.length >= MAX_URL && note.length > 0) {
    note = note.slice(0, Math.floor(note.length / 2));
    url = build(note);
  }
  return url;
}

/** Pure. Markdown list of all flags, for the clipboard. */
export function flagsMarkdown(flags, content) {
  return flags.map((f) => {
    const s = content?.sentences?.get(f.sentenceId);
    const date = new Date(f.ts).toISOString().slice(0, 10);
    const note = f.note ? ` — ${f.note}` : "";
    return `- \`${f.sentenceId}\` (${date}): ${s ? `${s.ro} / ${s.en}` : "(sentence not found)"}${note}`;
  }).join("\n");
}

/**
 * Flag icon button. Opens a sheet with an optional note and Save.
 * @param {{sentenceId:string, onSave:(flag:{sentenceId:string,note:string,ts:number})=>void, now?:()=>number, isFlagged?:()=>boolean}} opts
 */
export function flagButton({ sentenceId, onSave, now = Date.now, isFlagged = () => false }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn secondary flag-btn";
  btn.style.cssText = "min-width:44px;min-height:44px;padding:0 12px";
  const paint = () => {
    btn.textContent = isFlagged() ? "⚑" : "⚐";
    btn.setAttribute("aria-label", isFlagged() ? "Flagged. Flag again" : "Flag this sentence");
  };
  paint();
  btn.addEventListener("click", () => {
    const host = document.createElement("div");
    host.className = "dialog";
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.innerHTML = `<div><h2>Flag this sentence</h2>
      <p class="muted">Something wrong with the Romanian or English? Add an optional note.</p>
      <textarea class="answer-input" rows="3" aria-label="Note (optional)" data-note></textarea>
      <button class="btn" data-save>Save</button>
      <button class="btn secondary" data-cancel>Cancel</button></div>`;
    const close = () => host.remove();
    host.querySelector("[data-cancel]").addEventListener("click", close);
    host.querySelector("[data-save]").addEventListener("click", () => {
      onSave({ sentenceId, note: host.querySelector("[data-note]").value.trim(), ts: now() });
      close();
      paint();
    });
    document.body.append(host);
    host.querySelector("[data-note]").focus();
  });
  return btn;
}
