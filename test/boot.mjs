/**
 * Boot test for dsh-restart-handoff — runs outside the Harness.
 *
 *   node test/boot.mjs
 *
 * The plugin only ever runs inside the desktop host, so a syntax check is not
 * enough: `apply()` touches six context services and a bad registration is a
 * silent failure that only shows up when the panel is gone. This boots `apply`
 * against a stub context and exercises the panel routes through their real
 * handlers.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { join } from "node:path";

const dir = fs.mkdtempSync(join(os.tmpdir(), "dsh-restart-handoff-boot-"));
process.env.DSH_RESTART_HANDOFF_DIR = dir;
process.env.DSH_RESTART_HANDOFF_LOG = join(dir, "restart-handoff.log");

const mod = await import("../index.js");

const events = [];
const tools = [];
const routes = new Map();
const disposers = [];

const ctx = {
  effect(fn) {
    const dispose = fn();
    if (typeof dispose === "function") disposers.push(dispose);
    return () => {};
  },
  timeout(fn, ms) {
    const handle = setTimeout(fn, ms);
    handle.unref?.();
    return () => clearTimeout(handle);
  },
  on(event, handler) {
    events.push({ event, handler });
    return () => {};
  },
  tools: {
    register(spec) {
      tools.push(spec);
      return () => {};
    },
  },
  webServer: {
    register(spec) {
      routes.set(`${spec.path}`, spec.handler);
      return () => {};
    },
  },
  connection: { requestRejection: () => undefined },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  agents: { list: () => [], get: () => undefined },
  sessionController: { resolveAgent: () => undefined },
};

mod.apply(ctx);

// --- registrations ------------------------------------------------------
assert.deepEqual(events.map((entry) => entry.event).sort(), [
  "agent/status",
  "api-session/status",
  "tools/post-execute",
], "the three lifecycle hooks are wired");

const tool = tools.find((entry) => entry.name === "restart_handoff");
assert.ok(tool, "the restart_handoff tool is registered");
assert.deepEqual(
  Object.keys(tool.parameters.properties).sort(),
  ["delay_ms", "next", "progress", "reason", "skip"],
  "the tool takes the three hand-off fields plus reason and delay",
);
assert.equal(tool.parameters.additionalProperties, false);
assert.equal(tool.parameters.properties.continuation, undefined, "the retired free-text field is gone");

for (const name of ["status", "restart", "cancel", "preview", "settings"]) {
  assert.ok(routes.has(`/restart-handoff/${name}`), `POST /restart-handoff/${name} is routed`);
}
assert.equal(routes.size, 5, "no stray routes");

// --- routes -------------------------------------------------------------
/** Drive one registered route handler with a fake HTTP exchange. */
async function call(method, name, body) {
  const handler = routes.get(`/restart-handoff/${name}`);
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), "utf8")];
  const req = {
    method,
    headers: { "content-type": "application/json" },
    // The route wrapper reads the body as a Node stream, not an async iterator.
    on(event, handler) {
      listeners[event] = handler;
      return req;
    },
    destroy() {},
  };
  const listeners = {};
  queueMicrotask(() => {
    for (const chunk of chunks) listeners.data?.(chunk);
    listeners.end?.();
  });
  const res = {
    statusCode: 200,
    headers: {},
    chunks: [],
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(chunk) {
      if (chunk) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      this.done = true;
    },
  };
  await handler(req, res);
  const text = Buffer.concat(res.chunks).toString("utf8");
  return { status: res.statusCode, json: text ? JSON.parse(text) : null };
}

const status = await call("GET", "status");
assert.equal(status.status, 200);
assert.equal(status.json.settings.autoRestart, true);
assert.equal(typeof status.json.defaultTemplate, "string", "the panel gets the shipped template to show as a placeholder");
assert.equal(status.json.host, null, "a bare test process is not a restartable host");
assert.equal(status.json.canRestart, false, "so the panel must not offer a restart");
assert.deepEqual(status.json.templateFields, ["reason", "progress", "next", "skip", "session", "time"]);
assert.ok(status.json.preview.includes("做到哪了："), "the status response carries a ready-made preview");

const preview = await call("POST", "preview", { template: "🔁 {{time}}\n下一步：{{next}}" });
assert.equal(preview.status, 200);
assert.equal(preview.json.ok, true);
assert.match(preview.json.text, /^🔁 \d{2}:\d{2}\n下一步：.+$/u, "the preview renders the draft template with sample fields");

const badPreview = await call("POST", "preview", { template: "{{nope}}" });
assert.equal(badPreview.json.ok, false);
assert.match(badPreview.json.error, /不认识的占位符/);

const save = await call("POST", "settings", { continuationTemplate: "给我：{{next}}" });
assert.equal(save.json.ok, true);
assert.equal(save.json.settings.continuationTemplate, "给我：{{next}}");

const badSave = await call("POST", "settings", { continuationTemplate: "{{nope}}" });
assert.equal(badSave.json.ok, false);
assert.match(badSave.json.error, /不认识的占位符/);
assert.equal((await call("GET", "status")).json.settings.continuationTemplate, "给我：{{next}}", "the refused save changed nothing");

// An empty template means "use the shipped one", not "send nothing".
const reset = await call("POST", "settings", { continuationTemplate: "" });
assert.equal(reset.json.ok, true);

const cancel = await call("POST", "cancel", {});
assert.equal(cancel.status, 200);

for (const dispose of disposers) dispose();
fs.rmSync(dir, { recursive: true, force: true });
console.log("boot ok");