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
// process was started with --localstorage-file. Vitest's jsdom environment skips
// any key that already exists on the global, so jsdom's own storage is never
// installed and every component that persists a preference sees
// `localStorage === undefined` and throws. (`sessionStorage` is unaffected, which
// is why the hole looks arbitrary.) Back it with an in-memory Storage.
//
// The store is per-PROCESS, not per-file: this property is not one jsdom created,
// so the environment teardown does not delete it. That is only harmless while
// vitest runs each test file in its own process (`isolate`, the default) — turn
// isolation off and this Map would carry state between files.
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
