import "@testing-library/jest-dom/vitest"
import {
  installMemoryStorage,
  needsMemoryStorage,
} from "./test-support/memory-storage"

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
// jsdom has no layout engine, so ProseMirror's coordinate lookups
// (posAtCoords → elementFromPoint) have nothing to hit. A null-returning shim
// lets the editor process pointer events in tests without throwing.
if (!Document.prototype.elementFromPoint) {
  Document.prototype.elementFromPoint = () => null
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// A usable `localStorage` for anything that persists a preference. Both the
// "missing" and the "throws on read" cases, and why they exist, are documented on
// the helper — which is exported so they can be TESTED rather than asserted in a
// comment (see memory-storage.test.ts).
//
// The store is per-PROCESS, not per-file: this property is not one jsdom created, so
// the environment teardown does not delete it. That is only harmless while vitest
// runs each test file in its own process (`isolate`, the default) — turn isolation
// off and this Map would carry state between files.
if (needsMemoryStorage(globalThis)) {
  installMemoryStorage(globalThis)
}

// jsdom does not implement DataTransfer (https://github.com/jsdom/jsdom/issues/1568),
// so components that build one for paste/drag-drop (new DataTransfer(), items.add)
// need a minimal stand-in to run under test.
if (!globalThis.DataTransfer) {
  class FakeDataTransferItemList {
    private files: File[]
    constructor(files: File[]) {
      this.files = files
    }
    add(file: File) {
      this.files.push(file)
    }
    get length() {
      return this.files.length
    }
  }

  class FakeDataTransfer {
    types: string[] = []
    private _files: File[] = []
    private data: Record<string, string> = {}
    items = new FakeDataTransferItemList(this._files)

    get files(): FileList {
      const files = this._files
      const fileList: Record<number | string, unknown> = {
        length: files.length,
        item: (index: number) => files[index] ?? null,
      }
      files.forEach((file, index) => {
        fileList[index] = file
      })
      return fileList as unknown as FileList
    }

    setData(format: string, value: string) {
      this.data[format] = value
      if (!this.types.includes(format)) this.types.push(format)
    }

    getData(format: string): string {
      return this.data[format] ?? ""
    }
  }

  // @ts-expect-error — test-only stand-in, not a spec-complete DataTransfer.
  globalThis.DataTransfer = FakeDataTransfer
}
