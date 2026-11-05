/**
 * dsh-restart-handoff — client half.
 *
 * Adds a "重启" section to Settings: one plain-language status block, the
 * switches that matter, and a short history. Technical detail stays folded away.
 *
 * Styling follows the host theme tokens (--dsw-alias-*), so the panel tracks
 * light/dark and any custom theme without hard-coded colors.
 */
window.__ModuleLoader__.load({
  id: "@saolence/dsh-restart-handoff",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const h = React.createElement;

    const BASE = "restart-handoff";
    const STYLE_ID = "dsh-restart-handoff-css";

    const CSS = `
.ar-root {
  display: flex; flex-direction: column; gap: 18px;
  max-width: 700px; padding: 4px 2px 18px;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 0.95rem; line-height: 1.6;
}
.ar-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ar-title { margin: 0; font-size: 1.06rem; font-weight: 650; letter-spacing: 0.01em; }
.ar-sub {
  margin: 6px 0 0; max-width: 52ch; font-size: 0.85rem; line-height: 1.65;
  color: var(--dsw-alias-label-secondary, rgba(127,127,127,0.9));
}
.ar-pill {
  flex: none; display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 12px 5px 10px; border-radius: 999px;
  font-size: 0.76rem; font-weight: 600; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.25));
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06));
}
.ar-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary, #999); }
.ar-pill[data-tone="success"] .ar-pill-dot { background: var(--dsw-alias-state-success-primary, #3c9a53); }
.ar-pill[data-tone="warn"] .ar-pill-dot {
  background: var(--dsw-alias-state-warn-primary, #d99a2b);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d99a2b) 20%, transparent);
}
.ar-pill[data-tone="idle"] { color: var(--dsw-alias-label-secondary, inherit); }

.ar-hero {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  padding: 20px 22px; border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4b7bec) 22%, var(--dsw-alias-border-l1, rgba(127,127,127,0.22)));
  background: linear-gradient(150deg,
    color-mix(in srgb, var(--dsw-alias-brand-primary, #4b7bec) 10%, var(--dsw-alias-bg-layer-1, transparent)),
    var(--dsw-alias-bg-layer-1, transparent));
}
.ar-hero[data-tone="warn"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d99a2b) 45%, transparent);
  background: linear-gradient(150deg,
    color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d99a2b) 13%, var(--dsw-alias-bg-layer-1, transparent)),
    var(--dsw-alias-bg-layer-1, transparent));
}
.ar-hero[data-tone="idle"] {
  border-color: var(--dsw-alias-border-l1, rgba(127,127,127,0.22));
  background: var(--dsw-alias-bg-layer-1, transparent);
}
.ar-hero-icon {
  flex: none; width: 54px; height: 54px; border-radius: 17px; display: grid; place-items: center;
  font-size: 1.5rem; background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08));
}
.ar-hero-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.ar-hero-title { margin: 0; font-size: 1.2rem; font-weight: 650; letter-spacing: 0.01em; }
.ar-hero-sub { margin: 0; font-size: 0.85rem; line-height: 1.6; color: var(--dsw-alias-label-secondary, inherit); }
.ar-hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ar-ring {
  width: 62px; height: 62px; border-radius: 50%; flex: none; display: grid; place-items: center;
  background: conic-gradient(
    var(--dsw-alias-state-warn-primary, #d99a2b) var(--ar-progress, 0%),
    var(--dsw-alias-border-l1, rgba(127,127,127,0.25)) 0
  );
}
.ar-ring-core {
  width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center;
  background: var(--dsw-alias-bg-layer-1, #fff);
  font-size: 1.02rem; font-weight: 650; font-variant-numeric: tabular-nums;
}
.ar-bar {
  height: 4px; border-radius: 999px; margin-top: 7px;
  background: var(--dsw-alias-border-l1, rgba(127,127,127,0.25)); overflow: hidden;
}
.ar-bar-fill {
  height: 100%; border-radius: 999px; transition: width 0.25s linear;
  background: var(--dsw-alias-state-warn-primary, #d99a2b);
}

.ar-card {
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.22));
  border-radius: 16px; background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.04));
  padding: 4px 18px 6px;
}
.ar-card-title {
  margin: 14px 0 0; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.06em;
  color: var(--dsw-alias-label-secondary, inherit);
}
.ar-row {
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  padding: 14px 0; border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.16));
}
.ar-row:first-of-type { border-top: none; }
.ar-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ar-row-label { font-size: 0.92rem; font-weight: 550; }
.ar-row-desc { font-size: 0.8rem; color: var(--dsw-alias-label-secondary, inherit); line-height: 1.6; }

.ar-switch {
  position: relative; flex: none; width: 46px; height: 26px; padding: 0; cursor: pointer;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.4));
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12));
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}
.ar-switch[data-on="true"] {
  background: var(--dsw-alias-brand-primary, #4b7bec); border-color: transparent;
}
.ar-switch:disabled { opacity: 0.42; cursor: not-allowed; }
.ar-knob {
  position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.28);
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.ar-switch[data-on="true"] .ar-knob { transform: translateX(20px); }
.ar-switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4b7bec); outline-offset: 2px; }

.ar-more {
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.22));
  border-radius: 16px; background: var(--dsw-alias-bg-layer-1, transparent); padding: 2px 18px;
}
.ar-more > summary {
  cursor: pointer; list-style: none; padding: 13px 0;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 0.85rem; color: var(--dsw-alias-label-secondary, inherit);
}
.ar-more > summary::-webkit-details-marker { display: none; }
.ar-more[open] > summary { border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.16)); }
.ar-chevron { transition: transform 0.18s ease; opacity: 0.7; }
.ar-more[open] .ar-chevron { transform: rotate(180deg); }

.ar-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 16px; border-radius: 11px; font: inherit; font-size: 0.88rem; font-weight: 600;
  cursor: pointer; transition: filter 0.15s ease, transform 0.1s ease, background 0.15s ease;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.4));
  background: transparent; color: inherit; white-space: nowrap;
}
.ar-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08)); }
.ar-btn:active:not(:disabled) { transform: translateY(1px); }
.ar-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ar-btn--primary { border-color: transparent; color: #fff; background: var(--dsw-alias-brand-primary, #4b7bec); }
.ar-btn--primary:hover:not(:disabled) { filter: brightness(1.06); background: var(--dsw-alias-brand-primary, #4b7bec); }
.ar-btn--quiet { border-color: var(--dsw-alias-border-l1, rgba(127,127,127,0.28)); color: var(--dsw-alias-label-secondary, inherit); }
.ar-btn--danger {
  color: var(--dsw-alias-state-error-primary, #d9534f);
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d9534f) 38%, transparent);
}

.ar-template-hint {
  margin: 8px 0 10px; font-size: 0.8rem; line-height: 1.6;
  color: var(--dsw-alias-label-secondary, inherit);
}
.ar-text {
  width: 100%; box-sizing: border-box; resize: vertical; min-height: 120px;
  padding: 11px 13px; border-radius: 12px; font-family: inherit; font-size: 0.86rem; line-height: 1.65;
  color: inherit; background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.24));
}
.ar-text:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4b7bec); outline-offset: 1px; }
.ar-text:disabled { opacity: 0.55; }
.ar-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.ar-chip {
  padding: 4px 9px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 0.74rem;
  color: var(--dsw-alias-label-secondary, inherit); white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.24));
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.05));
}
.ar-chip:hover:not(:disabled) { color: inherit; border-color: var(--dsw-alias-border-l2, rgba(127,127,127,0.42)); }
.ar-chip:disabled { opacity: 0.45; cursor: not-allowed; }
.ar-template-actions { display: flex; align-items: center; gap: 10px; margin: 12px 0 4px; flex-wrap: wrap; }
.ar-template-actions .ar-btn { padding: 8px 14px; font-size: 0.84rem; }
.ar-btn--ghost { border-color: transparent; color: var(--dsw-alias-label-secondary, inherit); }
.ar-template-note { font-size: 0.78rem; color: var(--dsw-alias-label-secondary, inherit); }
.ar-preview-title {
  margin: 14px 0 6px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.05em;
  color: var(--dsw-alias-label-secondary, inherit);
}
.ar-preview {
  margin: 0 0 12px; padding: 12px 14px; border-radius: 12px; overflow-x: auto;
  font-family: inherit; font-size: 0.84rem; line-height: 1.7; white-space: pre-wrap; word-break: break-word;
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06));
  border: 1px dashed var(--dsw-alias-border-l1, rgba(127,127,127,0.28));
}

.ar-msg { margin: 0; font-size: 0.85rem; }
.ar-msg[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #d9534f); }
.ar-msg[data-tone="ok"] { color: var(--dsw-alias-state-success-primary, #3c9a53); }

.ar-log { display: flex; flex-direction: column; margin: 6px 0 8px; padding: 0; list-style: none; }
.ar-item {
  display: grid; grid-template-columns: 9px 1fr auto; gap: 4px 12px; align-items: baseline;
  padding: 11px 0; border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.14));
}
.ar-item:first-child { border-top: none; }
.ar-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 1px; background: var(--dsw-alias-state-idle-primary, #999); }
.ar-dot[data-tone="success"] { background: var(--dsw-alias-state-success-primary, #3c9a53); }
.ar-dot[data-tone="warn"] { background: var(--dsw-alias-state-warn-primary, #d99a2b); }
.ar-dot[data-tone="error"] { background: var(--dsw-alias-state-error-primary, #d9534f); }
.ar-item-label { font-size: 0.88rem; }
.ar-item-when { font-size: 0.76rem; color: var(--dsw-alias-label-secondary, inherit); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ar-item-detail {
  grid-column: 2 / 4; font-size: 0.78rem; color: var(--dsw-alias-label-secondary, inherit);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ar-empty {
  margin: 8px 0 10px; padding: 22px; border-radius: 12px; text-align: center;
  font-size: 0.84rem; color: var(--dsw-alias-label-secondary, inherit);
  border: 1px dashed var(--dsw-alias-border-l1, rgba(127,127,127,0.3));
}
.ar-foot { font-size: 0.76rem; color: var(--dsw-alias-label-secondary, inherit); }
.ar-foot > summary { cursor: pointer; list-style: none; opacity: 0.8; }
.ar-foot > summary::-webkit-details-marker { display: none; }
.ar-foot-body { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
.ar-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; overflow-wrap: anywhere; }

.rh-slot { position: relative; display: inline-flex; align-items: center; width: 100%; }
.rh-tile {
  position: relative; display: flex; align-items: center; gap: 8px;
  width: calc(100% + 4px); margin: 0 -2px; height: 44px; padding: 6px; box-sizing: border-box;
  border: 0; border-radius: 12px; background: transparent;
  color: var(--dsw-alias-label-primary, #0f1115);
  font: inherit; font-size: 14px; line-height: 1.2; font-weight: 400;
  cursor: pointer; overflow: hidden; text-align: left;
}
.rh-tile--rail {
  width: 44px; flex: 0 0 44px; margin: 0 0 0 var(--rh-nudge, -6px);
  justify-content: center; padding: 0;
}
/* The footer action row is padded differently from the account row above it, and the
   two paddings differ again when the sidebar collapses to the icon rail. Ring measures
   its own slot and sets --rh-nudge so this icon stays on the avatar's vertical axis. */
.rh-tile:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06)); }
.rh-tile:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06)); }
.rh-tile:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4b7bec); outline-offset: -2px; }
.rh-tile:disabled { opacity: 0.45; cursor: not-allowed; }
.rh-tile[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary, #b0741d); }
.rh-tile[data-tone="warn"] .rh-chip { color: var(--dsw-alias-state-warn-primary, #b0741d); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d99a2b) 14%, transparent); }
.rh-tile[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #c0392b); }
.rh-tile[data-tone="error"] .rh-chip { color: var(--dsw-alias-state-error-primary, #c0392b); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d95050) 14%, transparent); }
.rh-chip {
  flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #0f1115) 4%, transparent);
  color: var(--dsw-alias-label-tertiary, #81858c);
  font-size: 0.875rem; font-variant-numeric: tabular-nums; line-height: 1;
}
.rh-icon { display: grid; place-items: center; }
.rh-icon--glyph { font-size: 15px; line-height: 1; transform: translateY(-0.5px); }
.rh-icon--pause { font-size: 9px; letter-spacing: 1px; }
.rh-text { flex: 1; min-width: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; }
.rh-dot {
  flex: none; position: relative; width: 14px; height: 14px; border-radius: 50%;
  display: grid; place-items: center; font-size: 7px; line-height: 1;
  color: var(--dsw-alias-state-warn-primary, #b0741d);
  background: conic-gradient(currentColor var(--rh-progress, 0%), color-mix(in srgb, currentColor 18%, transparent) 0);
}
.rh-dot::after {
  content: ""; position: absolute; inset: 2px; border-radius: 50%;
  background: var(--dsw-alias-bg-base, #fff);
}
.rh-dot[data-paused="true"] { background: color-mix(in srgb, currentColor 14%, transparent); }
.rh-dot-glyph { position: relative; z-index: 1; }
.rh-pop {
  position: fixed; z-index: 61; display: flex; align-items: center; gap: 8px;
  padding: 7px 8px 7px 11px; border-radius: 10px;
  background: var(--dsw-alias-bg-overlay, #fff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.25));
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 0.78rem; white-space: nowrap;
}
.rh-pop-text { opacity: 0.9; }
.rh-pop-actions { display: inline-flex; gap: 6px; }
.rh-pop-btn {
  font: inherit; font-size: 0.78rem; padding: 3px 10px; border-radius: 7px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35));
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
}
.rh-pop-btn:hover { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.10)); }
.rh-pop-yes {
  border-color: var(--dsw-alias-state-error-primary, #d9534f);
  background: var(--dsw-alias-state-error-primary, #d9534f);
  color: #fff;
}
.rh-pop-yes:hover { filter: brightness(1.06); background: var(--dsw-alias-state-error-primary, #d9534f); }
`;

    function ensureStyle() {
      if (typeof document === "undefined" || !document.head) return;
      const existing = document.getElementById(STYLE_ID);
      // The client module host can re-apply a plugin without reloading the page,
      // so the previous <style> may still be mounted. Overwrite it when the sheet
      // changed, otherwise a styles-only edit is silently ignored until F5.
      if (existing && existing.textContent === CSS) return;
      const element = existing || document.createElement("style");
      element.id = STYLE_ID;
      element.textContent = CSS;
      if (!existing) document.head.appendChild(element);
    }

    const KIND = {
      restarting: { label: "自动重启了", tone: "warn" },
      resumed: { label: "回来后接着干了", tone: "success" },
      "resume-failed": { label: "没接上，稍后再试", tone: "error" },
      "resume-given-up": { label: "放弃了继续", tone: "error" },
      "resume-expired": { label: "继续指令过期了", tone: "idle" },
      failed: { label: "重启失败", tone: "error" },
      cancelled: { label: "已取消", tone: "idle" },
    };

    function two(value) {
      return String(value).padStart(2, "0");
    }

    function ago(ms) {
      const diff = Date.now() - Number(ms);
      if (!Number.isFinite(diff) || diff < 0) return "";
      if (diff < 60 * 1000) return "刚刚";
      if (diff < 60 * 60 * 1000) return Math.round(diff / 60000) + " 分钟前";
      if (diff < 24 * 60 * 60 * 1000) return Math.round(diff / 3600000) + " 小时前";
      const date = new Date(Number(ms));
      return two(date.getMonth() + 1) + "-" + two(date.getDate()) + " " + two(date.getHours()) + ":" + two(date.getMinutes());
    }

    function fullClock(ms) {
      const date = new Date(Number(ms));
      return two(date.getHours()) + ":" + two(date.getMinutes()) + ":" + two(date.getSeconds());
    }

    function Switch(props) {
      return h("button", {
        type: "button",
        role: "switch",
        "aria-checked": Boolean(props.checked),
        "aria-label": props.label,
        "data-on": String(Boolean(props.checked)),
        className: "ar-switch",
        disabled: props.disabled,
        onClick: () => props.onChange(!props.checked),
      }, h("span", { className: "ar-knob" }));
    }

    function Row(props) {
      return h(
        "div",
        { className: "ar-row" },
        h(
          "div",
          { className: "ar-row-text" },
          h("span", { className: "ar-row-label" }, props.label),
          props.desc ? h("span", { className: "ar-row-desc" }, props.desc) : null,
        ),
        h(Switch, {
          checked: props.checked,
          disabled: props.disabled,
          label: props.label,
          onChange: props.onChange,
        }),
      );
    }

    // The hand-off layout is user-authored, so it gets a real editor: a textarea
    // plus a preview rendered by the host (same code path as the real delivery,
    // so what you see here is what lands in the next session).
    function TemplateEditor(props) {
      const saved = String((props.settings && props.settings.continuationTemplate) || "");
      const fallback = String(props.defaultTemplate || "");
      const [draft, setDraft] = React.useState(saved);
      const [preview, setPreview] = React.useState(String(props.preview || ""));
      const [error, setError] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [dirty, setDirty] = React.useState(false);
      const timer = React.useRef(null);
      const latest = React.useRef(draft);

      // Adopt a template changed elsewhere (another window, or a save landing).
      React.useEffect(() => {
        if (dirty) return;
        if (draft !== saved) {
          setDraft(saved);
          latest.current = saved;
        }
      }, [saved]);

      React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

      const askPreview = (text) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
          try {
            const response = await fetch(BASE + "/preview", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ template: text }),
            });
            const value = await response.json().catch(() => ({}));
            if (value && value.ok === false) {
              setError(String(value.error || "模板有问题"));
              return;
            }
            if (!response.ok) throw new Error("HTTP " + response.status);
            setError("");
            setPreview(String(value.text || ""));
          } catch (cause) {
            setError("预览没出来：" + String((cause && cause.message) || cause));
          }
        }, 260);
      };

      const edit = (text) => {
        setDraft(text);
        latest.current = text;
        setDirty(true);
        askPreview(text);
      };

      const save = async () => {
        setBusy(true);
        try {
          const ok = await props.save({ continuationTemplate: latest.current });
          // A refused save must not look saved: the panel message explains why,
          // and the draft stays dirty so the button still offers to save.
          if (ok === false) return;
          setDirty(false);
          setError("");
        } catch (cause) {
          // The host re-validates; a refused save must say why instead of
          // looking saved until the next refresh.
          setError("没保存上：" + String((cause && cause.message) || cause));
        } finally {
          setBusy(false);
        }
      };

      const reset = () => {
        edit("");
        setDraft("");
        latest.current = "";
      };

      return h(
        "div",
        { className: "ar-card" },
        h("p", { className: "ar-card-title" }, "交接话模板"),
        h(
          "p",
          { className: "ar-template-hint" },
          "重启后你看到的那段话长什么样，由这里决定。模型只填内容，排版按下面的模板走；哪一项没填，那一行整行不显示。写的时候段与段之间空一行（只按一个回车的两行会被合成一段）；要标题层级用 ##，要分行用 - ，别用星号加粗——有些渲染器会把星号原样露出来。",
        ),
        h("textarea", {
          className: "ar-text",
          rows: 7,
          spellCheck: false,
          value: draft,
          placeholder: fallback,
          disabled: props.disabled || busy,
          onChange: (event) => edit(event.target.value),
        }),
        h(
          "div",
          { className: "ar-chips" },
          ["reason", "progress", "next", "skip", "session", "time"].map((field) =>
            h(
              "button",
              {
                type: "button",
                key: field,
                className: "ar-chip",
                disabled: props.disabled || busy,
                onClick: () => edit(draft + "{{" + field + "}}"),
                title: "插入 {{" + field + "}}",
              },
              "{{" + field + "}}",
            ),
          ),
        ),
        h(
          "div",
          { className: "ar-template-actions" },
          h(
            "button",
            {
              type: "button",
              className: "ar-btn",
              disabled: props.disabled || busy || !dirty,
              onClick: save,
            },
            dirty ? "保存模板" : "已保存",
          ),
          h(
            "button",
            { type: "button", className: "ar-btn ar-btn--ghost", disabled: props.disabled || busy, onClick: reset },
            "恢复默认",
          ),
          dirty ? h("span", { className: "ar-template-note" }, "改了还没保存") : null,
        ),
        error ? h("p", { className: "ar-msg", "data-tone": "error" }, error) : null,
        h("p", { className: "ar-preview-title" }, "预览"),
        h("pre", { className: "ar-preview" }, preview || "（空）"),
      );
    }

    // One signal only: the shell's "connected" toast. Everything else the
    // window prints while it reconnects is ignored on purpose.
    const CONNECTED_TEXT = "连接成功";
    // How long to keep the ring away once that line has been read.
    const CONNECTED_HOLD_MS = 3000;

    function shellSaysConnected() {
      try {
        return String((document.body && document.body.innerText) || "").includes(CONNECTED_TEXT);
      } catch {
        return false;
      }
    }

    function Ring(props) {
      const slotRef = React.useRef(null);
      const [nudge, setNudge] = React.useState("-6px");
      const [status, setStatus] = React.useState(null);
      const [ask, setAsk] = React.useState(false);
      const [armUntil, setArmUntil] = React.useState(0);
      const [busy, setBusy] = React.useState(false);
      const [anchor, setAnchor] = React.useState(null);
      const [gone, setGone] = React.useState(false);
      const [, tick] = React.useReducer((x) => x + 1, 0);
      const alive = React.useRef(true);
      const bootPid = React.useRef(null);
      const restartPid = React.useRef(null);
      const restartAt = React.useRef(0);
      const successAt = React.useRef(0);
      const goneRef = React.useRef(false);
      const fails = React.useRef(0);

      React.useEffect(() => {
        ensureStyle();
      }, []);

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(BASE + "/status", { headers: { accept: "application/json" } });
          if (!response.ok) throw new Error("HTTP " + response.status);
          const value = await response.json();
          if (!alive.current) return;
          fails.current = 0;
          const boot = value && value.boot;
          const pid = boot ? boot.pid ?? boot.bootAt ?? null : null;
          if (pid && bootPid.current === null) bootPid.current = pid;
          if (goneRef.current) {
            const now = Date.now();
            if (!successAt.current && shellSaysConnected()) successAt.current = now;
            const since = restartAt.current > 0 ? now - restartAt.current : 0;
            const sinceSuccess = successAt.current > 0 ? now - successAt.current : -1;
            const replaced = pid !== null && restartPid.current !== null && pid !== restartPid.current;
            const ready = replaced && successAt.current > 0 && sinceSuccess >= CONNECTED_HOLD_MS;
            // Absolute escape hatch: never stay hidden forever.
            if (ready || since > 12000) {
              goneRef.current = false;
              restartPid.current = null;
              restartAt.current = 0;
              successAt.current = 0;
              if (pid) bootPid.current = pid;
              setGone(false);
            }
          }
          setStatus(value);
        } catch {
          fails.current += 1;
          if (alive.current) setStatus((current) => current || { desktop: true, countdown: { active: false } });
        }
      }, []);

      React.useEffect(() => {
        alive.current = true;
        load();
        // Poll harder while hidden: the "connected" toast only lives for a
        // second or two, and missing it would make the ring come back early.
        const id = setInterval(
          () => {
            if (typeof document !== "undefined" && document.hidden) return;
            load();
          },
          gone ? 600 : 1500,
        );
        return () => {
          alive.current = false;
          clearInterval(id);
        };
      }, [load, gone]);

      React.useEffect(() => {
        const element = slotRef.current;
        if (!element) return undefined;
        const read = () => {
          const width = element.getBoundingClientRect().width;
          if (width > 0) setNudge(width < 120 ? "-1px" : "-6px");
        };
        read();
        if (typeof ResizeObserver !== "function") {
          window.addEventListener("resize", read);
          return () => window.removeEventListener("resize", read);
        }
        const observer = new ResizeObserver(read);
        observer.observe(element);
        return () => observer.disconnect();
      }, []);

      const countdown = (status && status.countdown) || { active: false };
      const deferred = (status && status.deferred) || { active: false };
      const handoff = (status && status.handoff) || { active: false };
      const desktop = status ? Boolean(status.desktop) : true;
      const waiting = (Boolean(deferred.active) || Boolean(handoff.active)) && !countdown.active;
      const armed = armUntil > Date.now();
      const armMs = armed ? Math.max(0, armUntil - Date.now()) : 0;
      const seconds = countdown.active ? Math.ceil(Math.max(0, countdown.restartAt - Date.now()) / 1000) : 0;

      async function post(path, body) {
        const response = await fetch(BASE + "/" + path, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body || {}),
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json().catch(() => ({}));
      }

      function hideRing() {
        goneRef.current = true;
        restartPid.current = bootPid.current;
        restartAt.current = Date.now();
        successAt.current = 0;
        setGone(true);
      }

      async function restartNow() {
        if (busy) return;
        setBusy(true);
        setArmUntil(0);
        try {
          await post("restart", { reason: "账号页圆环手动重启" });
          hideRing();
        } catch {
          // The shell may already be on its way down; nothing to undo.
        } finally {
          setBusy(false);
        }
      }

      async function cancelPending() {
        if (busy) return;
        setBusy(true);
        setArmUntil(0);
        try {
          await post("cancel", { by: "ring" });
        } catch {
          // Nothing queued, nothing to cancel.
        } finally {
          setBusy(false);
        }
      }

      function confirmRestart() {
        setAsk(false);
        setArmUntil(Date.now() + 3000);
      }

      function onRingClick(event) {
        if (busy) return;
        if (armed) {
          setArmUntil(0);
          return;
        }
        if (countdown.active || waiting) {
          cancelPending();
          return;
        }
        const node = event && event.currentTarget;
        if (node && node.getBoundingClientRect) {
          const rect = node.getBoundingClientRect();
          setAnchor({ left: Math.round(rect.left), top: Math.round(rect.top) });
        }
        setAsk(true);
      }

      React.useEffect(() => {
        if (!armed) return undefined;
        const id = setInterval(() => {
          if (armUntil - Date.now() <= 0) {
            clearInterval(id);
            restartNow();
          } else {
            tick();
          }
        }, 100);
        return () => clearInterval(id);
      }, [armed, armUntil, busy]);

      const label = !desktop
        ? "只能在桌面版使用"
        : armed
          ? Math.ceil(armMs / 1000) + " 秒后重启，点一下取消"
          : countdown.active
            ? seconds + " 秒后自动重启，点一下取消"
            : waiting
              ? "重启已排队，点一下取消"
              : "点一下手动重启";
      const glyph = !desktop
        ? "—"
        : armed
          ? Math.ceil(armMs / 1000) + "s"
          : waiting
            ? "❙❙"
            : countdown.active
              ? seconds + "s"
              : "↻";
      const tone = ask ? "error" : armed || waiting || countdown.active ? "warn" : "idle";
      const progress = armed
        ? (armMs / 3000) * 100
        : countdown.active
          ? Math.max(0, Math.min(100, (Math.max(0, countdown.restartAt - Date.now()) / (countdown.totalMs || 1)) * 100))
          : 0;

      const tile = h(
        "button",
        {
          type: "button",
          className: "rh-tile rh-tile--rail",
          style: { "--rh-nudge": nudge },
          "data-tone": tone,
          title: label,
          "aria-label": label,
          disabled: !desktop || busy,
          onClick: onRingClick,
        },
        h("span", { className: "rh-chip" }, h("span", { className: "rh-icon" + (waiting ? " rh-icon--pause" : " rh-icon--glyph") }, glyph)),
        armed || countdown.active || waiting
          ? h(
              "span",
              { className: "rh-dot", "data-paused": String(waiting && !armed && !countdown.active), style: { "--rh-progress": progress + "%" } },
              waiting && !armed && !countdown.active ? h("span", { className: "rh-dot-glyph" }, "❙") : null,
            )
          : null,
      );

      const popStyle = anchor
        ? { left: Math.max(10, anchor.left) + "px", top: Math.max(10, anchor.top - 42) + "px" }
        : undefined;

      const popover = ask
        ? h(
            "div",
            { className: "rh-pop", style: popStyle, role: "dialog", "aria-label": "现在重启吗" },
            h("span", { className: "rh-pop-text" }, "现在重启？"),
            h(
              "span",
              { className: "rh-pop-actions" },
              h("button", { type: "button", className: "rh-pop-btn rh-pop-yes", onClick: confirmRestart }, "是"),
              h("button", { type: "button", className: "rh-pop-btn", onClick: () => setAsk(false) }, "否"),
            ),
          )
        : null;

      return h("span", { className: "rh-slot", ref: slotRef }, tile, popover);
    }

    function Panel() {
      const [status, setStatus] = React.useState(null);
      const [error, setError] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [askConfirm, setAskConfirm] = React.useState(false);
      const [message, setMessage] = React.useState({ tone: "ok", text: "" });
      const [, tick] = React.useReducer((x) => x + 1, 0);
      const alive = React.useRef(true);

      React.useEffect(() => {
        ensureStyle();
      }, []);

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(BASE + "/status", { headers: { accept: "application/json" } });
          if (!response.ok) throw new Error("HTTP " + response.status);
          const value = await response.json();
          if (!alive.current) return;
          setStatus(value);
          setError("");
        } catch (cause) {
          if (alive.current) setError("读取状态失败：" + String((cause && cause.message) || cause));
        }
      }, []);

      React.useEffect(() => {
        alive.current = true;
        load();
        const id = setInterval(() => {
          if (typeof document !== "undefined" && document.hidden) return;
          load();
        }, 1000);
        const wake = () => {
          if (typeof document !== "undefined" && !document.hidden) load();
        };
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", wake);
        return () => {
          alive.current = false;
          clearInterval(id);
          if (typeof document !== "undefined") document.removeEventListener("visibilitychange", wake);
        };
      }, [load]);

      const counting = Boolean(status && status.countdown && status.countdown.active);
      React.useEffect(() => {
        if (!counting) return undefined;
        const id = setInterval(tick, 200);
        return () => clearInterval(id);
      }, [counting]);

      React.useEffect(() => {
        if (!message.text) return undefined;
        const id = setTimeout(() => setMessage({ tone: "ok", text: "" }), 4000);
        return () => clearTimeout(id);
      }, [message]);

      React.useEffect(() => {
        if (!askConfirm) return undefined;
        const id = setTimeout(() => setAskConfirm(false), 6000);
        return () => clearTimeout(id);
      }, [askConfirm]);

      const post = async (path, body) => {
        const response = await fetch(BASE + "/" + path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body || {}),
        });
        const value = await response.json().catch(() => ({}));
        if (!response.ok || value.ok === false) throw new Error(value.error || "HTTP " + response.status);
        return value;
      };

      const saveSettings = async (patch) => {
        setBusy(true);
        try {
          const value = await post("settings", patch);
          setStatus((current) => (current ? Object.assign({}, current, { settings: value.settings }) : current));
          setMessage({ tone: "ok", text: "已保存" });
          return true;
        } catch (cause) {
          setMessage({ tone: "error", text: "没保存上：" + String((cause && cause.message) || cause) });
          return false;
        } finally {
          setBusy(false);
        }
      };

      const cancel = async () => {
        setBusy(true);
        try {
          await post("cancel", { by: "panel" });
          setMessage({ tone: "ok", text: "好，这次不重启了" });
          await load();
        } catch (cause) {
          setMessage({ tone: "error", text: "取消失败：" + String((cause && cause.message) || cause) });
        } finally {
          setBusy(false);
        }
      };

      const restartNow = async () => {
        setAskConfirm(false);
        setBusy(true);
        try {
          await post("restart", { reason: "面板手动重启" });
          setMessage({ tone: "ok", text: "正在重开，稍等几秒…" });
        } catch (cause) {
          setMessage({ tone: "error", text: "重启失败：" + String((cause && cause.message) || cause) });
        } finally {
          setBusy(false);
        }
      };

      const settings = (status && status.settings) || {};
      const countdown = (status && status.countdown) || { active: false };
      const deferred = (status && status.deferred) || { active: false };
      const handoff = (status && status.handoff) || { active: false };
      const desktop = status ? Boolean(status.desktop) : true;
      const autoOn = settings.autoRestart !== false;
      const waiting = (Boolean(deferred.active) || Boolean(handoff.active)) && !countdown.active;
      const busyCount = Math.max(0, Number(status && status.busy && status.busy.count) || 0);

      const remainingMs = countdown.active ? Math.max(0, countdown.restartAt - Date.now()) : 0;
      const seconds = Math.ceil(remainingMs / 1000);
      const total = countdown.totalMs || 1;
      const progress = countdown.active ? Math.max(0, Math.min(100, (remainingMs / total) * 100)) : 0;

      // Only milestones belong in the short history people actually read.
      const SHOWN = ["restarting", "resumed", "resume-failed", "resume-given-up", "resume-expired", "failed", "cancelled"];
      const history = ((status && status.history) || [])
        .filter((entry) => SHOWN.indexOf(entry && entry.kind) !== -1)
        .slice(0, 5);

      let tone = "success";
      let emoji = "✓";
      let heroTitle = "现在不用重启";
      let heroSub = "你继续干活就行，需要重开的时候我自己处理。";
      let pillText = "守护中";
      let heroExtra = null;

      if (!desktop) {
        tone = "idle";
        emoji = "⛔";
        heroTitle = "只能在桌面版使用";
        heroSub = "这个功能要重开 macOS 上的 DSH 桌面程序，网页版用不了。";
        pillText = "不可用";
      } else if (countdown.active) {
        tone = "warn";
        emoji = "⌛";
        heroTitle = seconds + " 秒后自动重启";
        heroSub = "马上重开，几秒就回来。不想现在重开就按下面取消。";
        pillText = "即将重启";
        heroExtra = h(
          "div",
          { className: "ar-hero-actions" },
          h("button", { type: "button", className: "ar-btn ar-btn--danger", onClick: cancel, disabled: busy }, "先不重启"),
        );
      } else if (waiting) {
        tone = "warn";
        emoji = "❙❙";
        heroTitle = handoff.active ? "正在写「回来做什么」" : "等你忙完再重启";
        heroSub = handoff.active
          ? "我会先把「刚才做到哪、接着做什么」记下来，最多等 2 分钟。"
          : busyCount > 1
            ? "还有 " + busyCount + " 个任务在跑，等它们都结束我再动手。"
            : "这一轮说完就重开，不会把你的回复切一半。";
        pillText = "排队中";
        heroExtra = h(
          "div",
          { className: "ar-hero-actions" },
          h("button", { type: "button", className: "ar-btn ar-btn--quiet", onClick: cancel, disabled: busy }, "先不重启"),
        );
      } else if (!autoOn) {
        tone = "idle";
        emoji = "☾";
        heroTitle = "自动重启已关闭";
        heroSub = "需要重开的时候我不会自己动手，你可以在下面自己点。";
        pillText = "已暂停";
      }

      const manualButton = askConfirm
        ? h(
            "div",
            { className: "ar-hero-actions" },
            h("span", { className: "ar-hero-sub" }, "真的要现在重开吗？"),
            h("button", { type: "button", className: "ar-btn ar-btn--primary", onClick: restartNow, disabled: busy }, "确认重开"),
            h("button", { type: "button", className: "ar-btn ar-btn--quiet", onClick: () => setAskConfirm(false) }, "再等等"),
          )
        : h(
            "div",
            { className: "ar-hero-actions" },
            h(
              "button",
              { type: "button", className: "ar-btn", onClick: () => setAskConfirm(true), disabled: busy || !desktop },
              "现在重启",
            ),
          );

      return h(
        "div",
        { className: "ar-root" },

        h(
          "div",
          { className: "ar-head" },
          h(
            "div",
            null,
            h("h3", { className: "ar-title" }, "重启交接"),
            h("p", { className: "ar-sub" }, "改完插件、需要重开才生效时，它会等你忙完自动重开，回来接着干。"),
          ),
          h(
            "span",
            { className: "ar-pill", "data-tone": tone, role: "status", "aria-live": "polite" },
            h("span", { className: "ar-pill-dot" }),
            pillText,
          ),
        ),

        error ? h("p", { className: "ar-msg", "data-tone": "error" }, error) : null,

        h(
          "div",
          { className: "ar-hero", "data-tone": tone },
          countdown.active
            ? h("div", { className: "ar-ring", style: { "--ar-progress": progress + "%" } },
                h("div", { className: "ar-ring-core" }, seconds + "s"))
            : h("div", { className: "ar-hero-icon" }, emoji),
          h(
            "div",
            { className: "ar-hero-body" },
            h("p", { className: "ar-hero-title" }, heroTitle),
            h("p", { className: "ar-hero-sub" }, heroSub),
            countdown.active
              ? h("div", { className: "ar-bar" }, h("div", { className: "ar-bar-fill", style: { width: progress + "%" } }))
              : null,
          ),
          countdown.active || waiting ? heroExtra : manualButton,
        ),

        message.text ? h("p", { className: "ar-msg", "data-tone": message.tone }, message.text) : null,

        h(
          "div",
          { className: "ar-card" },
          h("p", { className: "ar-card-title" }, "常用"),
          h(Row, {
            label: "需要重开时自动帮我重启",
            desc: "改完插件、装了新东西，需要重开才生效时，我自动处理。",
            checked: autoOn,
            disabled: busy || !desktop || !status,
            onChange: (value) => saveSettings({ autoRestart: value }),
          }),
          h(Row, {
            label: "等所有任务都做完再重启",
            desc: "不打断正在跑的对话、子任务和别的窗口。",
            checked: settings.waitForAllSessions !== false,
            disabled: busy || !desktop || !status,
            onChange: (value) => saveSettings({ waitForAllSessions: value }),
          }),
          h(Row, {
            label: "重启后自动接着做",
            desc: "回来之后我自己知道刚才做到哪、接下来做什么，不用你再说一遍。",
            checked: settings.resumeAfterRestart !== false,
            disabled: busy || !desktop || !status,
            onChange: (value) => saveSettings({ resumeAfterRestart: value }),
          }),
        ),

        h(
          "details",
          { className: "ar-more" },
          h(
            "summary",
            null,
            h("span", null, "更多设置"),
            h("span", { className: "ar-chevron" }, "⌄"),
          ),
          h(Row, {
            label: "允许我主动申请重启",
            desc: "有些时候我会自己判断需要重开，这条关掉就只能靠面板按钮。",
            checked: settings.toolEnabled !== false,
            disabled: busy || !desktop || !status,
            onChange: (value) => saveSettings({ toolEnabled: value }),
          }),
          h(Row, {
            label: "每轮说完再动手",
            desc: "等这一轮回答完整说完、结果送到你眼前再退出。",
            checked: settings.deferUntilIdle !== false,
            disabled: busy || !desktop || !status,
            onChange: (value) => saveSettings({ deferUntilIdle: value }),
          }),
          h(Row, {
            label: "顺手清理过时的登录记录",
            desc: "每次启动都会留一条登录痕迹，重开时只保留最新的那条。",
            checked: settings.pruneAuthCookies !== false,
            disabled: busy || !desktop || !status,
            onChange: (value) => saveSettings({ pruneAuthCookies: value }),
          }),
        ),

        h(TemplateEditor, {
          settings,
          preview: status && status.preview,
          defaultTemplate: status && status.defaultTemplate,
          disabled: busy || !desktop || !status,
          save: saveSettings,
        }),

        h(
          "div",
          { className: "ar-card" },
          h("p", { className: "ar-card-title" }, "最近"),
          history.length === 0
            ? h("p", { className: "ar-empty" }, "还没有重启记录。")
            : h(
                "ul",
                { className: "ar-log" },
                history.map((entry, index) => {
                  const kind = KIND[entry.kind] || { label: entry.kind || "事件", tone: "idle" };
                  const detail = [entry.reason, entry.detail, entry.error]
                    .filter((part) => typeof part === "string" && part !== "")
                    .join(" · ");
                  return h(
                    "li",
                    { className: "ar-item", key: String(entry.time) + "-" + index },
                    h("span", { className: "ar-dot", "data-tone": kind.tone }),
                    h("span", { className: "ar-item-label" }, kind.label),
                    h("span", { className: "ar-item-when" }, ago(entry.time)),
                    detail ? h("span", { className: "ar-item-detail" }, detail) : null,
                  );
                }),
              ),
        ),

        h(
          "details",
          { className: "ar-foot" },
          h("summary", null, "技术详情"),
          h(
            "div",
            { className: "ar-foot-body" },
            status && status.bootedAt ? h("span", null, "本次启动于 " + fullClock(status.bootedAt)) : null,
            h("span", null, "日志：" + String((status && status.logPath) || "—")),
          ),
        ),
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          { name: "settings.section", id: "restart-handoff", order: 91, label: () => "重启交接", inject: () => ({}) },
          Panel,
        ),
      );
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register(
          { name: "sidebar.footer.action", id: "restart-handoff-ring", order: 90, label: () => "重启", inject: () => ({}) },
          Ring,
        ),
      );
    }

    exports.name = "restart-handoff";
    exports.inject = ["slots"];
    exports.apply = apply;
    return module.exports;
  },
});