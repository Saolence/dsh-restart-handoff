<p align="center"><img src="icon.svg" width="84" alt="dsh-restart-handoff"></p>

<h1 align="center">dsh-restart-handoff</h1>

<p align="center"><strong>An auto-restart plugin for DeepSeek Harness Desktop: when a change only takes effect after a restart, it restarts the host for you and hands "why we restarted, what to do next" back to the same session — restart as often as you like, the task never loses the thread.</strong></p>

<p align="center"><a href="README.md">简体中文</a> · <strong>English</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2f6f4f?style=flat-square"></a>
  <img alt="macOS only" src="https://img.shields.io/badge/platform-macOS-4b6fff?style=flat-square">
  <img alt="DSH Desktop only" src="https://img.shields.io/badge/host-DSH%20Desktop-7da1de?style=flat-square">
  <a href="https://github.com/Saolence/dsh-restart-handoff/releases/latest"><img alt="latest release" src="https://img.shields.io/github/v/release/Saolence/dsh-restart-handoff?style=flat-square"></a>
  <a href="https://github.com/Saolence/dsh-restart-handoff/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/Saolence/dsh-restart-handoff?style=flat-square"></a>
</p>

> A plain restart throws the work away: you close the window, reopen it, and explain where you left off.
> This plugin keeps the missing half — **why the restart happened and what the first step is** — alive across the relaunch.

## In one sentence

After you change a plugin or install something, DSH (DeepSeek Harness) says it needs a restart. Restarting by hand means closing the window, reopening it, remembering where you were, and re-typing the request.

This plugin fills that gap: it writes a hand-off note to disk before the restart, and the note arrives as the first message of the session afterwards, so the model picks up where it stopped. **Restart five times in one task and it resumes five times, without a break in between.**

It does not modify your models and it never talks to the network — it only reads and writes a few state files on your own machine.

## Why use it

**Unlimited continuation.** Every restart carries "what is done, what comes next" across, so the model continues instead of asking again. A plugin change that needs three restarts, a harness change that needs ten — it is still one thread.

**The model knows what happened before the restart.** The note is written by the model itself, while the context is fresh: why we restarted, what this round accomplished, the first step afterwards, what not to redo. Not a generic reassurance.

**It matters most when you change plugins or the harness.** Those changes almost always force a restart, and a restart is exactly when context gets lost — which is the reason this plugin exists.

**You don't have to remember or re-explain.** Nobody has to ask "where were we?" — it is already answered when you come back.

**The restart itself stays out of the way.** It won't cut off the answer in flight, it waits for every window to go idle, it cools down for 60 seconds, and when it refuses it says how many seconds are left.

## Four moments you will use it

**1. An agent changed plugin code**

The host answers `application: "restart-required"`. The plugin restarts by itself; a few seconds later you are back in the same session, with the hand-off note as the first message.

**2. You know the change needs a restart**

Tell the model "restart when you're done". It calls the tool once, writes the hand-off while the context is fresh, then restarts.

**3. You are changing DeepSeek Harness itself**

Editing a built-in tool, editing host code, restarting over and over to run tests — each round comes back carrying the previous round's progress, so the request never has to be restated.

**4. You just want the new build now**

Settings → "Restart handoff" → "Restart now". This one only restarts; it does not auto-resume.

## What you see after a restart

Not a fixed template — four lines the model writes, laid out by a template you control:

```text
## DSH restarted · 15:04

- Why: the settings switches were invisible in dark mode

- Done: switch background changed to a layer colour, two lines added to the docs

- Next: refresh the window and check the switch is visible in dark mode

- Don't redo: no need to run the tests again
```

If the model leaves a field empty, that whole line disappears — no "Next: (empty)".

A one-line fallback appears only in three cases: the model wrote nothing, five minutes passed, or the session id could not be resolved. It reads: "DSH just restarted, carry on with what's left."

## Where it stays out of the way

- **It waits for every window** — not just the current session: subagents and other windows count too.
- **It will not loop** — at least 60 seconds between restarts; one resume per restart; a hand-off note is delivered at most three times.
- **It says why when it refuses** — tapping restart inside the cooldown tells you "restarted just now, wait 42 more seconds" instead of pretending it started.

## How it differs from restarting by hand

