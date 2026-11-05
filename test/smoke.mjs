/**
 * Smoke test for dsh-restart-handoff — runs outside the Harness.
 *
 *   node test/smoke.mjs
 *
 * Covers the parts that do not need a live Host: the relaunch helper text,
 * the app-path derivation, and the durable state round trip.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { appPath, helperScript, logPath } from "../lib/relaunch.js";

// --- relaunch ------------------------------------------------------------
assert.ok(appPath().endsWith(".app"), "appPath should end with .app");
const script = helperScript(4242);
assert.ok(script.startsWith("#!/bin/sh"), "helper is a shell script");
assert.ok(script.includes("HOST_PID=4242"), "helper carries the host pid");
assert.ok(script.includes("open -n"), "helper relaunches with open -n");
assert.ok(script.includes("SingletonLock"), "helper clears stale Electron locks");
assert.ok(script.includes("app relaunched"), "helper reports a verified relaunch");
assert.ok(logPath().endsWith("restart-handoff.log"), "helper logs to restart-handoff.log");
assert.ok(script.includes("gate_busy"), "helper re-reads the idle gate before quitting the app");
assert.ok(script.includes("exit.json"), "helper records a planned restart marker");
assert.ok(script.includes("dsh-auth-%"), "helper prunes stale login cookies");
assert.ok(script.includes("relaunch.lock"), "helper takes a lock so two restarts cannot race");

// --- access rules -------------------------------------------------------
const access = await import("../lib/access.js");
assert.equal(access.isDelegatedHeader(undefined), undefined, "a missing header cannot be judged");
assert.equal(access.isDelegatedHeader({ origin: "subagent" }), true, "subagent origin marks a child");
assert.equal(access.isDelegatedHeader({ parentSession: "s-parent" }), true, "a parent Session id marks a child");
assert.equal(access.isDelegatedHeader({ delegationDepth: 1 }), true, "delegation depth marks a child");
assert.equal(access.isDelegatedHeader({ origin: "desktop", delegationDepth: 0 }), false, "a human-facing Session header is a root");
assert.equal(access.isChildAgent({ session: { header: { origin: "subagent" } } }), true, "the Agent header is read");
assert.equal(access.isChildAgent(undefined), undefined, "a missing Agent cannot be judged");

// --- state --------------------------------------------------------------
const dir = fs.mkdtempSync(join(os.tmpdir(), "dsh-restart-handoff-"));
process.env.DSH_RESTART_HANDOFF_DIR = dir;
process.env.DSH_RESTART_HANDOFF_LOG = join(dir, "restart-handoff.log");

const state = await import("../lib/state.js");

assert.deepEqual(state.readPending(), null, "empty pending reads as null");
state.writePending({
  sessionId: "s1",
  reason: "test",
  progress: "did half of it",
  next: "do the other half",
  skip: "",
  requestedAt: 1,
  attempts: 2,
});
const pending = state.readPending();
assert.equal(pending.sessionId, "s1");
assert.equal(pending.attempts, 2);
assert.equal(pending.next, "do the other half");
assert.equal("continuation" in pending, false, "the field set is the new one, not the free text");
state.clearPending();
assert.equal(state.readPending(), null, "cleared pending reads as null");

// A pending file written by an older build carries free text. Nobody re-reads
// it: the file is deleted so a restart never delivers the retired format.
fs.writeFileSync(
  state.pendingFile(),
  JSON.stringify({ sessionId: "s1", continuation: "old free text", reason: "test", requestedAt: 1 }),
);
assert.deepEqual(state.readPending(), null, "legacy free-text pending is dropped");
assert.equal(fs.existsSync(state.pendingFile()), false, "the legacy file is removed, not left to retry");

const defaults = state.readSettings();
assert.equal(defaults.autoRestart, true);
assert.equal(defaults.graceMs, 5000);
const saved = state.writeSettings({ autoRestart: false, graceMs: 9000 });
assert.equal(saved.autoRestart, false);
assert.equal(state.readSettings().graceMs, 9000, "settings persist");

state.appendHistory({ kind: "scheduled", reason: "test" });
state.appendHistory({ kind: "resumed", sessionId: "s1" });
const history = state.readHistory(5);
assert.equal(history.length, 2);
assert.equal(history[0].kind, "resumed", "history is newest first");

// The reader only touches the tail of the file: a history file larger than the
// tail window must still yield the newest entries, without a half-line from the
// middle of the file sneaking in.
for (let i = 0; i < 140; i += 1) {
  state.appendHistory({ kind: "bulk", seq: i, detail: "x".repeat(600) });
}
const tail = state.readHistory(3);
assert.equal(tail.length, 3, "the tail reader returns the requested count");
assert.equal(tail[0].seq, 139, "the tail reader starts at the newest entry");
assert.deepEqual(tail.map((entry) => entry.seq), [139, 138, 137], "tail entries are intact JSON");

// --- cooldown anchor ----------------------------------------------------
assert.equal(state.readLastRestart(), 0, "no restart has been recorded yet");
state.writeLastRestart(12345);
assert.equal(state.readLastRestart(), 12345, "the restart anchor survives a boot");

// --- boot trace ---------------------------------------------------------
assert.equal(state.readBoot(), null, "no boot record yet");
state.writeBoot({ pid: 111, bootAt: 1000, previousPid: null, exitKind: null });
assert.equal(state.readBoot().pid, 111, "boot record round-trips");

state.writeExit({ kind: "restart", at: Date.now(), pid: 111 });
state.markShutdown(222);
assert.equal(state.readExit().kind, "restart", "a planned restart is not overwritten by a shutdown");
assert.equal(state.readExit().pid, 111);
state.clearExit();
assert.equal(state.readExit(), null, "exit marker is cleared after boot");

// --- idle gate ----------------------------------------------------------
state.writeGate({ busy: true, waitAll: true, sessions: ["s1"], at: Date.now(), pid: 333 });
const gate = JSON.parse(fs.readFileSync(state.gateFile(), "utf8"));
assert.equal(gate.busy, true, "gate round-trips");
assert.equal(gate.waitAll, true, "the gate carries the wait-for-all switch");
assert.ok(state.gateFile().endsWith("gate.json"), "gate file path is exposed for the helper");

state.appendLog("smoke");
assert.ok(fs.readFileSync(process.env.DSH_RESTART_HANDOFF_LOG, "utf8").includes("smoke"), "log is appended");

// --- template -----------------------------------------------------------
const { continuationText, hasHandoff } = await import("../index.js");

assert.equal(state.validateTemplate(state.DEFAULT_CONTINUATION_TEMPLATE), null, "the built-in template is valid");
assert.equal(state.validateTemplate("{{nope}}"), "不认识的占位符：nope。可用的只有 {{reason}}、{{progress}}、{{next}}、{{skip}}、{{session}}、{{time}}");
assert.ok(state.validateTemplate("一句话，没有占位符"), "a template without placeholders is refused");
assert.equal(state.validateTemplate("x".repeat(4001)), "模板太长了（上限 4000 字）");
assert.throws(() => state.writeSettings({ continuationTemplate: "{{nope}}" }), /不认识的占位符/, "saving is refused, not silently dropped");
assert.equal(state.readSettings().continuationTemplate, "", "a refused save leaves the setting alone");

const full = {
  sessionId: "abcdef123456",
  reason: "rationale",
  progress: "halfway",
  next: "finish it",
  skip: "the tests",
  requestedAt: new Date(2026, 10, 5, 9, 7).getTime(),
};
const rendered = continuationText(full, {});
assert.ok(rendered.startsWith("## DSH 已重启完成 · 09:07"), rendered);
assert.ok(rendered.includes("- 起因：rationale"), rendered);
assert.ok(rendered.includes("- 做到哪了：halfway"), rendered);
assert.ok(rendered.includes("- 接下来第一步：finish it"), rendered);
assert.ok(rendered.includes("- 不用重做：the tests"), rendered);
// Structure is fine, asterisks are not: a heading and dashes still read as
// Markdown, while `*` shows up raw in some renderers and looks like source code.
assert.ok(!rendered.includes("*"), `default hand-off must not contain an asterisk: ${rendered}`);
assert.equal(rendered.split("\n\n- ").length - 1, 4, "each bullet starts a loose-list block");

// A missing field takes its label with it, so no empty "接下来第一步：" is delivered.
const partial = continuationText({ ...full, progress: "", skip: "" }, {});
assert.ok(!partial.includes("做到哪"), "an empty field drops its whole block");
assert.ok(!partial.includes("不用重做"));
assert.ok(partial.includes("- 接下来第一步：finish it"));
assert.equal(partial.split("\n\n- ").length - 1, 2, "two bullets survive");
assert.ok(!partial.includes("\n\n\n"), "no doubled blank lines left behind");

// The retired fallback still reads like a sentence when nothing was handed over.
assert.equal(continuationText({ reason: "only reason" }, {}).includes("**下一步**"), false);
assert.equal(hasHandoff({ reason: "only reason" }), false, "a plan with no fields has no hand-off");
assert.equal(hasHandoff({ next: "x" }), true);

const custom = continuationText(full, { continuationTemplate: "🔁 {{time}} 重启\n满了：{{progress}}\n下一步：{{next}}" });
assert.equal(custom, "🔁 09:07 重启\n满了：halfway\n下一步：finish it");

fs.rmSync(dir, { recursive: true, force: true });
console.log("smoke ok");