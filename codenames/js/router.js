// Tiny hash-based router. Routes are: home, setup, assign, qr, play,
// history, end, key (key receives a payload via #key=...).

const routes = new Map();
let currentCleanup = null;

export function registerRoute(name, handler) {
  routes.set(name, handler);
}

function parseHash() {
  const hash = (location.hash || "").replace(/^#/, "");
  if (!hash) return { name: "home", payload: null };
  if (hash.startsWith("key=")) return { name: "key", payload: hash.slice(4) };
  return { name: hash, payload: null };
}

function render() {
  const { name, payload } = parseHash();
  const handler = routes.get(name) || routes.get("home");
  const root = document.getElementById("view");
  root.innerHTML = "";
  if (typeof currentCleanup === "function") {
    try {
      currentCleanup();
    } catch {
      /* ignore */
    }
  }
  currentCleanup = null;
  document.body.dataset.route = name;
  const ret = handler(root, payload);
  if (typeof ret === "function") currentCleanup = ret;
  window.scrollTo(0, 0);
}

export function navigate(name) {
  if (name === "home") {
    if (location.hash !== "") location.hash = "";
    else render();
  } else if (location.hash === `#${name}`) {
    render();
  } else {
    location.hash = `#${name}`;
  }
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}
