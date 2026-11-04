/**
 * dsh-restart-handoff — host half.
 *
 * Three ways a restart happens, all funneled into one scheduler:
 *
 *   1. Automatic — a tool result reports `application: 'restart-required'`
 *      (the plugin manager's own verdict that HMR could not apply the change).
 *   2. Agent tool `restart_handoff` — the agent knows what it just
 *      changed and can hand over its own "next step".
 *   3. The Settings > 重启 panel (HTTP routes below).
 *
 * Every restart writes `pending.json` BEFORE the process is killed, and the
 * next boot delivers that continuation into the original Session through
 * `sessionController.resolveAgent` + `prompt`, so the conversation picks up
 * where it stopped instead of waiting for the user to say "继续".
 */
import { isChildAgent } from "./lib/access.js";
import { appPath, launchRelaunch, notify } from "./lib/relaunch.js";
import {
  appendHistory,
  appendLog,
  clearExit,
  clearPending,
  gateFile,
  logPath,
  markShutdown,
  readBoot,
  readExit,
  readHistory,
  readLastRestart,
  readPending,
  readSettings,
  writeBoot,
  writeGate,
  writeLastRestart,
  writePending,
  writeSettings,
} from "./lib/state.js";

export const name = "restart-handoff";

export const inject = ["webServer", "connection", "tools", "agents", "sessionController", "timer"];

const ROUTE_PREFIX = "/restart-handoff";
const MAX_BODY_BYTES = 64 * 1024;
/** A continuation older than this belongs to a long-dead restart. */
const PENDING_TTL_MS = 10 * 60 * 1000;
/** `resolveAgent` can miss while the Session store is still warming up. */
const RESUME_ATTEMPTS = 8;
const RESUME_RETRY_MS = 1500;
/** After a failed delivery, leave the pending alone for this long. */
const RESUME_RETRY_BACKOFF_MS = 2 * 60 * 1000;
/** Give the framework time to commit the tool result before we kill it. */
const TOOL_RESTART_DELAY_MS = 1500;
const DEFER_FALLBACK_MS = 15 * 60 * 1000;
/** How long the model gets to author its own hand-off text before the fallback. */
const HANDOFF_WINDOW_MS = 2 * 60 * 1000;
// A deferred restart already waited for the turn to close, so its cancel window
// only needs to cover a mis-click, not a whole answer.
const DEFERRED_GRACE_MS = 1500;
const MAX_DELAY_MS = 10 * 60 * 1000;
/** How often the helper's gate file is refreshed while a restart is pending. */
const GATE_HEARTBEAT_MS = 1000;
/** A postponement re-arms the countdown this soon after the last look found a turn. */
const BUSY_RETRY_MS = 2000;
/** Stop postponing after this many tries; the 15-minute deferral fallback still applies. */
const BUSY_RETRY_LIMIT = 60;
/** Tool names whose result may carry a plugin-manager ChangeResult. */
const MANAGER_TOOLS = new Set(["plugin_manager", "plugin-manager", "pluginManager"]);
/** `agent/status` values that mean "this Session is holding a turn right now". */
const ACTIVE_STATUSES = new Set(["running", "busy", "thinking", "streaming", "starting", "working"]);

const sleep = (ms) => new Promise((done) => {
  const timer = setTimeout(done, ms);
  timer.unref?.();
});

const isDesktop = () => Boolean(process.versions?.electron);

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

