/**
 * dsh-restart-handoff — relaunch helper.
 *
 * The helper script is spawned detached (its own process group) so that it
 * survives the Electron tree it is about to kill. It quits the app through
 * LaunchServices, escalates to signals only if needed, clears the stale
 * Electron singleton locks, and then re-opens the app until a *new, live*
 * main process appears.
 *
 * Only meaningful inside the DSH desktop app.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

/** App bundle directory, derived from the Electron executable path. */
export function appPath() {
  const exec = process.execPath;
  const bundled = resolve(dirname(dirname(dirname(exec))));
  if (bundled.endsWith(".app") && bundled.includes("DeepSeek Harness")) return bundled;
  return "/Applications/DeepSeek Harness.app";
}

/** Log every helper line goes to (host half appends to the same file). */
export function logPath() {
  return process.env.DSH_RESTART_HANDOFF_LOG || `${process.env.HOME}/.dsh/restart-handoff.log`;
}

/**
 * Shell script that survives its parent: it is spawned detached (new
 * process group), so the Electron main killing the host does not take it
 * down with the rest of the tree.
 */
export function helperScript(hostPid) {
  const app = process.env.DSH_RESTART_HANDOFF_APP || appPath();
  const log = logPath();
  return `#!/bin/sh
# dsh-restart-handoff relaunch helper (generated)
LOG="${log}"
mkdir -p "$HOME/.dsh" 2>/dev/null || true
log() { printf '%s %s\\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG" 2>/dev/null; }

APP="${app}"
MAIN_BIN="$APP/Contents/MacOS/DeepSeek Harness"
HOST_PID=${hostPid}
OLD_MAIN=
LAUNCH_SCRIPT="$HOME/Library/Application Support/@deepseek-ai/dsh-desktop"
STATE_DIR="\${DSH_RESTART_HANDOFF_DIR:-$HOME/.dsh/restart-handoff}"
GATE_FILE="$STATE_DIR/gate.json"
EXIT_FILE="$STATE_DIR/exit.json"
SETTINGS_FILE="$STATE_DIR/settings.json"

log "restart requested (host=$HOST_PID)"

# Only one helper may work at a time: the panel button, a queued restart and a
# direct call can all reach this script within a few seconds. Two helpers racing
# means killing the app twice and opening it twice.
LOCK_DIR="$STATE_DIR/relaunch.lock"
mkdir -p "$STATE_DIR" 2>/dev/null || true
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  lock_mtime=$(stat -f %m "$LOCK_DIR" 2>/dev/null || echo 0)
  lock_age=$(( $(date +%s) - lock_mtime ))
  if [ "$lock_age" -lt 900 ]; then
    log "another restart is already in progress (lock age \${lock_age}s); leaving it to finish"
    exit 0
  fi
  log "removing a stale relaunch lock (age \${lock_age}s)"
  rm -rf "$LOCK_DIR" 2>/dev/null || true
  mkdir "$LOCK_DIR" 2>/dev/null || { log "cannot take the relaunch lock; exiting"; exit 0; }
fi
trap 'rm -rf "$LOCK_DIR" 2>/dev/null' EXIT INT TERM HUP

# The host keeps gate.json fresh (busy flag + timestamp) while a restart is
# pending. Between the host's last look and this script taking over, another
# Session may have started a turn, so re-read it here: the last chance to avoid
# cutting someone off mid-answer. "waitAll": false means the user turned that
# protection off, so the gate must not block here either.
gate_busy() {
  [ -f "$GATE_FILE" ] || return 1
  grep -q '"waitAll"[[:space:]]*:[[:space:]]*false' "$GATE_FILE" 2>/dev/null && return 1
  grep -q '"busy"[[:space:]]*:[[:space:]]*true' "$GATE_FILE" 2>/dev/null || return 1
  gate_at=$(sed -n 's/.*"at"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' "$GATE_FILE" 2>/dev/null | head -1)
  [ -n "$gate_at" ] || return 1
  gate_now=$(( $(date +%s) * 1000 ))
  [ $(( gate_now - gate_at )) -lt 8000 ] || return 1
  return 0
}

# Wait as long as the host itself would (15 min): by the time this script runs,
# the host has already decided to restart and only a last-second turn can hold it.
waited=0
while gate_busy && [ "$waited" -lt 1800 ]; do
  [ "$waited" -eq 0 ] && log "another session is still running; holding the restart"
  sleep 0.5
  waited=$((waited + 1))
done
if [ "$waited" -gt 0 ]; then
  log "idle gate released after \${waited} half-seconds"
fi
gate_busy && log "sessions still busy after 900s; restarting anyway"

# The planned-restart marker is written only after the old app is really gone
# (see below): writing it first would turn a crash during shutdown into a
# "clean restart" the next boot trusts.

# Prefer a clean AppleEvent quit: LaunchServices tears the app down properly,
# so an immediate relaunch works and the billion-context proxy survives.
# Signals are only the fallback: after a SIGKILL, LS can keep a stale
# "running" registration for minutes during which every open silently no-ops.
osascript -e 'with timeout of 8 seconds' -e 'tell application "DeepSeek Harness" to quit' -e 'end timeout' >>"$LOG" 2>&1 || true
sleep 1

MAIN=$(ps -o ppid= -p "$HOST_PID" 2>/dev/null | tr -d ' ')
if [ -z "$MAIN" ] || [ "$MAIN" = "1" ]; then
  MAIN=$(pgrep -f "^$MAIN_BIN\\$" 2>/dev/null | head -1)
fi

if [ -n "$MAIN" ]; then
  OLD_MAIN="$MAIN"
  log "SIGTERM main=$MAIN"
  BILI_PIDS=$(ps -axo pid,ppid,command 2>/dev/null | awk -v p="$HOST_PID" '$2 == p && /billion-context\\/dist\\/index\\.js start/ { print $1 }')
  kill -TERM "$MAIN" 2>/dev/null

  i=0
  while [ $i -lt 20 ]; do
    kill -0 "$MAIN" 2>/dev/null || break
    sleep 0.25
    i=$((i+1))
  done

  if kill -0 "$MAIN" 2>/dev/null; then
    log "main still alive; SIGTERM host=$HOST_PID"
    kill -TERM "$HOST_PID" 2>/dev/null
    i=0
    while [ $i -lt 12 ]; do
      kill -0 "$MAIN" 2>/dev/null || break
      sleep 0.25
      i=$((i+1))
    done
  fi

  if kill -0 "$MAIN" 2>/dev/null; then
    log "SIGKILL main=$MAIN"
    kill -KILL "$MAIN" 2>/dev/null
  fi
  kill -0 "$HOST_PID" 2>/dev/null && kill -KILL "$HOST_PID" 2>/dev/null

  i=0
  while [ $i -lt 40 ]; do
    pgrep -f "^$APP/Contents/" >/dev/null 2>&1 || break
    sleep 0.25
    i=$((i+1))
  done
  pkill -f "^$APP/Contents/" 2>/dev/null

  # The billion-context proxy is a child of the host; drop stale ones.
  for bili_pid in $BILI_PIDS; do
    kill -0 "$bili_pid" 2>/dev/null && kill -KILL "$bili_pid" 2>/dev/null
  done
else
  log "no Electron main found; launching app"
fi

# Do not claim a planned restart — and do not launch a second copy — unless the
# old app is really gone. A SIGKILL that did not take is better reported as an
# abnormal exit than as a clean restart.
if pgrep -f "^$APP/Contents/" >/dev/null 2>&1; then
  pkill -KILL -f "^$APP/Contents/" 2>/dev/null || true
  i=0
  while [ $i -lt 20 ]; do
    pgrep -f "^$APP/Contents/" >/dev/null 2>&1 || break
    sleep 0.25
    i=$((i+1))
  done
fi
if pgrep -f "^$APP/Contents/" >/dev/null 2>&1; then
  log "could not stop the old app; aborting the restart so no second copy starts"
  osascript -e 'display notification "旧进程没能退出，本次自动重启已取消" with title "DSH 重启"' >>"$LOG" 2>&1 || true
  exit 1
fi

# Only now is this a planned restart: the next boot compares exit.json against
# boot.json to tell "replaced on purpose" from "crashed".
mkdir -p "$STATE_DIR" 2>/dev/null || true
printf '{"kind":"restart","at":%s,"hostPid":%s}\\n' "$(( $(date +%s) * 1000 ))" "$HOST_PID" > "$EXIT_FILE" 2>/dev/null || true

# No app process remains, so a stale Electron single-instance lock is safe to clear.
rm -f "$LAUNCH_SCRIPT/SingletonLock" "$LAUNCH_SCRIPT/SingletonCookie" "$LAUNCH_SCRIPT/SingletonSocket" 2>/dev/null

# Every launch leaves one more dsh-auth-* cookie behind and nothing prunes
# them, so the request header keeps growing until the server answers 4xx.
# Keep the newest one (the one the app just used) and drop the rest.
prune_auth_cookies() {
  [ -f "$SETTINGS_FILE" ] && grep -q '"pruneAuthCookies"[[:space:]]*:[[:space:]]*false' "$SETTINGS_FILE" && return 0
  cookies="$LAUNCH_SCRIPT/Cookies"
  [ -x /usr/bin/sqlite3 ] && [ -f "$cookies" ] || return 0
  removed=$(/usr/bin/sqlite3 "$cookies" "DELETE FROM cookies WHERE rowid IN (SELECT rowid FROM cookies WHERE name LIKE 'dsh-auth-%' ORDER BY creation_utc DESC LIMIT -1 OFFSET 1); SELECT changes();" 2>/dev/null | tail -1)
  case "$removed" in
    ''|*[!0-9]*) return 0 ;;
    0) return 0 ;;
    *) log "pruned $removed stale login cookie(s)" ;;
  esac
}
prune_auth_cookies

# After a SIGKILL, LaunchServices can keep a stale "running" registration for
# minutes: a plain "open" then only sends an activate event into the void and
# nothing comes up (seen repeatedly: a dozen silent opens, osascript -1712).
# "open -n" below forces a fresh instance regardless; we still retry until a
# *new, live* main appears.
sleep 1.5

new_main_pid() {
  for pid in $(pgrep -f "^$MAIN_BIN\\$" 2>/dev/null); do
    [ -n "$OLD_MAIN" ] && [ "$pid" = "$OLD_MAIN" ] && continue
    st=$(ps -o stat= -p "$pid" 2>/dev/null | tr -d ' ')
    case "$st" in *Z*) continue ;; esac
    kill -0 "$pid" 2>/dev/null || continue
    printf '%s' "$pid"
    return 0
  done
  return 1
}

deadline=$(( $(date +%s) + 420 ))
attempt=1
while [ "$(date +%s)" -lt "$deadline" ]; do
  case "$attempt" in
    5) log "attempt $attempt: fallback open -n -b com.deepseek.dsh"; open -n -b com.deepseek.dsh >>"$LOG" 2>&1 ;;
    8) log "attempt $attempt: fallback open -n -a"; open -n -a "DeepSeek Harness" >>"$LOG" 2>&1 ;;
    *) log "attempt $attempt: open -n $APP"; open -n "$APP" >>"$LOG" 2>&1 ;;
  esac

  i=0
  while [ $i -lt 3 ]; do
    sleep 1
    pid=$(new_main_pid) || { i=$((i+1)); continue; }
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      log "app relaunched (pid=$pid, attempt=$attempt)"
      exit 0
    fi
    i=$((i+1))
  done
  attempt=$((attempt+1))
  sleep 2
done

log "relaunch timed out: app did not come back"
osascript -e 'display notification "自动重启失败，请手动打开 DSH" with title "DSH 重启"' >>"$LOG" 2>&1
exit 1
`;
}

