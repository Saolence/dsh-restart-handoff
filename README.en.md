<p align="center"><img src="icon.svg" width="84" alt="dsh-restart-handoff"></p>

<h1 align="center">dsh-restart-handoff</h1>

<p align="center"><strong>When a change needs a restart, restart the host and hand the conversation back to the same session.</strong></p>

<p align="center"><a href="README.md">简体中文</a> · <strong>English</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2f6f4f?style=flat-square"></a>
  <img alt="macOS only" src="https://img.shields.io/badge/platform-macOS-4b6fff?style=flat-square">
  <img alt="DSH Desktop only" src="https://img.shields.io/badge/host-DSH%20Desktop-7da1de?style=flat-square">
  <a href="https://github.com/Saolence/dsh-restart-handoff/releases/latest"><img alt="latest release" src="https://img.shields.io/github/v/release/Saolence/dsh-restart-handoff?style=flat-square"></a>
  <a href="https://github.com/Saolence/dsh-restart-handoff/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/Saolence/dsh-restart-handoff?style=flat-square"></a>
</p>


<div align="center">

> A plain restart throws the work away: the app closes, reopens, and you have to explain where you were all over again.
> This plugin keeps the missing half alive across the relaunch — **why** the restart happened and **what to do next**.
>
> *普通的「重启」只是关掉再打开：你正在做的事全没了，得从头解释一遍自己在哪一步。*

</div>

## The problem

After an agent edits plugin code, the host answers `application: "restart-required"` — the change only takes effect after a restart. So you quit the app, reopen it, remember what you were half way through, and type it again.

This plugin connects those three steps:

- **You don't have to remember** — the "what next" is written to disk before the restart and comes back as the session's next message;
- **Your answer is never cut off** — the restart is parked until the current turn finishes and is delivered;
- **No restart storms** — cooldown, attempt cap and a one-shot continuation; colliding requests still restart only once.

## Three ways to start one

| Trigger | Who starts it | When it fires |
| --- | --- | --- |
| Automatic | the host watches `plugin_manager` tool results | the result says `restart-required` — the change can only take effect after a restart |
| Tool | the agent calls `restart_handoff` | the agent knows what it just changed and writes its own hand-off |
| Manual | Settings → 重启交接 (Restart handoff) → 现在重启 | you want a restart now (**this one does not resume**) |

When the two automatic paths collide, the later one stands down (log: `hand-off request dropped`); an already pending request answers `already-scheduled` / `already-deferred`.

## What arrives after the restart

Not a template — a message **written by the model**. The plugin only carries it, verbatim:

> 🔄 **DSH restarted itself, picking up where we stopped**
>
> **What happened**: the trigger was `plugin-manager: host-module`; the previous turn ended after its answer was delivered (not a crash), so the context is intact.
>
> **What to do next**: ① continue from where that sentence was cut: wire the new switch in `client.js`; ② first check whether the previous step was left half done.

Templates only cover three cases: no hand-off text, hand-off timed out (2 minutes), or no session id.

## Install

Requires the DSH **desktop** app (Electron). The host half relaunches the app, so a plain web or CLI host answers `status: "unsupported"`.

**From the release tarball** (no npm account needed):

```
plugin_manager: { action: "install_bundle", target: "/absolute/path/to/saolence-dsh-restart-handoff-0.1.0.tgz" }
```

**From npm** (once published):

```
plugin_manager: { action: "install_bundle", target: "@saolence/dsh-restart-handoff" }
```

**From a checkout**:

```
plugin_manager: { action: "install_bundle", target: "/absolute/path/to/dsh-restart-handoff" }
```

`package.json` declares `dsh.bundle.patch`, so the bundle's `cordis.patch.yml` inserts the `restart-handoff` entry automatically. Disabling it later:

```
plugin_manager: { action: "set_plugin", target: "include:restart-handoff", enabled: false }
```

> ⚠️ **Editing this package does not hot-reload.** The profile links to it and HMR never sees the change; toggle the entry off/on (or restart once) after editing `index.js` / `client.js`.

## Settings panel

Settings → 重启交接 (Restart handoff):

> Naming: the settings section is 重启交接, the plugin list shows the package name `dsh-restart-handoff`, and the sidebar keeps the icon only.