/** Read at most `limit` bytes from the request body. */
function readBoundedBody(req, limit) {
  return new Promise((resolvePromise, reject) => {
    let done = false;
    let size = 0;
    const chunks = [];
    const finish = (error, value) => {
      if (done) return;
      done = true;
      if (error) reject(error);
      else resolvePromise(value);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        finish(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish(undefined, Buffer.concat(chunks).toString("utf8")));
    req.on("error", (error) => finish(error));
  });
}

/** Deep, bounded search for a plugin-manager ChangeResult verdict. */
function findRestartRequired(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return null;
  if (value.application === "restart-required") return { restartReason: value.restartReason };
  for (const key of Object.keys(value)) {
    const hit = findRestartRequired(value[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

const RESTART_REQUIRED_TEXT = /"application"\s*:\s*"restart-required"/;

function restartVerdictOf(result) {
  const fromValue = findRestartRequired(result?.value);
  if (fromValue) return fromValue;
  const blocks = Array.isArray(result?.content) ? result.content : [];
  const text = blocks
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .slice(0, 4096);
  return RESTART_REQUIRED_TEXT.test(text) ? { restartReason: undefined } : null;
}

export function continuationText(pending) {
  // The agent that asked for the restart usually writes the hand-off message
  // itself (`restart_handoff({ continuation })`); deliver it verbatim.
  const authored = String(pending.continuation || "").trim();
  if (authored) return authored.slice(0, 8000);
  // Fallback is deliberately one plain line: no fabricated narrative about
  // what was or was not in flight, just a nudge back to work.
  const reason = String(pending.reason || "").trim();
  return reason
    ? `🔄 DSH 已重启完成（${reason}），继续未完成的工作。`
    : "🔄 DSH 已重启完成，继续未完成的工作。";
}

export function apply(ctx) {
  const settingsAtBoot = readSettings();

  const state = {
    countdown: null,
    deferred: null,
    deferredFallback: null,
    handoff: null,
    handoffTimer: null,
    /** Aborts the in-flight steer request if the hand-off is dropped first. */
    handoffController: null,
    lastRestartAt: 0,
    bootedAt: Date.now(),
    /** Session ids that currently have a turn running (agent/status + api-session/status). */
    running: new Set(),
    gateTimer: null,
    /** True from the last look until the process is gone: keeps the gate fresh. */
    dying: false,
    boot: null,
  };

  const log = (message) => appendLog(message);

  /** Publish the live "is anybody working?" answer the helper re-reads. */
  function publishGate(busy = state.running.size > 0) {
    writeGate({
      busy,
      // The helper honours this too: with the wait switched off it must not
      // hold the restart on a gate the host is no longer waiting for.
      waitAll: readSettings().waitForAllSessions !== false,
      sessions: [...state.running],
      at: Date.now(),
      pid: process.pid,
      file: gateFile(),
    });
  }

  /**
   * Keep the gate file fresh while a restart is pending: the helper treats a
   * stale timestamp as "the host is gone, do not wait".
   */
  function ensureGateHeartbeat() {
    if (state.gateTimer) return;
    state.gateTimer = ctx.timeout(function beat() {
      state.gateTimer = null;
      publishGate();
      if (state.deferred || state.countdown || state.dying) {
        state.gateTimer = ctx.timeout(beat, GATE_HEARTBEAT_MS);
      }
    }, GATE_HEARTBEAT_MS);
  }

  function markRunning(sessionId, running) {
    if (!sessionId || typeof sessionId !== "string") return;
    const had = state.running.has(sessionId);
    if (running) state.running.add(sessionId);
    else state.running.delete(sessionId);
    if (had !== running) publishGate();
    if (state.deferred) evaluateDeferred();
  }

  /**
   * Boot trace: compare `exit.json` (written by the helper right before it
   * touches the app) with the previous `boot.json`. A planned replacement is
   * logged with its downtime; a process that simply vanished is reported once
   * instead of silently pretending everything is normal.
   */
  function recordBoot() {
    const previous = readBoot();
    // A hot reload re-runs `apply()` in the *same* process: that is not a boot,
    // and treating it as one would overwrite the real boot trace.
    if (previous && previous.pid === process.pid) {
      state.boot = {
        kind: "reload",
        pid: process.pid,
        bootAt: previous.bootAt ?? Date.now(),
        previousPid: previous.previousPid ?? null,
      };
      log("same host process reloaded the plugin; boot trace left untouched");
      return;
    }
    const exit = readExit();
    const now = Date.now();
    if (exit && exit.kind === "restart") {
      const downtime = Math.max(0, Math.round((now - Number(exit.at ?? now)) / 1000));
      state.boot = { kind: "restart", pid: process.pid, bootAt: now, downtime, previousPid: previous?.pid ?? null };
      log(`boot after a planned restart (downtime ${downtime}s, previous pid ${previous?.pid ?? "?"})`);
      appendHistory({ kind: "boot", detail: `planned restart, downtime ${downtime}s` });
    } else if (exit && exit.kind === "shutdown") {
      state.boot = { kind: "shutdown", pid: process.pid, bootAt: now, previousPid: previous?.pid ?? null };
      log("boot after a normal shutdown");
    } else if (previous && previous.pid !== process.pid) {
      state.boot = { kind: "unexpected", pid: process.pid, bootAt: now, previousPid: previous.pid, previousBootAt: previous.bootAt ?? null };
      log(`previous host (pid=${previous.pid}) went away without a planned restart`);
      appendHistory({ kind: "boot", error: "unexpected exit" });
      notify("DSH 重启", "上次宿主是异常退出的（不是插件发起的重启），已记录在日志里");
    } else {
      state.boot = { kind: "first", pid: process.pid, bootAt: now, previousPid: null };
      log("first boot recorded");
    }
    clearExit();
    writeBoot({
      pid: process.pid,
      bootAt: now,
      previousPid: previous?.pid ?? null,
      exitKind: exit?.kind ?? null,
    });
  }

  function beginCountdown(plan, delayMs) {
    const settings = readSettings();
    // The cooldown must survive the restart it guards, otherwise a loop of
    // boot → restart → boot has nothing stopping it.
    const lastRestartAt = Math.max(state.lastRestartAt, readLastRestart());
    const sinceLast = Date.now() - lastRestartAt;
    if (lastRestartAt > 0 && sinceLast < settings.cooldownMs) {
      log(`restart skipped: cooldown has ${settings.cooldownMs - sinceLast}ms left`);
      appendHistory({ kind: "skipped", reason: plan.reason, error: "cooldown" });
      return { status: "cooldown", retryInMs: settings.cooldownMs - sinceLast };
    }
    const delay = Math.min(MAX_DELAY_MS, Math.max(0, Number.isFinite(delayMs) ? delayMs : 0));
    const restartAt = Date.now() + delay;
    const cancel = ctx.timeout(() => {
      state.countdown = null;
      performRestart(plan);
    }, delay);
    state.countdown = {
      restartAt,
      delayMs: delay,
      reason: plan.reason,
      sessionId: plan.sessionId,
      cancel,
    };
    log(`restart scheduled in ${delay}ms (${plan.reason})`);
    appendHistory({ kind: "scheduled", reason: plan.reason, sessionId: plan.sessionId, delayMs: delay });
    publishGate(state.running.size > 0);
    ensureGateHeartbeat();
    return {
      status: "scheduled",
      restartAt,
      delayMs: delay,
      reason: plan.reason,
      hasContinuation: Boolean(plan.continuation),
    };
  }

  function clearDeferred(by) {
    if (!state.deferred) return false;
    const deferred = state.deferred;
    state.deferred = null;
    try {
      state.deferredFallback?.();
    } catch {
      /* already fired */
    }
    state.deferredFallback = null;
    log(`deferred restart dropped (${by})`);
    appendHistory({ kind: "cancelled", reason: deferred.plan.reason, by });
    return true;
  }

  function clearHandoff(by) {
    if (!state.handoff) return false;
    const handoff = state.handoff;
    state.handoff = null;
    try {
      state.handoffTimer?.();
    } catch {
      /* already fired */
    }
    state.handoffTimer = null;
    // The steer request may still be in flight; aborting it keeps a late
    // delivery from landing after the restart it was asking about.
    try {
      state.handoffController?.abort();
    } catch {
      /* already aborted */
    }
    state.handoffController = null;
    log(`hand-off request dropped (${by})`);
    return true;
  }

  function handoffInstruction(reason) {
    return [
      "[restart-handoff] 刚才的改动需要重启宿主才能生效。",
      `原因：${reason}`,
      "",
      "请你自己写这段交接话：调用 `restart_handoff`，把 `continuation` 写成重启后的你要读的那段话。",
      "建议写清：为什么重启、这一轮做到哪、重启后第一步做什么、哪些不用重做。结构由你决定，插件会原样投递。",
      "",
      "这段时间是留给你写交接话的：2 分钟内没有调用工具，插件就发一句「已重启，继续未完成的工作」照常重启（重启本身不会因为没人写而取消）。",
    ].join("\n");
  }

  /** The auto trigger cannot know what the work meant, so ask the model to write the hand-off. */
  /**
   * A tool call made by a delegated child belongs to the child's Session, but the
   * human is looking at — and the hand-off must go back to — the root Session that
   * spawned it. Walk up with the agent registry; unknown ids are returned as-is.
   */
  function rootSessionOf(sessionId) {
    if (!sessionId || !ctx.agents) return sessionId;
    try {
      for (const root of ctx.agents.roots()) {
        if (root.id === sessionId) return sessionId;
        if (ctx.agents.isOwnedBy(sessionId, root)) return root.id;
      }
    } catch {
      /* fall through to the id we were given */
    }
    return sessionId;
  }

  /**
   * Only the main Session restarts the host. Two independent signals are read:
   * the child markers on the Session header, and the Agent registry's
   * ownership chain (a teammate is spawned by — and owned by — the Lead).
   */
  function isDelegatedAgent(agent) {
    if (isChildAgent(agent) === true) return true;
    const id = agent?.id;
    if (typeof id === "string" && id !== "" && rootSessionOf(id) !== id) return true;
    return false;
  }

  /**
   * Drop running entries whose Agent is already gone. A Session disposed
   * between "running" and "idle" would otherwise pin the gate forever, so after
   * a confirmed absence the entry has to go. The registry can briefly miss an
   * Agent that is still alive (a reload re-registers them), so an entry is only
   * dropped once it has looked dead for PRUNE_CONFIRM_MS.
   */
  const PRUNE_CONFIRM_MS = 5000;
  /** sessionId -> first time it looked dead. */
  const pruneMisses = new Map();

  function pruneRunning() {
    if (!ctx.agents?.get) return;
    const now = Date.now();
    let changed = false;
    for (const id of [...state.running]) {
      let live;
      try {
        live = ctx.agents.get(id) !== undefined;
      } catch {
        pruneMisses.delete(id);
        continue;
      }
      if (live) {
        pruneMisses.delete(id);
        continue;
      }
      const firstSeen = pruneMisses.get(id);
      if (firstSeen === undefined) {
        pruneMisses.set(id, now);
        continue;
      }
      if (now - firstSeen < PRUNE_CONFIRM_MS) continue;
      pruneMisses.delete(id);
      state.running.delete(id);
      changed = true;
      log(`dropped a stale running entry (${id})`);
    }
    if (changed) publishGate();
  }

  /** A restart the scheduler already holds, in the shape every caller reports. */
  function queuedStatus() {
    if (state.countdown) {
      return {
        status: "already-scheduled",
        restartAt: state.countdown.restartAt,
        reason: state.countdown.reason,
        inMs: Math.max(0, state.countdown.restartAt - Date.now()),
      };
    }
    if (state.deferred) {
      return {
        status: "already-deferred",
        reason: state.deferred.plan.reason,
        sessionId: state.deferred.sessionId,
      };
    }
    return null;
  }

  /**
   * The turn is over for the model as of this result. Say it in the payload,
   * not only in the tool description: the model reads the result as the newest
   * fact.
   */
  function finishQueued(result) {
    const queued =
      result.status === "deferred" ||
      result.status === "already-deferred" ||
      result.status === "scheduled" ||
      result.status === "already-scheduled";
    if (!queued) return result;
    return {
      ...result,
      mustStopNow: true,
      waitFor: "turn-end",
      note: "重启发生在这一回合结束、回答送达之后。现在停止：不要再调用工具，也不要开始新任务；重启后要做的第一件事写在 continuation 里。",
    };
  }

  function requestHandoff(reason, sessionId) {
    if (state.handoff) return { status: "handoff-pending" };
    sessionId = rootSessionOf(sessionId);
    if (!sessionId || !ctx.sessionController) {
      log("no session to ask for a hand-off; using the one-line note");
      return scheduleRestart({ reason, sessionId, defer: true });
    }
    state.handoff = { reason, sessionId, requestedAt: Date.now() };
    state.handoffTimer = ctx.timeout(() => {
      const handoff = state.handoff;
      state.handoff = null;
      state.handoffTimer = null;
      if (!handoff) return;
      log("no hand-off from the model within the window; restarting with the one-line note");
      appendHistory({ kind: "handoff-timeout", reason: handoff.reason, sessionId: handoff.sessionId });
      scheduleRestart({ reason: handoff.reason, sessionId: handoff.sessionId, defer: true });
    }, HANDOFF_WINDOW_MS);
    log(`restart-required detected; asking the model to write the hand-off (${reason})`);
    const controller = new AbortController();
    state.handoffController = controller;
    ctx.sessionController
      .prompt(
        {
          requestId: `restart-handoff-${Date.now()}`,
          sessionId,
          mode: "steer",
          content: [{ type: "text", text: handoffInstruction(reason) }],
        },
        controller.signal,
      )
      .then(
        (accepted) => log(`hand-off request delivered (${JSON.stringify(accepted)})`),
        (error) => {
          log(`hand-off request failed (${error?.message ?? error}); restarting with the one-line note`);
          clearHandoff("request-failed");
          scheduleRestart({ reason, sessionId, defer: true });
        },
      );
    return { status: "handoff-requested" };
  }

  function scheduleRestart(request) {
    if (!isDesktop()) {
      return { status: "unsupported", error: "restart-handoff only works inside the DSH desktop app" };
    }
    const queued = queuedStatus();
    if (queued) return queued;
    const plan = {
      reason: String(request.reason || "restart requested").slice(0, 500),
      sessionId: typeof request.sessionId === "string" ? request.sessionId : undefined,
      continuation: String(request.continuation || "").slice(0, 8000),
      requestedAt: Date.now(),
    };
    const settings = readSettings();
    const defer = settings.deferUntilIdle !== false && Boolean(plan.sessionId) && request.defer !== false;
    if (!defer) return beginCountdown(plan, request.delayMs);

    // Turn-end gate: the current answer must finish and reach the user before the
    // process exits, otherwise the turn is cut mid-flight and its tool results are
    // lost. Wait for this Session to report idle, then count down the grace window.
    state.deferred = {
      plan,
      sessionId: plan.sessionId,
      reason: plan.reason,
      requestedAt: Date.now(),
    };
    state.deferredFallback = ctx.timeout(() => {
      const pendingPlan = state.deferred?.plan;
      state.deferred = null;
      state.deferredFallback = null;
      if (!pendingPlan) return;
      log("deferred restart fallback fired: the turn never reported idle");
      beginCountdown(pendingPlan, readSettings().graceMs);
    }, DEFER_FALLBACK_MS);
    log(`restart deferred until session ${plan.sessionId} finishes its turn (${plan.reason})`);
    appendHistory({ kind: "deferred", reason: plan.reason, sessionId: plan.sessionId });
    publishGate(state.running.size > 0);
    ensureGateHeartbeat();
    return {
      status: "deferred",
      sessionId: plan.sessionId,
      reason: plan.reason,
      // Report the grace that will actually be used, not the (longer) configured one.
      graceMs: Math.min(settings.graceMs, DEFERRED_GRACE_MS),
      hasContinuation: Boolean(plan.continuation),
    };
  }

  /**
   * Turn-end gate. One Session going idle is not enough: another Session may
   * still be mid-answer, and killing the host for it would lose that turn. The
   * deferred restart therefore waits until nobody is running, not just the
   * Session that asked for it.
   */
  function evaluateDeferred(why) {
    const deferred = state.deferred;
    if (!deferred) return;
    const settings = readSettings();
    const waitAll = settings.waitForAllSessions !== false;
    pruneRunning();
    if (waitAll && state.running.size > 0) return;
    if (!waitAll && deferred.sessionId && state.running.has(deferred.sessionId)) return;
    state.deferred = null;
    try {
      state.deferredFallback?.();
    } catch {
      /* already fired */
    }
    state.deferredFallback = null;
    deferred.plan.waitedForTurn = true;
    deferred.plan.waitedForSessions = waitAll;
    const grace = Math.min(readSettings().graceMs, DEFERRED_GRACE_MS);
    const scope = waitAll ? "all sessions are idle" : `session ${deferred.sessionId} finished its turn`;
    log(`${scope}${why ? ` (${why})` : ""}; starting the ${grace}ms grace countdown`);
    const armed = beginCountdown(deferred.plan, grace);
    if (armed && armed.status === "cooldown") {
      // Do not let the cooldown swallow the restart silently: hand the deferred
      // back and look again once the cooldown is over.
      const retryIn = Math.max(1000, Number(armed.retryInMs) || 1000);
      log(`restart held by cooldown; retrying in ${retryIn}ms`);
      state.deferred = deferred;
      state.deferredFallback = ctx.timeout(() => {
        state.deferredFallback = null;
        if (state.deferred !== deferred) return;
        evaluateDeferred("cooldown elapsed");
      }, retryIn);
    }
  }

  function onSessionIdle(sessionId) {
    if (!state.deferred) return;
    const settings = readSettings();
    if (settings.waitForAllSessions === false) {
      if (state.deferred.sessionId !== sessionId) return;
    }
    evaluateDeferred(`session ${sessionId} reported idle`);
  }

  function cancelCountdown(reason) {
    const by = reason || "user";
    if (clearDeferred(by)) return true;
    if (!state.countdown) return false;
    try {
      state.countdown.cancel?.();
    } catch {
      /* already fired */
    }
    const cancelled = state.countdown;
    state.countdown = null;
    log(`restart cancelled (${by})`);
    appendHistory({ kind: "cancelled", reason: cancelled.reason, by });
    return true;
  }

  function performRestart(plan) {
    const settings = readSettings();
    // Last look before committing: a Session may have started a turn in the
    // moment since the countdown was armed. The helper re-reads the gate file
    // too, so this only has to keep the process alive long enough for that
    // reading to be current.
    pruneRunning();
    if (settings.waitForAllSessions !== false && state.running.size > 0) {
      const postponed = (plan.postpones ?? 0) + 1;
      if (postponed <= BUSY_RETRY_LIMIT) {
        plan.postpones = postponed;
        log(`a session started a turn again; postponing the restart (${postponed}/${BUSY_RETRY_LIMIT})`);
        publishGate(true);
        ctx.timeout(() => performRestart(plan), BUSY_RETRY_MS);
        return;
      }
      log("sessions stayed busy; restarting anyway");
    }
    state.dying = true;
    publishGate(false);
    let pendingWritten = false;
    if (settings.resumeAfterRestart && plan.sessionId) {
      const previous = readPending();
      const attempts =
        previous && previous.sessionId === plan.sessionId ? (previous.attempts ?? 1) + 1 : 1;
      try {
        writePending({
          sessionId: plan.sessionId,
          continuation: plan.continuation,
          reason: plan.reason,
          requestedAt: Date.now(),
          attempts,
          waitedForTurn: plan.waitedForTurn === true,
          hostPid: process.pid,
        });
        pendingWritten = true;
        log(`pending written for session ${plan.sessionId} (attempt ${attempts})`);
      } catch (error) {
        log(`could not write pending: ${error?.message ?? error}`);
      }
    }
    appendHistory({ kind: "restarting", reason: plan.reason, sessionId: plan.sessionId });
    log(`relaunching (host=${process.pid})`);
    try {
      launchRelaunch(process.pid);
    } catch (error) {
      const message = String(error?.message ?? error);
      log(`relaunch spawn failed: ${message}`);
      appendHistory({ kind: "failed", reason: plan.reason, error: message });
      // No helper process will ever run: undo the hand-off and the "dying" state
      // instead of leaving a continuation on disk for a restart that never
      // happened, and leaving the gate stuck at "busy: false".
      if (pendingWritten) clearPending();
      state.dying = false;
      publishGate(state.running.size > 0);
      notify("DSH 重启", `自动重启没能启动：${message}`);
      return;
    }
    // Persist the cooldown anchor only once the helper is actually on its way.
    state.lastRestartAt = Date.now();
    writeLastRestart(state.lastRestartAt);
  }

  /** Boot step: hand the interrupted work back to its own Session. */
  async function resumePendingContinuation() {
    const pending = readPending();
    if (!pending) return;
    const settings = readSettings();
    if (!settings.resumeAfterRestart) {
      clearPending();
      return;
    }
    if (Date.now() - (pending.requestedAt ?? 0) > PENDING_TTL_MS) {
      clearPending();
      appendHistory({ kind: "resume-expired", sessionId: pending.sessionId });
      log("pending continuation expired; dropped");
      return;
    }
    if ((pending.attempts ?? 1) > settings.maxAttempts) {
      clearPending();
      appendHistory({ kind: "resume-given-up", sessionId: pending.sessionId, attempts: pending.attempts });
      log(`pending continuation exceeded ${settings.maxAttempts} attempts; dropped`);
      return;
    }
    // A failed delivery stays on disk so the next launch can retry it, but not
    // on every single boot: back off for two minutes after a failure.
    if (pending.retriedAt && Date.now() - pending.retriedAt < RESUME_RETRY_BACKOFF_MS) {
      log("pending continuation retried too recently; leaving it for the next launch");
      return;
    }

    log(`resuming session ${pending.sessionId} (attempt ${pending.attempts ?? 1})`);
    let agent;
    for (let attempt = 1; attempt <= RESUME_ATTEMPTS; attempt += 1) {
      if (!ctx.sessionController) break;
      try {
        const result = await ctx.sessionController.resolveAgent(pending.sessionId);
        if (result && result.agent) {
          agent = result.agent;
          break;
        }
        log(`resolveAgent miss (${result?.error?.code ?? "unknown"}), try ${attempt}`);
      } catch (error) {
        log(`resolveAgent threw: ${error?.message ?? error}`);
      }
      await sleep(RESUME_RETRY_MS);
    }
    const markRetry = (error) => {
      const message = String(error?.message ?? error);
      try {
        writePending({ ...pending, retriedAt: Date.now(), lastError: message });
      } catch {
        /* pending stays as it was */
      }
      appendHistory({ kind: "resume-failed", sessionId: pending.sessionId, error: message });
      log(`continuation not delivered (${message}); kept on disk for the next launch`);
      notify("DSH 重启", `已重启，但继续指令没投递成功：${message}`);
    };

    if (!agent) {
      markRetry("session unavailable");
      return;
    }

    try {
      // `prompt` is a Remote method: the trailing signal is required, not
      // optional — without it it throws on `signal.throwIfAborted()`.
      const controller = new AbortController();
      const accepted = await ctx.sessionController.prompt({
        requestId: `restart-handoff-${Date.now()}`,
        sessionId: pending.sessionId,
        mode: "queue",
        content: [{ type: "text", text: continuationText(pending) }],
      }, controller.signal);
      appendHistory({ kind: "resumed", sessionId: pending.sessionId, attempts: pending.attempts ?? 1 });
      log(`continuation delivered (${JSON.stringify(accepted)})`);
      clearPending();
    } catch (error) {
      markRetry(error);
    }
  }

  if (!process.__dshAutoRestartResumeScheduled) {
    process.__dshAutoRestartResumeScheduled = true;
    ctx.effect(
      () => ctx.timeout(() => {
        resumePendingContinuation().catch((error) => log(`resume crashed: ${error?.message ?? error}`));
      }, 2500),
      "restart-handoff: resume after boot",
    );
  }

  // --- Turn-end gate ------------------------------------------------------
  // A deferred restart leaves only every turn has closed, so no in-flight
  // answer is truncated by process exit. `api-session/status` covers Sessions
  // driven from the UI; `agent/status` also covers subagents and API callers.
  ctx.effect(
    () => ctx.on("api-session/status", (sessionId, running) => {
      markRunning(sessionId, running !== false);
      if (running === false) onSessionIdle(sessionId);
    }),
    "restart-handoff: turn-end gate (api-session/status)",
  );

  ctx.effect(
    () => ctx.on("agent/status", (payload) => {
      const id = payload && payload.agent && payload.agent.id;
      if (!id) return;
      const status = payload.status;
      if (status === "idle") {
        markRunning(id, false);
        onSessionIdle(id);
      } else if (ACTIVE_STATUSES.has(status)) {
        markRunning(id, true);
      }
    }),
    "restart-handoff: turn-end gate (agent/status)",
  );

  recordBoot();

  // --- Tool ---------------------------------------------------------------
  ctx.effect(
    () => ctx.tools.register({
      name: "restart_handoff",
      description: [
        "重启 DSH 桌面宿主，让必须换新进程才生效的改动真正加载；重启后自动回到本会话继续，不用人再喊一次。",
        "什么时候调：改了插件的宿主端代码（index.js、lib/*）、cordis.patch.yml、依赖，或者 plugin_manager 返回 application: \"restart-required\"——这些热重载都接不住。",
        "什么时候别调：只改了 client.js/界面（会原地刷新）、普通文件或配置改动本来就不需要重启、或者没有任何待生效的改动只是想刷新一下。",
        "调用成功后【必须立刻结束这一回合】：只回一句「已排定重启」就停手，不要再调用任何工具、不要开始任何新任务。这是硬约束，不是建议。",
        "原因：重启只在这一回合结束、你已经写好的那段回答送达用户之后才发生。调用之后你继续干的活，全部跑在旧进程上——正好是这次重启想换掉的环境——而且会和 continuation 里写的同一件事重复做第二遍。",
        "所以「重启完再做 X」这类请求：X 只写进 continuation，这一回合一件都不做；工具一返回就停止，让回合结束。",
        "continuation 写重启后的你要读的第一段话：为什么重启、这一轮做到哪、下一步先做什么、哪些不用重做；插件原样投递（上限 8000 字），留空则只发一句「已重启，继续未完成的工作」。",
        "仅桌面版（macOS）；返回 status：deferred / scheduled / already-scheduled / already-deferred / not-root / disabled / unsupported。凡返回 mustStopNow: true，就表示这一回合必须到此为止。",
        "【谁能调】只有主会话（人正在看的那个）能重启宿主。子代理、子会话、teammate 调用会返回 status: not-root，不会重启——它们该做的是把「改动需要重启」写进自己的结果或发给主会话，由主会话决定。",
        "【有别的 agent 在跑】不拒绝、不催：重启会一直等所有会话都空闲（别的子代理、teammate、其它窗口的对话都算）再执行，等到了就自动重启并投递 continuation。这次调用返回 deferred，调用方照常结束这一回合即可，不需要过一会儿再来调一次。",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "为什么要重启（一句话，最多 500 字）。" },
          continuation: {
            type: "string",
            description:
              "重启后原样投回本会话的那段话，由你自己写（markdown 可用）。写清：为什么重启、上一轮做到哪、接下来第一步做什么、哪些不用重做。不写则只发一句「已重启，继续未完成的工作」。",
          },
          delay_ms: { type: "number", description: "延迟多少毫秒后重启，默认 1500。" },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: "object",
          properties: {
            status: { type: "string" },
            restartAt: { type: "number" },
            delayMs: { type: "number" },
            reason: { type: "string" },
            hasContinuation: { type: "boolean" },
            retryInMs: { type: "number" },
            error: { type: "string" },
            mustStopNow: { type: "boolean" },
            waitFor: { type: "string" },
            note: { type: "string" },
          },
          additionalProperties: true,
        },
        render: (_args, value) => [{ type: "text", text: JSON.stringify(value ?? null) }],
      },
      async execute(args, run) {
        const settings = readSettings();
        if (!settings.toolEnabled) {
          return { status: "disabled", error: "restart_handoff is turned off in Settings > 重启" };
        }
        const finishTool = (result) => {
          if (result.status === "deferred" || result.status === "scheduled") clearHandoff("model wrote its own hand-off");
          appendLog(`tool restart_handoff -> ${result.status}`);
          return result;
        };
        const caller = run?.agent;
        const callerId = typeof caller?.id === "string" ? caller.id : undefined;
        // Only the main Session may restart the host. A delegated child gets a
        // refusal it can relay upward; letting it schedule would hand the
        // restart decision to an Agent whose work the restart interrupts.
        if (isDelegatedAgent(caller)) {
          appendLog(`tool restart_handoff refused: ${callerId ?? "?"} is a child Session`);
          appendHistory({ kind: "restart-refused", why: "not-root", sessionId: callerId });
          return finishTool({
            status: "not-root",
            error:
              "只有主会话可以重启宿主，你是子代理/子会话。把「改动需要重启」写进你的结果或消息交给主会话，由它调用 restart_handoff。",
            mustStopNow: false,
          });
        }
        // Other Sessions still running is not a refusal: the scheduler waits for
        // every one of them to go idle, then restarts. The turn ends now, so the
        // caller does not have to come back and ask again.
        const input = args && typeof args === "object" ? args : {};
        const result = scheduleRestart({
          reason: typeof input.reason === "string" ? input.reason : "agent requested restart",
          continuation: typeof input.continuation === "string" ? input.continuation : "",
          sessionId: rootSessionOf(run?.agent?.id),
          delayMs: Number.isFinite(input.delay_ms) ? input.delay_ms : TOOL_RESTART_DELAY_MS,
        });
        return finishTool(finishQueued(result));
      },
    }),
    "restart-handoff: tool restart_handoff",
  );

  // --- Automatic trigger ---------------------------------------------------
  ctx.effect(
    () => ctx.on("tools/post-execute", async (exec, result, next) => {
      try {
        // The model is supposed to stop the moment restart_handoff returns. If it
        // keeps working, the work runs on the old process and duplicates the
        // continuation — record it so the miss is visible instead of silent.
        const queued = state.deferred;
        if (queued && exec && exec.name !== "restart_handoff" && !queued.lateTool) {
          // Only the caller's own tools count. Subagents run under the same root
          // Session, so matching on the root alone turned every delegated task
          // started after the call into a false "late tool" alarm.
          const agentId = exec.agent?.id;
          const ownTurn =
            Boolean(agentId) &&
            !isDelegatedAgent(exec.agent) &&
            (!queued.sessionId || rootSessionOf(agentId) === queued.sessionId);
          if (ownTurn) {
            queued.lateTool = exec.name;
            log(`[warn] tool "${exec.name}" ran after restart_handoff in the same turn; the model should have ended the turn (restart still waits for it)`);
            appendHistory({ kind: "late-tool", tool: exec.name, sessionId: queued.sessionId });
          }
        }
        if (exec && MANAGER_TOOLS.has(exec.name)) {
          const verdict = restartVerdictOf(result);
          if (verdict) {
            const settings = readSettings();
            appendHistory({
              kind: "restart-required",
              tool: exec.name,
              restartReason: verdict.restartReason,
            });
            log(`plugin manager reported restart-required (${verdict.restartReason ?? "unknown"})`);
            if (settings.autoRestart && isDelegatedAgent(exec.agent)) {
              // A child announcing restart-required does not own the decision:
              // its result already tells the main Session, which restarts when
              // nothing else is running.
              log("restart-required came from a child Session; leaving the restart to the main Session");
              appendHistory({
                kind: "restart-refused",
                why: "not-root",
                tool: exec.name,
                sessionId: exec.agent?.id,
              });
            } else if (settings.autoRestart) {
              requestHandoff(
                `plugin-manager: ${verdict.restartReason ?? "restart-required"}`,
                exec.agent?.id,
              );
            }
          }
        }
      } catch (error) {
        log(`post-execute check failed: ${error?.message ?? error}`);
      }
      return next();
    }),
    "restart-handoff: watch plugin-manager results",
  );

  // --- Settings > 自动重启 panel routes -------------------------------------
  function route(method, path, handler) {
    ctx.effect(
      () => ctx.webServer.register({
        kind: "exact",
        path,
        handler: async (req, res) => {
          try {
            const rejection = ctx.connection.requestRejection(req);
            if (rejection !== void 0) {
              res.statusCode = rejection;
              res.end();
              return;
            }
            if (req.method !== method) {
              res.statusCode = 405;
              res.setHeader("allow", method);
              res.end();
              return;
            }
            let body = {};
            if (method !== "GET") {
              const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
              if (!contentType.startsWith("application/json")) {
                sendJson(res, 415, { ok: false, error: "expected application/json" });
                return;
              }
              const raw = await readBoundedBody(req, MAX_BODY_BYTES);
              if (raw.trim() !== "") {
                try {
                  body = JSON.parse(raw);
                } catch {
                  sendJson(res, 400, { ok: false, error: "invalid JSON body" });
                  return;
                }
              }
            }
            const payload = await handler(body, req);
            sendJson(res, 200, { ok: true, ...payload });
          } catch (error) {
            if (!res.headersSent) sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
            else res.end();
          }
        },
      }),
      `restart-handoff: ${method} ${path}`,
    );
  }

  route("GET", `${ROUTE_PREFIX}/status`, () => ({
    desktop: isDesktop(),
    settings: readSettings(),
    bootedAt: state.bootedAt,
    handoff: state.handoff
      ? { active: true, reason: state.handoff.reason, sessionId: state.handoff.sessionId }
      : { active: false },
    deferred: state.deferred
      ? {
          active: true,
          reason: state.deferred.reason,
          sessionId: state.deferred.sessionId,
          requestedAt: state.deferred.requestedAt,
        }
      : { active: false },
    countdown: state.countdown
      ? {
          active: true,
          restartAt: state.countdown.restartAt,
          totalMs: state.countdown.delayMs ?? 0,
          reason: state.countdown.reason,
        }
      : { active: false },
    busy: { count: state.running.size, sessions: [...state.running] },
    boot: state.boot,
    pending: readPending(),
    history: readHistory(6),
    logPath: logPath(),
    appPath: isDesktop() ? appPath() : null,
  }));

  route("POST", `${ROUTE_PREFIX}/restart`, (body) =>
    scheduleRestart({
      reason: typeof body.reason === "string" ? body.reason : "user requested restart",
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      delayMs: Number.isFinite(body.delayMs) ? body.delayMs : 0,
    }));

  route("POST", `${ROUTE_PREFIX}/cancel`, (body) => ({
    cancelled: cancelCountdown(typeof body.by === "string" ? body.by : "user"),
  }));

  route("POST", `${ROUTE_PREFIX}/settings`, (body) => {
    const patch = {};
    if (typeof body.autoRestart === "boolean") patch.autoRestart = body.autoRestart;
    if (typeof body.toolEnabled === "boolean") patch.toolEnabled = body.toolEnabled;
    if (typeof body.resumeAfterRestart === "boolean") patch.resumeAfterRestart = body.resumeAfterRestart;
    if (typeof body.deferUntilIdle === "boolean") patch.deferUntilIdle = body.deferUntilIdle;
    if (typeof body.waitForAllSessions === "boolean") patch.waitForAllSessions = body.waitForAllSessions;
    if (typeof body.pruneAuthCookies === "boolean") patch.pruneAuthCookies = body.pruneAuthCookies;
    if (Number.isFinite(body.graceMs)) patch.graceMs = Math.min(60000, Math.max(0, body.graceMs));
    if (Number.isFinite(body.cooldownMs)) patch.cooldownMs = Math.min(30 * 60 * 1000, Math.max(0, body.cooldownMs));
    if (Number.isFinite(body.maxAttempts)) patch.maxAttempts = Math.min(10, Math.max(1, Math.round(body.maxAttempts)));
    if (!Object.keys(patch).length) throw new Error("no supported setting in request body");
    return { settings: writeSettings(patch) };
  });

  // A clean quit of the app (Cmd-Q, window close) is not a crash: record it so
  // the next boot does not report an unexpected exit.
  ctx.effect(
    () => () => {
      try {
        markShutdown(process.pid);
      } catch {
        /* never block disposal */
      }
    },
    "restart-handoff: shutdown marker",
  );

  ctx.logger?.info?.("restart-handoff ready (auto=%s, tool=%s)", settingsAtBoot.autoRestart, settingsAtBoot.toolEnabled);
  log(`plugin applied (auto=${settingsAtBoot.autoRestart}, grace=${settingsAtBoot.graceMs}ms)`);
}