/** Spawn the detached helper; never let it inherit our stdio. */
export function launchRelaunch(hostPid) {
  // Do not inherit the GUI app's environment wholesale: vars like
  // __CFBundleIdentifier can derail LaunchServices. Hand the helper a
  // minimal, known-good environment instead.
  const env = {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: process.env.HOME,
    USER: process.env.USER ?? process.env.LOGNAME,
    TMPDIR: process.env.TMPDIR,
    LANG: process.env.LANG ?? "zh_CN.UTF-8",
    DSH_RESTART_HANDOFF_APP: process.env.DSH_RESTART_HANDOFF_APP,
    DSH_RESTART_HANDOFF_LOG: logPath(),
    DSH_RESTART_HANDOFF_DIR: process.env.DSH_RESTART_HANDOFF_DIR,
  };
  const child = spawn("/bin/sh", ["-c", helperScript(hostPid)], {
    detached: true,
    stdio: "ignore",
    env,
  });
  child.unref();
  return child.pid;
}
/**
 * Post a desktop notification. Best effort: never throws, and only on macOS
 * inside the desktop app (osascript is the only path that needs no deps).
 */
export function notify(title, message) {
  if (process.platform !== "darwin") return false;
  const clean = (value) => String(value).replace(/[\\"]/g, " ").replace(/\s+/g, " ").slice(0, 200);
  try {
    const child = spawn(
      "/usr/bin/osascript",
      ["-e", `display notification "${clean(message)}" with title "${clean(title)}"`],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}
