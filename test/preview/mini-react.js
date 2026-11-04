// 极简 React 替身：只为本地面板预览（不参与生产）
let cursor = 0, store = [], pendingEffects = [], rerender = null;

export function createElement(type, props, ...kids) {
  return { type, props: props || {}, kids: kids.flat(Infinity) };
}
export const Fragment = "#frag";

export function useState(init) {
  const i = cursor++;
  if (!(i in store)) store[i] = init;
  return [store[i], (v) => {
    store[i] = typeof v === "function" ? v(store[i]) : v;
    if (globalThis.__dbg) globalThis.__dbg.steps.push("setState#" + i);
    rerender && rerender();
  }];
}
export function useReducer(fn, init) {
  const i = cursor++;
  if (!(i in store)) store[i] = init;
  return [store[i], () => { store[i] = fn(store[i]); rerender && rerender(); }];
}
export function useRef(init) {
  const i = cursor++;
  if (!(i in store)) store[i] = { current: init };
  return store[i];
}
export function useCallback(fn, deps) {
  const i = cursor++;
  const prev = store[i];
  const same = prev && deps && prev.deps && deps.every((d, k) => d === prev.deps[k]);
  if (same) return prev.fn;
  store[i] = { fn, deps };
  return fn;
}
export function useMemo(fn, deps) {
  const i = cursor++;
  const prev = store[i];
  const same = prev && deps && prev.deps && deps.every((d, k) => d === prev.deps[k]);
  if (same) return prev.value;
  const value = fn();
  store[i] = { value, deps };
  return value;
}
export function useEffect(fn, deps) {
  const i = cursor++;
  const prev = store[i];
  const same = prev && deps && prev.deps && deps.every((d, k) => d === prev.deps[k]);
  if (same) return;
  store[i] = { deps };
  pendingEffects.push(fn);
}

function set(el, key, value) {
  if (key === "className") el.className = value || "";
  else if (key === "style" && value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) el.style.setProperty(k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), String(v));
  } else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
  else if (key === "children") { /* handled separately */ }
  else if (value !== null && value !== undefined && value !== false) el.setAttribute(key, String(value));
}

const SVG_TAGS = new Set(["svg", "path", "circle", "g", "line", "rect", "polyline", "polygon"]);

function build(node) {
  if (node === null || node === undefined || node === false || node === true) return document.createComment("");
  if (typeof node === "string" || typeof node === "number") return document.createTextNode(String(node));
  if (Array.isArray(node)) {
    const frag = document.createDocumentFragment();
    node.forEach((n) => frag.appendChild(build(n)));
    return frag;
  }
  if (typeof node.type === "function") return build(node.type(node.props));
  if (node.type === Fragment) { const frag = document.createDocumentFragment(); node.kids.forEach((k) => frag.appendChild(build(k))); return frag; }
  const el = typeof node.type === "string" && SVG_TAGS.has(node.type)
    ? document.createElementNS("http://www.w3.org/2000/svg", node.type)
    : document.createElement(node.type);
  if (!node.props) { window.__bad = window.__bad || []; window.__bad.push(String(node.type) + " :: " + JSON.stringify(node).slice(0, 200)); }
  for (const [k, v] of Object.entries(node.props || {})) if (k !== "children") set(el, k, v);
  node.kids.forEach((k) => el.appendChild(build(k)));
  return el;
}

export function mount(Component, container) {
  store = [];
  store.length = 0;
  rerender = () => {
    cursor = 0;
    pendingEffects = [];
    container.replaceChildren(build(createElement(Component, {})));
    const effects = pendingEffects;
    pendingEffects = [];
    if (globalThis.__dbg) globalThis.__dbg.steps.push("render(effects=" + effects.length + ")");
    effects.forEach((fn) => {
      try { fn(); }
      catch (e) { if (globalThis.__dbg) globalThis.__dbg.errors.push("effect:" + e.message); }
    });
  };
  rerender();
  return rerender;
}
