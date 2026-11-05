/**
 * dsh-restart-handoff — relaunch helper for hosts that are plain Node
 * processes (`dsh web`, `dsh --profile web`, and anything else booted through
 * the npm CLI).
 *
 * The desktop helper cannot be reused: there is no app bundle, no
 * LaunchServices, no singleton lock, and no socket to keep alive. A CLI host
 * is restarted by replaying the exact command line that started it, which is
 * why this module records argv, cwd and env instead of looking anything up.
 *
 * The browser is the one thing that cannot survive: `dsh web` mints a fresh
 * access token on every boot, so the tab that was open always goes stale. The
 * helper therefore watches the new process's output for the line it prints
 * (`dsh web: http://…?token=…`) and opens that URL, so the restart still ends
 * with a usable window instead of a dead tab.
 */
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Where the helper script and its job description live. */
export function stateDir() {
  return process.env.DSH_RESTART_HANDOFF_DIR || join(process.env.HOME || ".", ".dsh", "restart-handoff");
}

/**
 * The command line that started this host, reconstructed from argv.
 * `process.argv` is `[node, entry, ...flags]` for a CLI host, so replaying
 * `slice(1)` reproduces the original invocation — including `--profile`,
 * `--port` and `--no-open`.
 */
export function cliInvocation(argv = process.argv) {
  const [, entry, ...flags] = argv;
  return {
    node: process.execPath,
    entry: entry || "",
    args: flags,
    cwd: process.cwd(),
    noOpen: flags.includes("--no-open"),
  };
}

/**
 * The helper itself: a self-contained Node script. It runs detached, because
 * the process it is about to stop is the one that spawned it.
 */
export function cliHelperSource() {
  return `// dsh-restart-handoff cli helper (generated; rewritten on every restart)
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";

const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const log = (message) => {
  try { appendFileSync(job.log, stamp() + " [cli] " + message + "\\n"); } catch {}
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};
const read = (file) => { try { return readFileSync(file, "utf8"); } catch { return ""; } };

// One helper at a time: the panel button, a queued restart and a tool call can
// all land within a few seconds, and two helpers means two new servers.
const lock = job.stateDir + "/relaunch.lock";
mkdirSync(job.stateDir, { recursive: true });
let locked = true;
try {
  mkdirSync(lock);
} catch {
  const age = Date.now() - (() => { try { return statSync(lock).mtimeMs; } catch { return 0; } })();
  if (age < 900000) {
    log("another restart is already in progress (lock age " + Math.round(age / 1000) + "s); leaving it to finish");
    process.exit(0);
  }
  rmSync(lock, { recursive: true, force: true });
  try { mkdirSync(lock); } catch { locked = false; }
}
const release = () => { try { rmSync(lock, { recursive: true, force: true }); } catch {} };
process.on("exit", release);
if (!locked) { log("cannot take the relaunch lock; exiting"); process.exit(0); }

// The host keeps gate.json fresh while a restart is pending. Re-read it here:
// between the host's last look and this script taking over, another Session may
// have started a turn, and that is the last chance to avoid cutting it off.
const gateBusy = () => {
  try {
    const gate = JSON.parse(read(job.stateDir + "/gate.json") || "{}");
    if (gate.waitAll === false) return false;
    if (gate.busy !== true) return false;
    return Date.now() - Number(gate.at || 0) < 8000;
  } catch { return false; }
};
let waited = 0;
while (gateBusy() && waited < 1800) {
  if (waited === 0) log("another session is still running; holding the restart");
  await sleep(500);
  waited += 1;
}
if (waited > 0) log("idle gate released after " + waited + " half-seconds");

// Stop the old host. SIGTERM first: the web host closes its listener cleanly and
// releases the port, which the next boot needs.
log("stopping host " + job.hostPid);
try { process.kill(job.hostPid, "SIGTERM"); } catch {}
for (let i = 0; i < 40 && alive(job.hostPid); i += 1) await sleep(250);
if (alive(job.hostPid)) {
  log("host ignored SIGTERM; sending SIGKILL");
  try { process.kill(job.hostPid, "SIGKILL"); } catch {}
  for (let i = 0; i < 20 && alive(job.hostPid); i += 1) await sleep(250);
}

// Only now is this a planned restart (same marker the desktop helper writes, so
// the next boot can tell a replacement from a crash).
mkdirSync(job.stateDir, { recursive: true });
writeFileSync(
  job.stateDir + "/exit.json",
  JSON.stringify({ kind: "restart", at: Date.now(), hostPid: job.hostPid }) + "\\n",
);

// Replay the original command line, detached from this helper's lifetime.
let out = "ignore";
try { out = openSync(job.childLog, "a"); } catch {}
let child;
try {
  child = spawn(job.node, [job.entry, ...job.args], {
    cwd: job.cwd,
    env: job.env,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  log("relaunched as pid " + child.pid + " (" + job.node + " " + job.entry + " " + job.args.join(" ") + ")");
} catch (error) {
  log("could not relaunch: " + (error && error.message ? error.message : error));
  writeFileSync(job.stateDir + "/cli-failed.json", JSON.stringify({ at: Date.now(), error: String(error) }) + "\\n");
  process.exit(1);
}

// Wait for the fresh token URL and open it: the token changes on every boot, so
// the tab that was open is dead no matter what.
if (job.noOpen) {
  log("--no-open was in effect; the new URL is in " + job.childLog);
} else {
  const deadline = Date.now() + 180000;
  let url = null;
  while (Date.now() < deadline) {
    const match = read(job.childLog).match(/dsh web:\\s*(https?:\\/\\/\\S+)/);
    if (match) { url = match[1]; break; }
    if (!alive(child.pid)) break;
    await sleep(500);
  }
  if (url) {
    log("new url: " + url);
    try {
      const opener = spawn(job.openCmd, [url], { detached: true, stdio: "ignore" });
      opener.unref();
    } catch (error) {
      log("could not open the browser: " + (error && error.message ? error.message : error));
    }
  } else {
    log("did not see the web url; the new host is running, check " + job.childLog);
  }
}
log("done");
`;
}

/**
 * Spawn the detached CLI helper. Returns its pid; throws only if the spawn
 * itself fails, so the caller can undo the hand-off.
 */
export function launchCliRelaunch({ hostPid, invocation = cliInvocation(), dir = stateDir(), logFile }) {
  mkdirSync(dir, { recursive: true });
  const helper = join(dir, "cli-helper.mjs");
  const jobFile = join(dir, "cli-job.json");
  writeFileSync(helper, cliHelperSource());
  chmodSync(helper, 0o600);

  const childLog = join(dir, "cli-host.log");
  writeFileSync(
    jobFile,
    JSON.stringify(
      {
        hostPid,
        node: invocation.node,
        entry: invocation.entry,
        args: invocation.args,
        cwd: invocation.cwd,
        noOpen: invocation.noOpen,
        env: process.env,
        log: logFile || process.env.DSH_RESTART_HANDOFF_LOG || join(dir, "restart-handoff.log"),
        childLog,
        stateDir: dir,
        openCmd: process.env.DSH_RESTART_HANDOFF_OPEN || "/usr/bin/open",
      },
      null,
      2,
    ),
  );
  chmodSync(jobFile, 0o600);

  const child = spawn(invocation.node, [helper, jobFile], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  return child.pid;
}

export function cliHostLog(dir = stateDir()) {
  return join(dir, "cli-host.log");
}