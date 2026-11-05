/**
 * The CLI restart path, end to end and for real: a throwaway "host" process is
 * started, the detached helper is asked to replace it, and the test then checks
 * that the old process is gone, that the planned-restart marker was written and
 * that the fresh `dsh web: <url>` line was picked up and opened.
 *
 * This runs actual processes on purpose. The part that keeps breaking in
 * practice is not string handling but process lifecycle: a helper that inherits
 * the dying tree's process group, or a marker written before the kill is known
 * to have worked, turns a clean restart into a boot that looks like a crash.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchCliRelaunch } from "../lib/relaunch-cli.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const dir = mkdtempSync(join(tmpdir(), "rh-cli-"));
const state = join(dir, "state");
const opened = join(dir, "opened.txt");
const logFile = join(dir, "restart-handoff.log");

// A stand-in host: anything with a pid that can be signalled.
const host = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });

// A stand-in `dsh web`: prints the line the real host prints, then keeps running.
const fakeCli = join(dir, "fake-cli.mjs");
writeFileSync(
  fakeCli,
  'console.log("dsh web: http://127.0.0.1:65531/?token=TESTTOKEN");\nsetTimeout(() => {}, 8000);\n',
);

// A stand-in for /usr/bin/open, so the test never steals the user's browser.
const openShim = join(dir, "open-shim.sh");
writeFileSync(openShim, `#!/bin/sh\nprintf '%s' "$1" > "${opened}"\n`);
chmodSync(openShim, 0o755);

process.env.DSH_RESTART_HANDOFF_OPEN = openShim;
process.env.DSH_RESTART_HANDOFF_LOG = logFile;
process.env.DSH_RESTART_HANDOFF_DIR = state;

launchCliRelaunch({
  hostPid: host.pid,
  invocation: { node: process.execPath, entry: fakeCli, args: [], cwd: dir, noOpen: false },
  dir: state,
});

let url = null;
let restarted = false;
for (let i = 0; i < 120; i += 1) {
  await sleep(250);
  if (!url && existsSync(opened)) {
    const text = readFileSync(opened, "utf8").trim();
    if (text) url = text;
  }
  const marker = join(state, "exit.json");
  if (!restarted && existsSync(marker)) {
    restarted = JSON.parse(readFileSync(marker, "utf8")).kind === "restart";
  }
  if (url && restarted && !alive(host.pid)) break;
}

assert.equal(alive(host.pid), false, "the old host process was stopped");
assert.equal(restarted, true, "the planned-restart marker was written before the new host started");
assert.equal(url, "http://127.0.0.1:65531/?token=TESTTOKEN", "the fresh token url was opened");

const log = existsSync(logFile) ? readFileSync(logFile, "utf8") : "";
assert.match(log, /relaunched as pid \d+/, "the helper logged the relaunch");

// --no-open keeps the browser out of it (a cron/CI style launch).
const state2 = join(dir, "state-no-open");
process.env.DSH_RESTART_HANDOFF_DIR = state2;
const host2 = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
launchCliRelaunch({
  hostPid: host2.pid,
  invocation: { node: process.execPath, entry: fakeCli, args: ["--no-open"], cwd: dir, noOpen: true },
  dir: state2,
});
let documented = false;
for (let i = 0; i < 60; i += 1) {
  await sleep(250);
  if (existsSync(join(state2, "exit.json"))) {
    documented = true;
    break;
  }
}
assert.equal(alive(host2.pid), false, "--no-open still restarts the host");
assert.equal(documented, true, "--no-open still records the planned restart");

try {
  spawn("pkill", ["-f", fakeCli], { stdio: "ignore" });
} catch {}
rmSync(dir, { recursive: true, force: true });
console.log("cli relaunch ok");