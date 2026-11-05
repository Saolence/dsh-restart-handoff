/**
 * dsh-restart-handoff — durable state.
 *
 * Everything the plugin must survive a host restart lives here, ordinary
 * JSON files under `~/.dsh/restart-handoff/`:
 *
 *   pending.json      the "continue after restart" request (written BEFORE kill)
 *   settings.json     user toggles
 *   history.jsonl     last few restart events, for the settings panel
 *   last-restart.json when the last restart happened (survives a reboot)
 *
 * The Host process owns these files; they are not session data, so they must
 * not pretend to be a Session event.
 */
import fs from "node:fs";
import os from "node:os";
import { join } from "node:path";

export const DEFAULT_SETTINGS = {
  /** Restart automatically after a change reports `application: 'restart-required'`. */
  autoRestart: true,
  /** Grace period before the automatic restart, so the user can cancel it. */
  graceMs: 5000,
  /** Let the agent call the `restart_handoff` tool. */
  toolEnabled: true,
  /** Inject a continuation prompt into the original session after the restart. */
  resumeAfterRestart: true,
  deferUntilIdle: true,
  /**
   * Never cut off a *different* Session: after this Session reports idle, keep
   * waiting until every live agent (other sessions, subagents, teammates) stops.
   */
  waitForAllSessions: true,
  /**
   * Drop the stale `dsh-auth-*` cookies earlier launches left behind. One is
   * issued per boot and nothing prunes them, so the request header keeps growing
   * until the server starts answering 4xx.
   */
  pruneAuthCookies: true,
  /** Give up resuming after this many boot attempts. */
  maxAttempts: 3,
  /** Never restart twice within this window. */
  cooldownMs: 60000,
  /**
   * The hand-off layout. The model fills structured fields, this template lays
   * them out; an empty string falls back to DEFAULT_CONTINUATION_TEMPLATE.
   */
  continuationTemplate: "",
};

/** Placeholders the template may use. Anything else is rejected at save time. */
export const TEMPLATE_FIELDS = ["reason", "progress", "next", "skip", "session", "time"];

export const DEFAULT_CONTINUATION_TEMPLATE = [
  "🔄 **DSH 已重启完成** · {{time}}",
  "",
  "- **为什么**：{{reason}}",
  "",
  "- **做到哪**：{{progress}}",
  "",
  "- **下一步**：{{next}}",
  "",
  "- **别重做**：{{skip}}",
].join("\n");

/**
 * Split a template into text and `{field}` pieces. Unknown placeholders are
 * returned so callers can refuse the template instead of shipping it.
 */
export function parseTemplate(template) {
  const pieces = [];
  const unknown = [];
  const text = String(template ?? "");
  const pattern = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) pieces.push({ kind: "text", value: text.slice(cursor, match.index) });
    const field = match[1];
    if (TEMPLATE_FIELDS.includes(field)) pieces.push({ kind: "field", value: field });
    else unknown.push(field);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) pieces.push({ kind: "text", value: text.slice(cursor) });
  return { pieces, unknown };
}

/** Every placeholder mentioned in the template, in order, without repeats. */
export function templateFields(template) {
  return parseTemplate(template).pieces.filter((piece) => piece.kind === "field").map((piece) => piece.value);
}

/**
 * A malformed or unknown-placeholder template is a save-time error, not a
 * silent fallback: the whole point of the template is that it always renders
 * the way the user set it up.
 */
export function validateTemplate(template) {
  if (typeof template !== "string") return "模板必须是字符串";
  if (template.length > 4000) return "模板太长了（上限 4000 字）";
  const { unknown } = parseTemplate(template);
  if (unknown.length) {
    const names = [...new Set(unknown)].join("、");
    return `不认识的占位符：${names}。可用的只有 ${TEMPLATE_FIELDS.map((name) => `{{${name}}}`).join("、")}`;
  }
  if (!templateFields(template).length && template.trim()) return "模板里至少要用一个占位符，否则重启后看到的永远是同一句话";
  return null;
}

/** Keep the on-disk log bounded; the helper appends to the same file. */
const LOG_ROTATE_BYTES = 1024 * 1024;
/** Keep the history file bounded; the panel only ever shows the last few. */
const HISTORY_TRIM_BYTES = 512 * 1024;
const HISTORY_KEEP_LINES = 400;
/** How much of the tail `readHistory` reads for a small number of lines. */
const HISTORY_TAIL_BYTES = 64 * 1024;

export function stateDir() {
  return process.env.DSH_RESTART_HANDOFF_DIR || join(os.homedir(), ".dsh", "restart-handoff");
}

export function logPath() {
  return process.env.DSH_RESTART_HANDOFF_LOG || join(os.homedir(), ".dsh", "restart-handoff.log");
}

const pendingPath = () => join(stateDir(), "pending.json");
const settingsPath = () => join(stateDir(), "settings.json");
const historyPath = () => join(stateDir(), "history.jsonl");
const bootPath = () => join(stateDir(), "boot.json");
const exitPath = () => join(stateDir(), "exit.json");
const gatePath = () => join(stateDir(), "gate.json");
const lastRestartPath = () => join(stateDir(), "last-restart.json");

function ensureDir() {
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
  } catch {
    /* the write below reports the failure */
  }
}

function rotateIfHuge(file, limit) {
  try {
    if (fs.statSync(file).size <= limit) return;
    fs.renameSync(file, `${file}.1`);
  } catch {
    /* rotation is best effort */
  }
}

