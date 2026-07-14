import "@testing-library/jest-dom/vitest"

// jsdom lacks the pointer-capture, scroll, and resize-observer APIs that
// Radix UI primitives (e.g. Select) call during interaction. Provide no-op
// shims so userEvent can drive them in tests.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Node ships its own `localStorage` global, and it is `undefined` unless the
// process was started with --localstorage-file. That own property shadows the one
// jsdom installs on the window, so every component that persists a preference sees
// `localStorage === undefined` and throws. (`sessionStorage` is unaffected, which
// is why the hole looks arbitrary.) Back it with an in-memory Storage — per-file,
// like the rest of the jsdom environment.
if (!globalThis.localStorage) {
  const entries = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return entries.size
    },
    key: (i) => [...entries.keys()][i] ?? null,
    getItem: (k) => entries.get(k) ?? null,
    setItem: (k, v) => {
      entries.set(k, String(v))
    },
    removeItem: (k) => {
      entries.delete(k)
    },
    clear: () => entries.clear(),
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  })
}
