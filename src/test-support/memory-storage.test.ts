import { describe, expect, it } from "vitest"
import { installMemoryStorage, needsMemoryStorage } from "./memory-storage"

/** A stand-in global whose `localStorage` behaves the way a hostile host's does. */
function hostWhere(localStorage: PropertyDescriptor): typeof globalThis {
  const host = {} as typeof globalThis
  Object.defineProperty(host, "localStorage", {
    configurable: true,
    ...localStorage,
  })
  return host
}

describe("needsMemoryStorage", () => {
  it("says yes when the host has no localStorage at all", () => {
    // Node's own global: present, and `undefined` without --localstorage-file.
    expect(needsMemoryStorage(hostWhere({ value: undefined }))).toBe(true)
  })

  it("says yes — and does NOT throw — when merely READING it raises", () => {
    // jsdom raises SecurityError from the getter on an opaque origin. A probe that
    // touches it unguarded takes the whole setup file down before the replacement it
    // is probing for can be installed, which is the one case it exists for.
    const host = hostWhere({
      get() {
        throw new Error("SecurityError: localStorage is not available")
      },
    })
    expect(() => needsMemoryStorage(host)).not.toThrow()
    expect(needsMemoryStorage(host)).toBe(true)
  })

  it("says no when the host already has a working one", () => {
    const real = { getItem: () => null } as unknown as Storage
    expect(needsMemoryStorage(hostWhere({ value: real }))).toBe(false)
  })
})

describe("installMemoryStorage", () => {
  it("replaces a THROWING localStorage with one a test can call", () => {
    const host = hostWhere({
      get() {
        throw new Error("SecurityError: localStorage is not available")
      },
    })
    installMemoryStorage(host)

    // The whole point: `clear()` in a beforeEach no longer needs a guard around it.
    expect(() => host.localStorage.clear()).not.toThrow()
    host.localStorage.setItem("rail", "collapsed")
    expect(host.localStorage.getItem("rail")).toBe("collapsed")
  })

  it("behaves like Storage: length, key order, null for a miss, string coercion", () => {
    const host = hostWhere({ value: undefined })
    const storage = installMemoryStorage(host)

    expect(storage.getItem("absent")).toBeNull()
    expect(storage.length).toBe(0)

    storage.setItem("a", "1")
    storage.setItem("b", "2")
    expect(storage.length).toBe(2)
    expect(storage.key(0)).toBe("a")
    expect(storage.key(1)).toBe("b")
    expect(storage.key(9)).toBeNull()

    // A Storage stores strings, whatever it is handed.
    storage.setItem("n", 42 as unknown as string)
    expect(storage.getItem("n")).toBe("42")

    storage.removeItem("a")
    expect(storage.getItem("a")).toBeNull()
    expect(storage.length).toBe(2)

    storage.clear()
    expect(storage.length).toBe(0)
  })
})