export function appendLog(text) {
  try {
    ensureDir();
    const file = logPath();
    rotateIfHuge(file, LOG_ROTATE_BYTES);
    fs.appendFileSync(file, `${new Date().toISOString()} [host] ${text}\n`);
  } catch {
    /* logging must never break a restart */
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function readPending() {
  const value = readJson(pendingPath(), null);
  if (!value || typeof value !== "object" || typeof value.sessionId !== "string") return null;
  // The hand-off used to be one free-form string. That shape is no longer
  // readable, and a stale pending from an older boot must not be delivered as
  // garbage: drop it and let the next restart start clean.
  if (typeof value.continuation === "string") {
    try {
      fs.unlinkSync(pendingPath());
    } catch {
      /* already gone */
    }
    return null;
  }
  return value;
}

export function writePending(pending) {
  writeJson(pendingPath(), pending);
}

export function clearPending() {
  try {
    fs.unlinkSync(pendingPath());
  } catch {
    /* already gone */
  }
}

export function readSettings() {
  const value = readJson(settingsPath(), {});
  const merged = { ...DEFAULT_SETTINGS };
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const next = value && value[key];
    if (typeof next === typeof fallback) merged[key] = next;
  }
  if (!Number.isFinite(merged.graceMs) || merged.graceMs < 0) merged.graceMs = DEFAULT_SETTINGS.graceMs;
  if (!Number.isFinite(merged.cooldownMs) || merged.cooldownMs < 0) merged.cooldownMs = DEFAULT_SETTINGS.cooldownMs;
  // A template edited by hand can go stale: drop it rather than deliver the
  // literal `{{whatever}}` into the next session.
  if (validateTemplate(merged.continuationTemplate)) merged.continuationTemplate = "";
  return merged;
}

export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  // Refuse a template that cannot render: silently storing it would look saved
  // in the file and be dropped on the next read.
  if ("continuationTemplate" in patch) {
    const problem = validateTemplate(next.continuationTemplate);
    if (problem) throw new Error(problem);
  }
  writeJson(settingsPath(), next);
  return next;
}

/** When the last restart actually happened, across process boundaries. */
export function readLastRestart() {
  const value = readJson(lastRestartPath(), null);
  const at = Number(value?.at);
  return Number.isFinite(at) && at > 0 ? at : 0;
}

export function writeLastRestart(at = Date.now()) {
  try {
    writeJson(lastRestartPath(), { at, pid: process.pid });
  } catch {
    /* the cooldown is a guard, not a contract */
  }
}

export function appendHistory(entry) {
  try {
    ensureDir();
    const file = historyPath();
    fs.appendFileSync(file, `${JSON.stringify({ time: Date.now(), ...entry })}\n`);
    if (fs.statSync(file).size > HISTORY_TRIM_BYTES) {
      const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-HISTORY_KEEP_LINES);
      fs.writeFileSync(file, lines.length ? `${lines.join("\n")}\n` : "");
    }
  } catch {
    /* history is best effort */
  }
}

/** Newest first, read from the tail so polling never loads the whole file. */
export function readHistory(limit = 8) {
  try {
    const file = historyPath();
    const size = fs.statSync(file).size;
    const window = Math.min(size, HISTORY_TAIL_BYTES);
    if (window === 0) return [];
    const fd = fs.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(window);
      fs.readSync(fd, buffer, 0, window, size - window);
      const lines = buffer.toString("utf8").split("\n").filter(Boolean);
      // A window that starts mid-file splits its first line: drop that fragment.
      if (size > window) lines.shift();
      return lines
        .slice(-limit)
        .reverse()
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
}

/* --- boot / exit trace ---------------------------------------------------
 * The relaunch helper writes `exit.json` once the old app is really gone, so
 * the next boot can tell "this process was replaced on purpose" from "this
 * process died". `boot.json` is the fingerprint compared against it.
 */

export function readBoot() {
  const value = readJson(bootPath(), null);
  return value && typeof value === "object" && typeof value.pid === "number" ? value : null;
}

export function writeBoot(boot) {
  try {
    writeJson(bootPath(), boot);
  } catch {
    /* the trace must never break a boot */
  }
}

export function readExit() {
  const value = readJson(exitPath(), null);
  return value && typeof value === "object" && typeof value.kind === "string" ? value : null;
}

export function writeExit(exit) {
  try {
    writeJson(exitPath(), exit);
  } catch {
    /* see writeBoot */
  }
}

/** Replace the exit marker only when no planned-restart marker is present. */
export function markShutdown(pid = process.pid) {
  const existing = readExit();
  if (existing && existing.kind === "restart") return;
  writeExit({ kind: "shutdown", at: Date.now(), pid });
}

export function clearExit() {
  try {
    fs.unlinkSync(exitPath());
  } catch {
    /* already gone */
  }
}

/* --- cross-process gate --------------------------------------------------
 * The helper cannot ask the host anything once the host is dying, so the host
 * keeps this file fresh while a restart is pending and the helper re-reads it
 * immediately before it quits the app. `waitAll: false` tells the helper not to
 * block on other sessions at all.
 */

export function writeGate(gate) {
  try {
    writeJson(gatePath(), gate);
  } catch {
    /* best effort */
  }
}

/** Absolute path of the gate file, for the helper script. */
export function gateFile() {
  return gatePath();
}

/** Absolute path of the pending hand-off, exposed so tests can plant files. */
export function pendingFile() {
  return pendingPath();
}