One big card says what is going on right now — plain words, no jargon. Below it sit only the three switches that matter:

- **Restart automatically when a change needs it** — on by default; watches `plugin_manager` results for `restart-required`;
- **Wait until every task is done** — on by default; never cuts a running conversation, subagent or other window short;
- **Continue automatically after the restart** — on by default; delivers the hand-off back into this conversation.

**More settings** folds away the three you rarely touch: let the agent ask for a restart, finish the turn first, prune stale login records.
**Restart now** on the card needs a second click to confirm and does not resume; while counting down or queued the same spot offers **not now**.

Just **above the account row** at the sidebar foot sits an **icon-only** circular button (`↻`, the same 24px muted chip and 12px radius as the account row icon) with no "重启" text — the wording only appears on hover. A click opens a small yes / no popover; after yes the button turns amber and counts down three seconds with a tiny progress ring beside it, then restarts — clicking again during those seconds cancels. While a restart is queued or already scheduled, the ring (a pause glyph when queued) appears and a click cancels.

Settings live in `~/.dsh/restart-handoff/settings.json`, events in `history.jsonl`, the full log in `~/.dsh/restart-handoff.log`.

## The full path of one restart

```
a change needs a restart
      │
      ├── automatic: the host sees restart-required → asks the model (steer)
      │              "write the hand-off, then call restart_handoff"
      │              └── no answer in 2 minutes: restart with a one-line note
      └── tool: the agent calls restart_handoff({ continuation })
      │
      ▼
park the request    pending.json ← { sessionId, continuation, reason, requestedAt, attempts }
      ▼
wait until every session is idle    another session mid-answer holds it (gate.json, refreshed each second)
      ▼
1.5 s countdown (cancelable) → detached sh helper
      │   re-read gate.json (up to 900 s if someone started again) · write exit.json once the app is really gone
      │   quit the app · clear singleton locks · prune stale login cookies · open -n
      │   verify the new main process is alive
      ▼
new host boots, plugin loads: compares exit.json / boot.json (planned restart vs unexpected exit)
      ▼
2.5 s later: resolveAgent(sessionId) → prompt({ mode: "queue", content: [hand-off] }) → delete pending.json
      ▼
the same session's next message is that hand-off
```

## Who it waits for

Waiting for the current turn is not enough: another session may be writing an answer, and killing the host for it would swallow that answer. So the plugin keeps a list of sessions that are running right now:

- `api-session/status` and `agent/status` both feed that list;
- while it is non-empty the parked restart does not start counting down — the panel says "waiting for N sessions to finish";
- the moment the list empties, the 1.5 s countdown starts;
- `performRestart` checks once more: a session that started in between postpones the restart by 2 s, at most 60 times;
- the helper checks a **third** time right before touching the app: it reads `busy`, `waitAll` and `at` from `gate.json` (older than 8 s counts as "host is gone, not busy") and polls every 0.5 s for up to 900 s, the same 15-minute cap the host uses; with `waitAll: false` it stops waiting altogether.

If the old app cannot be killed, the helper gives up on this restart (`could not stop the old app; aborting the restart`): it writes no `exit.json` and starts no second copy — a later boot reports an unexpected exit rather than a clean restart that never happened.

Turning "wait for all sessions" off in the panel falls back to the old behaviour: only the asking session matters.

## Who may start one: the main session only

Restarting the host interrupts every turn in flight, so the decision sits with the main session — the one the human is looking at:

- **a subagent, child session, or teammate calling `restart_handoff` is refused** with `status: "not-root"`: nothing is queued and nothing restarts. It should carry "this change needs a restart" back in its result or a message.
- the automatic trigger follows the same rule: a `restart-required` verdict from a child session is only logged (`restart-refused` in `history.jsonl`), never acted on; the main session sees the child's result and decides.
- **a main-session call while other agents/sessions are still running is not refused**: the restart waits until every session is idle (subagents, teammates and conversations in other windows included), then restarts and delivers the hand-off. The caller just ends its turn — no need to ask again. A 15-minute cap still restarts even if idle events were missed.
- two signals decide "child": the Session header (`origin: "subagent"` / `parentSession`) and the Agent registry's ownership chain (`isOwnedBy`). Both must say "root" for the tool to proceed.
- dead entries in the running set are pruned against the Agent registry, but only after **5 seconds** of continuous absence (a plugin reload briefly hides live sessions), so one bad reading cannot pin the restart until the 15-minute cap.

