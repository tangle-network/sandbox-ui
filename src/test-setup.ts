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
