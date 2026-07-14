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
