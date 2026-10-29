// Settings (PRD FR-N5, FR-X3). Reads ctx.state at render time; writes via ctx.store.
import { issueUrl, flagsMarkdown } from "../components/flag-button.js";
import { toast } from "../components/toast.js";
import { defaultState, exportState, importState, ImportError } from "../../data/store.js";
import { setVoiceURI, speak } from "../../data/tts.js";

const dateStamp = () => new Date().toISOString().slice(0, 10);

export function render(root, ctx) {
  const st = () => ctx.state;
  const update = (patch) => {
    ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, ...patch } };
    ctx.store.save(ctx.state);
  };
  const voices = ctx.voices ?? [];
  const ro = voices.filter((v) => /^ro/i.test(v.lang));
  const list = ro.length ? ro : voices;

  root.innerHTML = `<h1>Settings</h1>
    <section class="card settings">
      <label for="newPer">New sentences per session</label>
      <input id="newPer" type="number" min="1" max="30" inputmode="numeric">
      <label for="voice">Voice</label>
      <select id="voice"></select>
      <label for="rate">Speech rate: <span data-rate></span>×</label>
      <input id="rate" type="range" min="0.5" max="1.2" step="0.05">
      <button class="btn secondary" data-test>Test voice</button>
      <label class="check"><input id="autoplay" type="checkbox"> Autoplay audio</label>
    </section>
    <section class="card">
      <h2>Your data</h2>
      <div class="row"><button class="btn" data-export>Export</button>
      <button class="btn secondary" data-import>Import</button></div>
      <input type="file" accept="application/json,.json" hidden data-file>
      <button class="btn secondary block" data-reset style="margin-top:12px">Reset all data</button>
    </section>
    <section class="card">
      <h2>Flagged sentences</h2>
      <div data-flags></div>
    </section>
    <a class="btn secondary block" href="#/home">Home</a>
    <div data-dialog></div>`;

  const q = (s) => root.querySelector(s);
  const s0 = st().settings;
  q("#newPer").value = s0.newPerSession;
  q("#newPer").addEventListener("change", (e) => {
    update({ newPerSession: Math.min(30, Math.max(1, Math.round(Number(e.target.value)) || 8)) });
  });
  const sel = q("#voice");
  sel.append(new Option("Automatic", ""));
  for (const v of list) sel.append(new Option(`${v.name} (${v.lang})`, v.voiceURI));
  sel.value = s0.voiceURI ?? "";
  sel.addEventListener("change", () => {
    const uri = sel.value || null;
    setVoiceURI(uri);
    update({ voiceURI: uri });
  });
  const rate = q("#rate");
  rate.value = s0.ttsRate;
  q("[data-rate]").textContent = Number(s0.ttsRate).toFixed(2);
  rate.addEventListener("input", () => {
    q("[data-rate]").textContent = Number(rate.value).toFixed(2);
    update({ ttsRate: Number(rate.value) });
  });
  q("[data-test]").addEventListener("click", () => speak("Bună dimineața, ce mai faci?", { rate: st().settings.ttsRate }));
  q("#autoplay").checked = s0.autoplay;
  q("#autoplay").addEventListener("change", (e) => update({ autoplay: e.target.checked }));

  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function renderFlags() {
    const box = q("[data-flags]");
    const flags = st().flags;
    if (!flags.length) { box.innerHTML = `<p class="muted">No flags yet. Use the flag icon on a card.</p>`; return; }
    box.innerHTML = flags.map((f, i) => {
      const s = ctx.content?.sentences?.get(f.sentenceId);
      return `<div class="flag-item" style="margin-bottom:12px">
        <p lang="ro"><strong>${esc(s?.ro ?? f.sentenceId)}</strong></p>
        <p class="muted">${esc(s?.en ?? "")}</p>
        ${f.note ? `<p>${esc(f.note)}</p>` : ""}
        <p class="muted">${new Date(f.ts).toISOString().slice(0, 10)}</p>
        <div class="row"><a class="btn secondary" target="_blank" rel="noopener" data-open="${i}" href="${esc(issueUrl(f, s, ctx.content?.contentVersion))}">Open issue</a>
        <button class="btn secondary" data-del="${i}">Delete</button></div></div>`;
    }).join("") + `<button class="btn secondary block" data-copy>Copy all</button>`;
    box.querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", () => {
      const i = Number(a.dataset.open);
      setTimeout(() => {
        if (confirm("Delete this flag now that its issue is open?")) removeFlag(i);
      }, 500);
    }));
    box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => removeFlag(Number(b.dataset.del))));
    box.querySelector("[data-copy]").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(flagsMarkdown(st().flags, ctx.content)); toast("Copied"); }
      catch { toast("Couldn't copy"); }
    });
  }
  function removeFlag(i) {
    ctx.state = { ...ctx.state, flags: ctx.state.flags.filter((_, j) => j !== i) };
    ctx.store.save(ctx.state);
    renderFlags();
  }
  renderFlags();

  q("[data-export]").addEventListener("click", () => {
    const url = URL.createObjectURL(exportState(st()));
    const a = Object.assign(document.createElement("a"), { href: url, download: `daciaglot-backup-${dateStamp()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    update({ lastExportAt: Date.now() });
    toast("Backup downloaded");
  });

  const dialog = q("[data-dialog]");
  const closeDialog = () => dialog.replaceChildren();
  const openDialog = (html) => {
    dialog.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><div>${html}</div></div>`;
    return dialog.firstElementChild.firstElementChild;
  };

  q("[data-import]").addEventListener("click", () => q("[data-file]").click());
  q("[data-file]").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const box = openDialog(`<h2>Import backup</h2><p>Merge keeps the later review per card. Replace discards current progress.</p>
      <button class="btn" data-mode="merge">Merge</button>
      <button class="btn secondary" data-mode="replace">Replace</button>
      <button class="btn secondary" data-cancel>Cancel</button>`);
    box.querySelector("[data-cancel]").addEventListener("click", closeDialog);
    box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
      try {
        ctx.state = importState(text, b.dataset.mode, ctx.state);
        ctx.store.save(ctx.state);
        ctx.store.flush();
        closeDialog();
        toast("Backup imported");
        render(root, ctx);
      } catch (err) {
        closeDialog();
        toast(err instanceof ImportError ? err.message : "Import failed", { ms: 7000 });
      }
    }));
  });

  q("[data-reset]").addEventListener("click", () => {
    const box = openDialog(`<h2>Reset all data</h2><p>This deletes all progress on this device. Type RESET to confirm.</p>
      <input class="answer-input" data-confirm autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Type RESET">
      <button class="btn" data-go disabled>Reset</button>
      <button class="btn secondary" data-cancel>Cancel</button>`);
    const input = box.querySelector("[data-confirm]");
    const go = box.querySelector("[data-go]");
    input.addEventListener("input", () => { go.disabled = input.value.trim() !== "RESET"; });
    box.querySelector("[data-cancel]").addEventListener("click", closeDialog);
    go.addEventListener("click", () => {
      ctx.state = { ...defaultState(Date.now()), contentVersion: ctx.content?.contentVersion ?? "" };
      ctx.store.save(ctx.state);
      ctx.store.flush();
      closeDialog();
      toast("All data reset");
      render(root, ctx);
    });
    input.focus();
  });
}
