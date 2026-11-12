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

// --- Styling contract -------------------------------------------------------
// The panel and the sidebar seat are styled with the host's tokens, so the same
// CSS has to work in both themes. Two failure modes shipped before and are
// cheap to catch here, because neither shows up in the Host-side tests and the
// light theme looks fine either way:
//
//   1. a filled button whose label is a hard-coded colour — the host flips the
//      fill from near-black to near-white in dark mode, so "#fff" ends up as
//      white text on a white button;
//   2. a popover narrower than its own content because padding was added on
//      top of a fixed width (the 268px popover rendered 297px wide), which
//      pushed the buttons out of the panel.
const clientSrc = fs.readFileSync(path.join(root, "client.js"), "utf8");
const cssMatch = clientSrc.match(/const CSS = `([\s\S]*?)`;/);
assert.ok(cssMatch, "client.js must embed its stylesheet as a template literal");

const cssText = cssMatch[1];
function propsOf(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssText.match(new RegExp("(?:^|\\n)" + escaped + "\\s*\\{([^}]*)\\}"));
  if (!match) return null;
  const out = {};
  for (const decl of match[1].split(";")) {
    const at = decl.indexOf(":");
    if (at < 0) continue;
    out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
  }
  return out;
}

const primaryBtn = propsOf(".rhs-btn--primary");
assert.ok(primaryBtn, ".rhs-btn--primary must be styled");
assert.match(
  primaryBtn.color,
  /var\(--dsw-alias-label-primary-foreground/,
  "primary button text must come from the host's foreground token, not a fixed colour",
);
assert.match(
  primaryBtn.background,
  /var\(--dsw-alias-button-primary-fill/,
  "primary button fill must come from the host's fill token",
);
// A literal colour would break one theme or the other; the declaration has to
// be a token lookup (its fallback may be any colour, since it only applies when
// the host is not styling the page at all).
assert.match(primaryBtn.color, /^var\(--dsw-/, "the label colour must be a host token, not a literal");

const pop = propsOf(".rh-pop");
assert.ok(pop, ".rh-pop must be styled");
assert.equal(pop["box-sizing"], "border-box", "the popover's fixed width must include its padding");

const rail = propsOf(".rh-tile--rail");
assert.ok(rail, "the rail variant of the sidebar seat must be styled");
assert.equal(rail.width, "36px", "the rail seat matches the host's 36px circle");
assert.equal(rail.height, "36px", "the rail seat matches the host's 36px circle");

assert.doesNotMatch(cssText, /--rh-nudge/, "seat alignment must not rely on a measured per-width nudge");

// The popover is pinned by its bottom edge against the seat, so its height can
// change (a longer sentence, a bigger font) without moving it off screen.
assert.match(
  clientSrc,
  /bottom: Math\.max\(10, viewportH - anchor\.top/,
  "the popover must be anchored by its bottom edge",
);

// The two theme fixtures have to expose the same tokens the app does, or the
// preview shows a bug that is not there — or hides one that is.
for (const fixture of ["preview.html", "ring.html"]) {
  const file = path.join(here, "preview", fixture);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  for (const token of [
    "--dsw-alias-button-primary-fill",
    "--dsw-alias-button-primary-hover",
    "--dsw-alias-label-primary-foreground",
  ]) {
    const count = html.split(token).length - 1;
    assert.ok(count >= 2, `${fixture} must define ${token} for both themes (found ${count})`);
  }
  assert.doesNotMatch(html, /#4d7cfe|#3d6ff5/, `${fixture} must not invent a blue brand colour; the host's is neutral`);
}

console.log("client contract ok");