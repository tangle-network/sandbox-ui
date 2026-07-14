/**
 * An in-memory `localStorage`, for test environments that do not supply a working
 * one. Used by `test-setup.ts`; exported so the behaviour that matters can be
 * asserted rather than assumed.
 *
 * There are two ways a host fails to give tests a usable `localStorage`, and the
 * install has to survive both:
 *
 *   **It is missing.** Node ships its own `localStorage` global, `undefined` unless
 *   the process was started with `--localstorage-file`. Vitest's jsdom environment
 *   skips any key already present on the global, so jsdom's own Storage is never
 *   installed and the Node one — `undefined` — is what a component sees. (Node does
 *   not do this to `sessionStorage`, which is why the hole looks arbitrary.)
 *
 *   **Reading it THROWS.** jsdom raises `SecurityError` from the getter on an opaque
 *   origin. A probe that touches it unguarded takes the setup file down with it —
 *   before the replacement it was probing for could be installed.
 */

/** Does `target` already have a `localStorage` a test can use? Never throws: a
 *  getter that raises (the opaque-origin case) means NO, not "crash the caller". */
export function needsMemoryStorage(target: typeof globalThis): boolean {
  try {
    return !target.localStorage
  } catch {
    return true
  }
}

/** Back `target.localStorage` with an in-memory Storage, replacing a missing or
 *  throwing one. Defined as an OWN property, so it shadows an inherited getter
 *  rather than trying to write through it. */
export function installMemoryStorage(target: typeof globalThis): Storage {
  const entries = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return entries.size
    },
    key: (i) => [...entries.keys()][i] ?? null,
    getItem: (k) => entries.get(k) ?? null,
    setItem: (k, v) => {
      entries.set(String(k), String(v))
    },
    removeItem: (k) => {
      entries.delete(String(k))
    },
    clear: () => entries.clear(),
  }
  Object.defineProperty(target, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  })
  return storage
}