The panel button and the automatic trigger are exempt: a human pressed one, and the other belongs to the main session itself. `waitForAllSessions` still applies to them.

## Tool: `restart_handoff`

```json
{
  "reason": "swapped the sidebar plugin",
  "continuation": "## why\n…\n## where I was\n…\n## next step\n…",
  "delay_ms": 1500
}
```

It returns immediately — it neither blocks nor waits for the restart:

| Result | Meaning |
| --- | --- |
| `deferred` | parked; the restart happens after this turn ends |
| `scheduled` | the countdown is already running |
| `already-deferred` / `already-scheduled` | one request is already pending |
| `not-root` | the caller is a subagent/child session: no restart rights |
| `cooldown` / `disabled` / `unsupported` | cooling down / turned off / not a desktop host |

The "restart finished" result never arrives through this tool — **the proof of completion is the hand-off itself**, which arrives as the next message in the session.

`next_step` has been removed (the schema rejects it); use `continuation`.

## Files it writes

```
~/.dsh/restart-handoff/
├── pending.json     # survives the restart; deleted once the hand-off is delivered
├── settings.json    # created on first change; missing file = defaults
├── gate.json        # refreshed every second while alive: is any session running (the helper reads it)
├── exit.json        # written by the helper only after the old app is gone: "this exit is a planned restart"
├── boot.json        # written on every boot: pid + time, to judge the previous exit
├── last-restart.json # when the last restart actually happened: keeps the cooldown across boots
└── history.jsonl    # append-only event log for the panel (trimmed to the last 400 lines past 512 KB)
~/.dsh/restart-handoff.log   # full text log, including the helper script's own output
```

## Known boundaries

- **The tool only shows up in new sessions.** Which tools a session can call is fixed when that session is created. If the plugin was installed afterwards — or the host was restarted since — an already-open session never gets `restart_handoff`, and restarting the host does not refresh it. Open a new chat to use the tool; older sessions can still restart from the panel or the automatic trigger.
- **Desktop only.** Other hosts get `status: "unsupported"`.
- **macOS only for now**: the restart helper is a `/bin/sh` script that quits the app with `osascript` and reopens it with `open -n`.
- A restart still kills whatever step was running — a shell command cannot be resumed, only re-run. The hand-off says *where to pick up*, not *what was in flight*.
- **The GUI port can change** across restarts; use the address the app prints, not a bookmark.
- The manual "Restart now" button never resumes: no pending record is written.
- The cooldown timestamp is persisted in `last-restart.json`, so it survives restarts; `pending.json` also carries the attempt count and a 10 minute TTL, so a crash loop cannot go on forever.
- "All sessions idle" relies on the statuses the host reports; something invisible to those statuses (an external script killing the process) is not held back.
- Login-cookie pruning keeps only the newest `dsh-auth-*`: if the app ever depends on several scoped sessions, turn the switch off.
- An unexpected exit is judged by the pid in `boot.json`: a crash that happened while the plugin was disabled is reported once, not blamed.

## Development

```bash
node --check index.js && node --check client.js
node test/smoke.mjs          # state round-trip + helper script assertions, no Harness needed
```

Panel preview without installing anything (a tiny React stand-in plus a static page):

```bash
cd test/preview && cp ../../client.js . && python3 -m http.server 8781
# open http://127.0.0.1:8781/preview.html?s=idle
```

`s` is one of `idle` / `countdown` / `waiting` / `handoff` / `empty`.

## Layout

```
.
├── index.js             # host: scheduling, tool, post-execute watcher, HTTP routes
├── client.js            # settings panel (__ModuleLoader__ + settings.section)
├── lib/relaunch.js      # sh helper: quit → clear locks → open -n → confirm alive
├── lib/state.js         # pending / settings / history / log
├── cordis.patch.yml     # one insert entry
├── locale/{en,zh}.json  # name and blurb in the plugin list
├── icon.svg
└── test/                # smoke test + panel preview harness
```

## License

MIT

---

[简体中文](README.md) · **English**