| | Restart by hand | This plugin |
| --- | --- | --- |
| When it happens | whenever you remember | after this turn ends and every window is idle |
| Where you left off | you have to recall it | written to disk before the restart, shown right after |
| Answer cut mid-sentence | possible | never |
| Changing your mind | the app is already gone | cancel inside the 5-second countdown |
| Restart loops | possible | 60-second cooldown, colliding requests restart once |

## FAQ

### Does a restart lose the conversation I am in the middle of?

No. The plugin waits for the current turn to finish and its results to be written, then waits for every window to go idle, and only then starts a five-second countdown. Cancel during the countdown and nothing happens; if you miss it, the hand-off note is already on disk and returns to the same session after the relaunch.

### If one task restarts several times, does the context break?

No. One restart, one resume: the note survives the process and the model reads it first after the relaunch. A long chain thins out — each hop only carries a paragraph — but it never breaks in two.

### Will it restart on its own again and again?

No. There is a hard 60-second gap (`cooldownMs`) between restarts, and any request inside it is refused with the number of seconds left. An automatic request that gets refused is not dropped — it retries once the cooldown expires.

### Can I restart without the automatic resume?

Yes — turn off "Resume after restart". It then restarts only, delivers nothing, and waits for you to speak.

### Can I change how the hand-off note looks?

Yes. The template editor at the bottom of the settings page re-renders a live preview as you type. The model only fills the fields (reason, progress, next, skip, plus session and time); layout comes entirely from your template. An empty template restores the built-in layout.

### Does it need network access? Where does my data go?

No network access at all — there are no outbound requests. State lives locally: `~/.dsh/restart-handoff/settings.json` (settings), `pending.json` (the note waiting to be delivered), `history.jsonl` (events), and `~/.dsh/restart-handoff.log` (log). Deleting that directory clears the record.

### Does it work on Windows, Linux, or the web version?

No. It restarts DSH Desktop (Electron), so a plain web or CLI host answers "desktop only". It has only been verified on macOS so far.

### Does it touch my login state?

One thing only: every launch leaves another `dsh-auth-*` row in Electron's cookie database, so the plugin keeps the newest and deletes the older ones (otherwise the request header grows until the server starts rejecting it). That is the only cookie-related file it touches, and it can be switched off in "More settings". Nothing else is read or changed.

### How do I uninstall it?

```bash
dsh plugin --profile desktop remove @saolence/dsh-restart-handoff
```

It stops listening and stops restarting. The files under `~/.dsh/restart-handoff/` can stay or be deleted.

## Install

Requires **DSH Desktop**. It shows up as "Restart handoff" in Settings once installed.

```bash
dsh plugin --profile desktop add @saolence/dsh-restart-handoff
```

> It has to be the `desktop` profile: the plugin restarts the desktop app, so installing into `web` does nothing.
>
> Editing this package does **not** hot-reload: the profile points at it through a symlink, so HMR never hears about the change. Toggle the plugin off and on (or restart once) after editing.

## What the settings page contains

Settings → "Restart handoff". The line at the top says what is happening right now; when something is pending it turns into a countdown or "waiting for you to finish".

Three everyday switches:

- **Restart for me when a change needs it** (on by default)
- **Wait for every task to finish** (on by default)
- **Resume after restart** (on by default)

"More settings" holds three more: let the model request a restart, act after this turn ends, and prune stale login cookies.

Above the account row in the sidebar there is a round button: `↻` when idle, a pause glyph while queued, remaining seconds during a countdown. Click it to restart now or cancel.

## Known limits

- It restarts the host only, not other processes on your machine.
- A manual restart does not auto-resume — you are right there anyway.
- A hand-off note is valid for one restart; undelivered after ten minutes, it expires.
- The Web GUI needs a tokenised URL to open; the plugin does not touch that.

## For developers

The details live in the source: `index.js` (host logic), `client.js` (UI), `lib/state.js` (settings and state files), `test/` (smoke / boot / client-contract, via `npm test`).

The UI has an offline preview harness that needs no host:

```bash
cp client.js test/preview/client.js
python3 -m http.server 8781 --directory test/preview
# open http://127.0.0.1:8781/preview.html?s=idle
```

Parameters: `s=idle|countdown|waiting|handoff|empty` for scenarios, `theme=dark` for the dark theme, `slot=sidebar.footer.action` to preview the sidebar button.

## License

MIT, see [LICENSE](LICENSE). Current version 0.1.0.