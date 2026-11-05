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

    const CSS = `/* Restart hand-off — styled as one of the host's own settings sections.
   Every dimension below is a host token: radii 4/8/12/16, text 14-12-11 on
   20/18/16 line boxes, hairline separators, no shadows inside the panel. */

.rhs {
  display: flex; flex-direction: column; gap: 16px;
  max-width: 720px; padding: 2px 0 20px;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 14px; line-height: 20px;
}
.rhs, .rhs * { box-sizing: border-box; }
.rhs h3, .rhs p { margin: 0; }

.rhs-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.rhs-title { font-size: 14px; line-height: 20px; font-weight: 600; }
.rhs-sub {
  margin-top: 4px; max-width: 58ch; color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px; line-height: 18px;
}
.rhs-badge {
  flex: none; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.32));
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px; line-height: 18px; white-space: nowrap;
}
.rhs-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary, #999); }
.rhs-badge[data-tone="success"] .rhs-badge-dot { background: var(--dsw-alias-state-success-primary, #1a9c53); }
.rhs-badge[data-tone="warn"] .rhs-badge-dot { background: var(--dsw-alias-state-warn-primary, #c07f0a); }
.rhs-badge[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary, #c07f0a); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c07f0a) 40%, transparent); }

/* Status block: one sentence a person can read at a glance, with the countdown
   reduced to a number and a rule instead of a dial. */
.rhs-status {
  display: flex; flex-direction: column; gap: 12px; padding: 14px 16px;
  border-radius: var(--dsw-radius-md, 12px);
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.22));
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.04));
}
.rhs-status[data-tone="warn"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c07f0a) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c07f0a) 7%, var(--dsw-alias-bg-layer-1, transparent));
}
.rhs-status-main { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.rhs-status-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rhs-status-title { font-size: 15px; line-height: 22px; font-weight: 600; }
.rhs-status-sub { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }

.rhs-timer {
  flex: none; display: flex; align-items: baseline; gap: 3px;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-state-warn-primary, #c07f0a);
}
.rhs-timer-num { font-size: 24px; line-height: 28px; font-weight: 600; letter-spacing: -0.02em; }
.rhs-timer-unit { font-size: 12px; line-height: 18px; }

.rhs-meter { height: 3px; border-radius: 999px; background: var(--dsw-alias-border-l1, rgba(127,127,127,0.25)); overflow: hidden; }
.rhs-meter-fill {
  display: block; height: 100%; border-radius: inherit;
  background: var(--dsw-alias-state-warn-primary, #c07f0a);
  transition: width 0.2s linear;
}

.rhs-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.rhs-actions-note { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }

/* Buttons mirror the host: 32px tall, 8px radius, 13/20 medium. */
.rhs-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: var(--dsw-radius-sm, 8px);
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.32));
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  font: inherit; font-size: 13px; line-height: 20px; font-weight: 500;
  white-space: nowrap; cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}
.rhs-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08)); }
.rhs-btn:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4b7bec));
  outline-offset: 1px;
}
.rhs-btn:disabled { opacity: 0.45; cursor: default; }
.rhs-btn--primary {
  border-color: transparent; background: var(--dsw-alias-brand-primary, #4b7bec); color: #fff;
}
.rhs-btn--primary:hover:not(:disabled) { background: var(--dsw-alias-brand-primary, #4b7bec); filter: brightness(1.06); }
.rhs-btn--quiet { border-color: transparent; color: var(--dsw-alias-label-secondary, inherit); }
.rhs-btn--quiet:hover:not(:disabled) { color: var(--dsw-alias-label-primary, inherit); }

/* Sections are plain lists separated by hairlines, like the host's own rows. */
.rhs-section { display: flex; flex-direction: column; }
.rhs-section-title {
  padding-bottom: 2px; color: var(--dsw-alias-label-tertiary, inherit);
  font-size: 12px; line-height: 18px; font-weight: 600; letter-spacing: 0.02em;
}
.rhs-row {
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  padding: 14px 0; border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.24));
}
.rhs-section > .rhs-row:last-child { border-bottom: none; }
.rhs-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rhs-row-label { font-size: 14px; line-height: 20px; }
.rhs-row-desc { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }

/* Switch: 36×20 with a 16px knob, brand-filled when on. */
.rhs-switch {
  position: relative; flex: none; width: 36px; height: 20px; padding: 0;
  border: 0; border-radius: 999px; cursor: pointer;
  background: var(--dsw-alias-border-l4, rgba(127,127,127,0.45));
  transition: background 0.16s ease, opacity 0.16s ease;
}
.rhs-switch[data-on="true"] { background: var(--dsw-alias-brand-primary, #4b7bec); }
.rhs-switch:disabled { opacity: 0.45; cursor: default; }
.rhs-switch:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4b7bec));
  outline-offset: 2px;
}
.rhs-knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1, #fff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
  transition: transform 0.16s ease;
}
/* The track is the label color in dark themes, so the knob follows the surface
   underneath instead of staying white-on-white. */
.rhs-switch[data-on="true"] .rhs-knob { background: var(--dsw-alias-bg-base, #fff); }
.rhs-switch[data-on="true"] .rhs-knob { transform: translateX(16px); }

/* Folding headers (more settings / technical detail). */
.rhs-more { border-top: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.24)); }
.rhs-more > summary {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 0; cursor: pointer; list-style: none;
  font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary, inherit);
}
.rhs-more > summary::-webkit-details-marker { display: none; }
.rhs-more > summary:hover { color: var(--dsw-alias-label-primary, inherit); }
.rhs-more > summary:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4b7bec));
  outline-offset: 2px; border-radius: var(--dsw-radius-xs, 4px);
}
.rhs-chevron { color: var(--dsw-alias-label-tertiary, inherit); font-size: 12px; transition: transform 0.18s ease; }
.rhs-more[open] > summary .rhs-chevron { transform: rotate(180deg); }

/* Template editor. */
.rhs-hint { margin-top: 6px !important; color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }
.rhs-textarea {
  display: block; width: 100%; min-height: 132px; margin-top: 10px; padding: 10px 12px;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.32));
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06));
  color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit;
  font-size: 13px; line-height: 20px; resize: vertical;
}
.rhs-textarea:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4b7bec));
  outline-offset: 0; border-color: transparent;
}
.rhs-textarea:disabled { opacity: 0.5; }
.rhs-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rhs-chip {
  height: 24px; padding: 0 8px; border-radius: var(--dsw-radius-xs, 4px); cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.32));
  background: transparent; color: var(--dsw-alias-label-secondary, inherit);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 12px; line-height: 22px;
  transition: background 0.15s ease, color 0.15s ease;
}
.rhs-chip:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08)); color: var(--dsw-alias-label-primary, inherit); }
.rhs-chip:disabled { opacity: 0.45; cursor: default; }
.rhs-line { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.rhs-note { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }
.rhs-preview-label { margin-top: 14px !important; color: var(--dsw-alias-label-tertiary, inherit); font-size: 12px; line-height: 18px; font-weight: 600; }
.rhs-preview {
  margin: 6px 0 0; padding: 12px 14px; max-height: 260px; overflow: auto;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.22));
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06));
  font-family: inherit; font-size: 13px; line-height: 20px;
  overflow-wrap: anywhere;
}
.rhs-preview p { margin: 0 0 8px; }
.rhs-preview p:last-child { margin-bottom: 0; }
.rhs-preview-h { font-weight: 600; font-size: 15px; line-height: 22px; color: var(--dsw-alias-label-primary, inherit); }
.rhs-preview-li { padding-left: 12px; text-indent: -12px; }
.rhs-preview-p { color: var(--dsw-alias-label-secondary, inherit); }
.rhs-preview-empty { color: var(--dsw-alias-label-tertiary, inherit); }
}

.rhs-msg { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, inherit); }
.rhs-msg[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #cf3b3b); }
.rhs-msg[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary, #b07a1d); }

/* History. */
.rhs-log { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.rhs-item {
  display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center;
  column-gap: 10px; row-gap: 2px; padding: 10px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.24));
}
.rhs-item:last-child { border-bottom: none; }
.rhs-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary, #999); }
.rhs-dot[data-tone="success"] { background: var(--dsw-alias-state-success-primary, #1a9c53); }
.rhs-dot[data-tone="warn"] { background: var(--dsw-alias-state-warn-primary, #c07f0a); }
.rhs-dot[data-tone="error"] { background: var(--dsw-alias-state-error-primary, #cf3b3b); }
.rhs-item-label { font-size: 13px; line-height: 20px; }
.rhs-item-when { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rhs-item-detail { grid-column: 2 / -1; color: var(--dsw-alias-label-tertiary, inherit); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.rhs-empty { color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }
.rhs-foot-body { display: flex; flex-direction: column; gap: 4px; padding: 0 0 12px; color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }
.rhs-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; overflow-wrap: anywhere; }

/* Sidebar footer ring (sits on the account row, so it keeps that row's geometry). */
.rh-slot { position: relative; display: inline-flex; align-items: center; width: 100%; }
.rh-tile {
  position: relative; display: flex; align-items: center; gap: 8px;
  width: calc(100% + 4px); margin: 0 -2px; height: 44px; padding: 6px;
  border: 0; border-radius: var(--dsw-radius-md, 12px); background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
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
.rh-tile:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4b7bec));
  outline-offset: -2px;
}
.rh-tile:disabled { opacity: 0.45; cursor: not-allowed; }
.rh-tile[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary, #b0741d); }
.rh-tile[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #c0392b); }
/* One signal in the sidebar: a single chip. While a restart is pending it draws
   the countdown as a ring around itself instead of a second, unreadable dot. */
.rh-chip {
  position: relative; flex: none; display: grid; place-items: center;
  width: 30px; height: 30px; border-radius: 50%;
  background: color-mix(in srgb, currentColor 10%, transparent);
  font-size: 14px; line-height: 1;
}
.rh-chip[data-progress="true"] {
  font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 500;
  background: conic-gradient(currentColor var(--rh-progress, 0%), color-mix(in srgb, currentColor 16%, transparent) 0);
}
.rh-chip[data-progress="true"]::after {
  content: ""; position: absolute; inset: 2px; border-radius: 50%;
  background: var(--dsw-alias-bg-base, #fff);
}
.rh-chip[data-paused="true"] {
  font-size: 9px; letter-spacing: 1px;
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.rh-chip-text { position: relative; z-index: 1; display: grid; place-items: center; }

/* The restart confirmation, matched to the host's popover: 12px radius,
   prominent elevation, a title, one line of consequences, two buttons. */
.rh-pop {
  position: fixed; z-index: 61; width: 268px; padding: 14px;
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, #fff);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.32));
  box-shadow: var(--dsw-elevation-prominent, 0 8px 24px rgba(0, 0, 0, 0.16));
  color: var(--dsw-alias-label-primary, inherit);
}
.rh-pop-title { margin: 0; font-size: 14px; line-height: 20px; font-weight: 600; }
.rh-pop-sub { margin: 6px 0 12px; color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }
.rh-pop-actions { display: flex; justify-content: flex-end; gap: 8px; }
.rh-pop-actions .rhs-btn--quiet { margin-inline-end: auto; }
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

    // The server answers a restart it refuses instead of failing the request, so
    // every entry point has to read the status before it claims anything.
    function describeRefusal(value) {
      const status = value && value.status;
      if (!status || status === "scheduled") return "";
      if (status === "cooldown") {
        const wait = Math.max(1, Math.ceil(Number(value.retryInMs) / 1000));
        return "刚重启过，再等 " + wait + " 秒";
      }
      if (status === "already-scheduled") return "已经排好了，稍等就行";
      if (status === "already-deferred") return "已经排好了，这一轮答完就重开";
      if (status === "unsupported") return "只能在桌面版里重启";
      if (status === "disabled") return "自动重启已关掉，先打开它";
      return "";
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
        className: "rhs-switch",
        disabled: props.disabled,
        onClick: () => props.onChange(!props.checked),
      }, h("span", { className: "rhs-knob" }));
    }

    function Row(props) {
      return h(
        "div",
        { className: "rhs-row" },
        h(
          "div",
          { className: "rhs-row-text" },
          h("span", { className: "rhs-row-label" }, props.label),
          props.desc ? h("span", { className: "rhs-row-desc" }, props.desc) : null,
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
      const shown = saved || fallback;
      const [draft, setDraft] = React.useState(shown);
      const [preview, setPreview] = React.useState(String(props.preview || ""));
      const [error, setError] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [dirty, setDirty] = React.useState(false);
      const timer = React.useRef(null);
      const latest = React.useRef(draft);

      // Adopt a template changed elsewhere (another window, or a save landing).
      React.useEffect(() => {
        if (dirty) return;
        const next = saved || fallback;
        if (draft !== next) {
          setDraft(next);
          latest.current = next;
        }
      }, [saved, fallback]);

      // The first paint happens before /status lands, so adopt the server's
      // preview once it arrives.
      React.useEffect(() => {
        if (dirty || !props.preview) return;
        if (preview !== props.preview) setPreview(String(props.preview));
      }, [props.preview]);

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
          // Saving the untouched default keeps the setting empty, so a later
          // release can improve the default instead of pinning this copy.
          const value = latest.current;
          const ok = await props.save({
            continuationTemplate: fallback && value.trim() === fallback.trim() ? "" : value,
          });
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
        setDraft(fallback);
        latest.current = fallback;
        setDirty(false);
        askPreview(fallback);
      };

      return h(
        "div",
        { className: "rhs-section" },
        h("p", { className: "rhs-section-title" }, "交接话模板"),
        h(
          "p",
          { className: "rhs-hint" },
          "重启后那段话长什么样，由这里决定。模型只填内容、排版照模板走；哪一项没填，那一行整行不显示。空一行分段；标题用 ##，分行用 -，别用星号。",
        ),
        h("textarea", {
          className: "rhs-textarea",
          rows: 9,
          spellCheck: false,
          value: draft,
          disabled: props.disabled || busy,
          // Belt and braces: renderers that only set attributes leave a
          // textarea blank, so mirror the value onto the element as well.
          ref: (el) => {
            if (el && typeof el === "object" && "value" in el && el.value !== draft) el.value = draft;
          },
          onChange: (event) => edit(event.target.value),
        }),
        h(
          "div",
          { className: "rhs-chips" },
          ["reason", "progress", "next", "skip", "session", "time"].map((field) =>
            h(
              "button",
              {
                type: "button",
                key: field,
                className: "rhs-chip",
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
          { className: "rhs-line" },
          h(
            "button",
            {
              type: "button",
              className: "rhs-btn" + (dirty ? " rhs-btn--primary" : ""),
              disabled: props.disabled || busy || !dirty,
              onClick: save,
            },
            dirty ? "保存模板" : "已保存",
          ),
          h(
            "button",
            { type: "button", className: "rhs-btn rhs-btn--quiet", disabled: props.disabled || busy, onClick: reset },
            "恢复默认",
          ),
          dirty ? h("span", { className: "rhs-note" }, "改了还没保存") : null,
        ),
        error ? h("p", { className: "rhs-msg", "data-tone": "error" }, error) : null,
        h("p", { className: "rhs-preview-label" }, "重启后会看到"),
        h("div", { className: "rhs-preview" }, renderPreview(preview)),
      );
    }

    // A rough stand-in for the chat renderer: headings shrink to bold lines and
    // "- " becomes a bullet, so the preview shows what the next session reads
    // instead of raw Markdown.
    function renderPreview(text) {
      const body = String(text || "").trim();
      if (!body) return [h("span", { className: "rhs-preview-empty" }, "（空，重启后只有一句兜底）")];
      return body.split(/\n+/).map((line, index) => {
        const heading = /^#{1,6}\s+(.*)$/.exec(line);
        if (heading) return h("p", { key: index, className: "rhs-preview-h" }, heading[1]);
        const bullet = /^[-*]\s+(.*)$/.exec(line);
        if (bullet) return h("p", { key: index, className: "rhs-preview-li" }, "· " + bullet[1]);
        return h("p", { key: index, className: "rhs-preview-p" }, line);
      });
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
      // A tap the server refused (cooldown, already queued) has nowhere to print
      // a message, so the chip itself says how long is left for a moment.
      const [flash, setFlash] = React.useState("");
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
      const host = (status && status.host) || (desktop ? "desktop" : null);
      const canRestart = host === "desktop" || host === "web";
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
          const value = await post("restart", { reason: "账号页圆环手动重启" });
          const refused = describeRefusal(value);
          if (refused) {
            setFlash(String(Math.max(1, Math.ceil(Number(value && value.retryInMs) / 1000))) + "s");
            return;
          }
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
        if (!flash) return undefined;
        const id = setTimeout(() => setFlash(""), 2400);
        return () => clearTimeout(id);
      }, [flash]);

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

      const label = !canRestart
        ? "只能在桌面版或 dsh web 里使用"
        : armed
          ? Math.ceil(armMs / 1000) + " 秒后重启，点一下取消"
          : countdown.active
            ? seconds + " 秒后自动重启，点一下取消"
            : waiting
              ? "重启已排队，点一下取消"
              : "点一下手动重启";
      const glyph = flash
        ? flash
        : !canRestart
        ? "—"
        : armed
          ? Math.ceil(armMs / 1000) + "s"
          : waiting
            ? "❙❙"
            : countdown.active
              ? seconds + "s"
              : "↻";
      const tone = ask ? "error" : flash || armed || waiting || countdown.active ? "warn" : "idle";
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
          disabled: !canRestart || busy,
          onClick: onRingClick,
        },
        h(
          "span",
          {
            className: "rh-chip",
            "data-progress": String(!flash && (armed || countdown.active)),
            "data-paused": String(waiting && !armed && !countdown.active),
            style: { "--rh-progress": progress + "%" },
          },
          h("span", { className: "rh-chip-text" }, glyph),
        ),
      );

      // The confirmation opens above the sidebar tile: title, one line of
      // consequences, then the two choices. Escape and click-outside both close it.
      const popWidth = 268;
      const viewport = typeof window !== "undefined" ? window.innerWidth : 0;
      const popLeft = anchor
        ? Math.max(10, Math.min(anchor.left, Math.max(10, viewport - popWidth - 12)))
        : 12;
      const popStyle = anchor ? { left: popLeft + "px", top: Math.max(10, anchor.top - 132) + "px" } : undefined;

      React.useEffect(() => {
        if (!ask) return undefined;
        const onKey = (event) => {
          if (event.key === "Escape") setAsk(false);
        };
        if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
        return () => {
          if (typeof window !== "undefined") window.removeEventListener("keydown", onKey);
        };
      }, [ask]);

      const popover = ask
        ? h(
            "div",
            { className: "rh-pop", style: popStyle, role: "dialog", "aria-modal": "false", "aria-label": "现在重启吗" },
            h("p", { className: "rh-pop-title" }, "现在重启？"),
            h("p", { className: "rh-pop-sub" }, "正在跑的任务会先停下，重开完成后自动继续。"),
            h(
              "div",
              { className: "rh-pop-actions" },
              h("button", { type: "button", className: "rhs-btn rhs-btn--quiet", onClick: () => setAsk(false) }, "取消"),
              h("button", { type: "button", className: "rhs-btn rhs-btn--primary", onClick: confirmRestart }, "重启"),
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
          const value = await post("restart", { reason: "面板手动重启" });
          const blocked = describeRefusal(value);
          if (blocked) {
            // Waiting is not a failure: amber, not red.
            setMessage({ tone: "warn", text: blocked });
            return;
          }
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
      const host = (status && status.host) || (desktop ? "desktop" : null);
      const canRestart = host === "desktop" || host === "web";
      const webHost = host === "web";
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
      let heroTitle = "现在不用重启";
      let heroSub = "你继续干活就行，需要重开的时候我自己处理。";
      let pillText = "守护中";
      let actions = null;

      if (!canRestart) {
        tone = "idle";
        heroTitle = "这里不用重启";
        heroSub = "自动重启只对 DSH 桌面版和 dsh web 宿主有意义；headless、脚本这类一次性进程不用它操心。";
        pillText = "不适用";
      } else if (countdown.active) {
        tone = "warn";
        heroTitle = "即将自动重启";
        heroSub = webHost
          ? "重开只要几秒，回来后浏览器会新开一个标签，这个标签会失效。"
          : "重开只要几秒，回来接着干活；不想现在重开就取消。";
        pillText = "即将重启";
        actions = h(
          "div",
          { className: "rhs-actions" },
          h("button", { type: "button", className: "rhs-btn rhs-btn--quiet", onClick: cancel, disabled: busy }, "取消重启"),
        );
      } else if (waiting) {
        tone = "warn";
        heroTitle = handoff.active ? "正在写「回来做什么」" : "等你忙完再重启";
        heroSub = handoff.active
          ? "我会先把「刚才做到哪、接着做什么」记下来，最多等 " + Math.max(1, Math.round((status && status.handoffWindowMs ? status.handoffWindowMs : 120000) / 60000)) + " 分钟。"
          : busyCount > 1
            ? "还有 " + busyCount + " 个任务在跑，等它们都结束我再动手。"
            : "这一轮说完就重开，不会把你的回复切一半。";
        pillText = "排队中";
        actions = h(
          "div",
          { className: "rhs-actions" },
          h("button", { type: "button", className: "rhs-btn rhs-btn--quiet", onClick: cancel, disabled: busy }, "先不重启"),
        );
      } else if (!autoOn) {
        tone = "idle";
        heroTitle = "自动重启已关闭";
        heroSub = "需要重开的时候我不会自己动手，你可以在下面自己点。";
        pillText = "已暂停";
      }

      if (!actions && canRestart) {
        actions = askConfirm
          ? h(
              "div",
              { className: "rhs-actions" },
              h(
                "span",
                { className: "rhs-actions-note" },
                webHost ? "确定现在重启？重开后浏览器会新开一个标签。" : "确定现在重启？重开大约要几秒。",
              ),
              h("button", { type: "button", className: "rhs-btn rhs-btn--primary", onClick: restartNow, disabled: busy }, "重启"),
              h("button", { type: "button", className: "rhs-btn rhs-btn--quiet", onClick: () => setAskConfirm(false) }, "取消"),
            )
          : h(
              "div",
              { className: "rhs-actions" },
              h(
                "button",
                { type: "button", className: "rhs-btn", onClick: () => setAskConfirm(true), disabled: busy },
                "现在重启",
              ),
              webHost
                ? h("span", { className: "rhs-actions-note" }, "web 端重启后会新开一个标签，这个会失效")
                : null,
            );
      }

      return h(
        "div",
        { className: "rhs" },

        h(
          "div",
          { className: "rhs-head" },
          h(
            "div",
            null,
            h("h3", { className: "rhs-title" }, "重启交接"),
            h("p", { className: "rhs-sub" }, "改完插件、需要重开才生效时，它会等你忙完自动重开，回来接着干。"),
          ),
          h(
            "span",
            { className: "rhs-badge", "data-tone": tone, role: "status", "aria-live": "polite" },
            h("span", { className: "rhs-badge-dot" }),
            pillText,
          ),
        ),

        error ? h("p", { className: "rhs-msg", "data-tone": "error" }, error) : null,

        h(
          "div",
          { className: "rhs-status", "data-tone": tone },
          h(
            "div",
            { className: "rhs-status-main" },
            h(
              "div",
              { className: "rhs-status-text" },
              h("p", { className: "rhs-status-title" }, heroTitle),
              h("p", { className: "rhs-status-sub" }, heroSub),
            ),
            countdown.active
              ? h(
                  "div",
                  { className: "rhs-timer" },
                  h("span", { className: "rhs-timer-num" }, String(seconds)),
                  h("span", { className: "rhs-timer-unit" }, "秒"),
                )
              : null,
          ),
          countdown.active
            ? h(
                "div",
                {
                  className: "rhs-meter",
                  role: "progressbar",
                  "aria-label": "距离重启",
                  "aria-valuemin": 0,
                  "aria-valuemax": 100,
                  "aria-valuenow": Math.round(progress),
                },
                h("span", { className: "rhs-meter-fill", style: { width: Math.max(2, progress) + "%" } }),
              )
            : null,
          actions,
        ),

        message.text ? h("p", { className: "rhs-msg", "data-tone": message.tone }, message.text) : null,

        h(
          "div",
          { className: "rhs-section" },
          h("p", { className: "rhs-section-title" }, "常用"),
          h(Row, {
            label: "需要重开时自动帮我重启",
            desc: "改完插件、装了新东西，需要重开才生效时，我自动处理。",
            checked: autoOn,
            disabled: busy || !status,
            onChange: (value) => saveSettings({ autoRestart: value }),
          }),
          h(Row, {
            label: "等所有任务都做完再重启",
            desc: "不打断正在跑的对话、子任务和别的窗口。",
            checked: settings.waitForAllSessions !== false,
            disabled: busy || !status,
            onChange: (value) => saveSettings({ waitForAllSessions: value }),
          }),
          h(Row, {
            label: "重启后自动接着做",
            desc: "回来之后我自己知道刚才做到哪、接下来做什么，不用你再说一遍。",
            checked: settings.resumeAfterRestart !== false,
            disabled: busy || !status,
            onChange: (value) => saveSettings({ resumeAfterRestart: value }),
          }),
        ),

        h(
          "details",
          { className: "rhs-more" },
          h(
            "summary",
            null,
            h("span", null, "更多设置"),
            h("span", { className: "rhs-chevron" }, "⌄"),
          ),
          h(Row, {
            label: "允许我主动申请重启",
            desc: "有些时候我会自己判断需要重开，这条关掉就只能靠面板按钮。",
            checked: settings.toolEnabled !== false,
            disabled: busy || !status,
            onChange: (value) => saveSettings({ toolEnabled: value }),
          }),
          h(Row, {
            label: "每轮说完再动手",
            desc: "等这一轮回答完整说完、结果送到你眼前再退出。",
            checked: settings.deferUntilIdle !== false,
            disabled: busy || !status,
            onChange: (value) => saveSettings({ deferUntilIdle: value }),
          }),
          h(Row, {
            label: "顺手清理过时的登录记录",
            desc: "每次启动都会留一条登录痕迹，重开时只保留最新的那条。",
            checked: settings.pruneAuthCookies !== false,
            disabled: busy || !status,
            onChange: (value) => saveSettings({ pruneAuthCookies: value }),
          }),
        ),

        h(TemplateEditor, {
          settings,
          preview: status && status.preview,
          defaultTemplate: status && status.defaultTemplate,
          disabled: busy || !status,
          save: saveSettings,
        }),

        h(
          "div",
          { className: "rhs-section" },
          h("p", { className: "rhs-section-title" }, "最近"),
          history.length === 0
            ? h("p", { className: "rhs-empty" }, "还没有重启记录。")
            : h(
                "ul",
                { className: "rhs-log" },
                history.map((entry, index) => {
                  const kind = KIND[entry.kind] || { label: entry.kind || "事件", tone: "idle" };
                  const detail = [entry.reason, entry.detail, entry.error]
                    .filter((part) => typeof part === "string" && part !== "")
                    .join(" · ");
                  return h(
                    "li",
                    { className: "rhs-item", key: String(entry.time) + "-" + index },
                    h("span", { className: "rhs-dot", "data-tone": kind.tone }),
                    h("span", { className: "rhs-item-label" }, kind.label),
                    h("span", { className: "rhs-item-when" }, ago(entry.time)),
                    detail ? h("span", { className: "rhs-item-detail" }, detail) : null,
                  );
                }),
              ),
        ),

        h(
          "details",
          { className: "rhs-more" },
          h("summary", null, h("span", null, "技术详情"), h("span", { className: "rhs-chevron" }, "⌄")),
          h(
            "div",
            { className: "rhs-foot-body" },
            status && status.bootedAt ? h("span", null, "本次启动于 " + fullClock(status.bootedAt)) : null,
            h("span", { className: "rhs-mono" }, "日志：" + String((status && status.logPath) || "—")),
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