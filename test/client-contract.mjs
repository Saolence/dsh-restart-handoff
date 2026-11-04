/**
 * Client-half contract test — runs outside the Harness.
 *
 *   node test/client-contract.mjs
 *
 * The Host builds a client-modules graph row per package and looks the bundle
 * up by the *package name*. A bundle that registers under any other id loads
 * fine but never activates:
 *
 *   client-modules: could not load "@saolence/dsh-restart-handoff":
 *   ... loaded without registering "@saolence/dsh-restart-handoff" via __ModuleLoader__.load
 *
 * That failure is invisible to the Host-side smoke test and only shows up as a
 * boot-time "Failed to load plugins" banner, so the id is asserted here against
 * package.json itself.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// Stand in for the Host loader: capture the spec the bundle registers.
const captured = [];
globalThis.window = { __ModuleLoader__: { load: (spec) => { captured.push(spec); } } };

await import(`${pathToFileURL(path.join(root, "client.js")).href}?rev=${Date.now()}`);

assert.equal(captured.length, 1, "client.js must call window.__ModuleLoader__.load exactly once");
const spec = captured[0];
assert.equal(typeof spec.factory, "function", "load() needs a factory");
assert.equal(
  spec.id,
  pkg.name,
  `client bundle id must equal the package name (expected ${pkg.name}, got ${spec.id})`,
);

// React is the only thing the factory requires; a stub is enough to prove the
// bundle executes and exports the shape cordis applies.
const stubReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol("Fragment"),
  useState: (v) => [v, () => {}],
  useReducer: (f, initial) => [initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (f) => f(),
  useCallback: (f) => f,
  useRef: (v) => ({ current: v }),
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
};
const exported = spec.factory((id) => {
  if (id === "react") return stubReact;
  throw new Error(`unexpected require("${id}") — add it to this test's stub map`);
});

assert.ok(exported && typeof exported === "object", "factory must return the module exports");
assert.equal(typeof exported.apply, "function", "export.apply must be a function");
assert.ok(Array.isArray(exported.inject), "export.inject must be an array");
assert.ok(exported.inject.includes("slots"), "the panel needs the slots service");
assert.equal(typeof exported.name, "string", "export.name must be a string");

// The preview harness ships a copy of client.js; it must stay byte-identical or
// the thing you debug in the browser is not the thing that boots in the app.
const preview = path.join(here, "preview", "client.js");
if (fs.existsSync(preview)) {
  assert.equal(
    fs.readFileSync(preview, "utf8"),
    fs.readFileSync(path.join(root, "client.js"), "utf8"),
    "test/preview/client.js must stay an exact copy of client.js",
  );
}

console.log("client contract ok");