/**
 * Every name `@tangle-network/ui` exports has to stay reachable through this
 * package's shims.
 *
 * The subpath shims here are hand-typed re-export lists, not `export *`. That
 * is deliberate — `src/primitives` serves `Logo`, `LogoProps` and `TangleKnot`
 * from the sandbox-branded `./logo` instead of forwarding ui's, and a star
 * would make those two declarations collide. The cost of typing the list is
 * that a name added upstream is simply absent downstream: nothing errors, the
 * shim still compiles, and a consumer discovers the gap only when an import
 * they expected to work does not resolve.
 *
 * `re-export-identity.test.ts` is the other half of this contract and does not
 * overlap. It samples one symbol per subpath and proves the binding is
 * ui's own object rather than a copy, which needs the built bundle. This suite
 * asks the complementary question — whether anything is missing at all — and
 * answers it from source, so it runs in a plain `vitest run` with no build.
 *
 * Read against the INSTALLED ui, not a sibling source checkout: the dependency
 * this package resolves is what its consumers actually get. That also makes a
 * version bump the moment this suite reds, which is the point — upgrading ui
 * is exactly when new exports appear and shadows start colliding.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const packageRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Strip comments so a name mentioned in prose is never read as an export. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/**
 * The names a built `.d.ts` entry exports.
 *
 * The bundler rewrites everything into `export { X as Y } from './chunk.js'`,
 * so the aliased right-hand side is the public name. Declaration forms still
 * appear for types the bundler kept inline.
 */
function declaredExports(dtsPath: string): Set<string> {
  const source = stripComments(readFileSync(dtsPath, "utf8"));
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const clause of (match[1] as string).split(",")) {
      const name = clause.replace(/^\s*type\s+/, "").split(" as ").pop()?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  const declaration =
    /export\s+(?:declare\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(declaration)) names.add(match[1] as string);
  return names;
}

/** Resolve a relative specifier to the file it names. */
function resolveRelative(spec: string, fromFile: string): string | null {
  const base = resolvePath(dirname(fromFile), spec);
  // A bare directory has to fall through to its index; `existsSync` alone is
  // true for the directory itself and would hand back something unreadable.
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * The names a shim source exports, mapped to whether they come from a local
 * file or from a package.
 *
 * `export *` is followed into relative files, because `src/hooks` and
 * `src/types` use it for their sandbox-only modules; a package specifier is
 * left opaque since its names are the dependency's, not this package's.
 */
function shimExports(entry: string, seen = new Set<string>()): Map<string, "local" | "package"> {
  const found = new Map<string, "local" | "package">();
  if (seen.has(entry)) return found;
  seen.add(entry);
  const source = stripComments(readFileSync(entry, "utf8"));

  for (const match of source.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const spec = match[1] as string;
    if (!spec.startsWith(".")) continue;
    const target = resolveRelative(spec, entry);
    if (target) for (const [name, origin] of shimExports(target, seen)) if (!found.has(name)) found.set(name, origin);
  }

  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const origin = (match[2] as string).startsWith(".") ? "local" : "package";
    for (const clause of (match[1] as string).split(",")) {
      const name = clause.replace(/^\s*type\s+/, "").split(" as ").pop()?.trim();
      if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      // Local wins: a name this package also serves itself is a shadow no
      // matter which line came first, and reading it as forwarded would hide
      // exactly the divergence the shadow suite exists to surface.
      if (found.get(name) !== "local") found.set(name, origin);
    }
  }

  // Declared in this file, then exported — local by construction.
  const declaration =
    /export\s+(?:declare\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(declaration)) found.set(match[1] as string, "local");
  return found;
}

/** The ui `.d.ts` behind a subpath, or null when ui does not publish one. */
function uiTypesFor(subpath: string): string | null {
  try {
    const js = require_.resolve(subpath === "." ? "@tangle-network/ui" : `@tangle-network/ui/${subpath}`);
    const dts = js.replace(/\.js$/, ".d.ts");
    return existsSync(dts) ? dts : null;
  } catch {
    return null;
  }
}

/**
 * The subpaths where this package mirrors ui one-to-one, discovered from the
 * manifest rather than listed here so a new shim is covered the day it ships.
 * A subpath qualifies when both sides publish it under the same name.
 */
const mirrored = Object.keys(
  (JSON.parse(readFileSync(resolvePath(packageRoot, "package.json"), "utf8")).exports ?? {}) as Record<string, unknown>,
)
  .filter((key) => key.startsWith("./") && !key.endsWith(".css"))
  .map((key) => key.slice(2))
  .filter((sub) => uiTypesFor(sub) && existsSync(resolvePath(packageRoot, "src", sub, "index.ts")))
  .sort();

describe("every @tangle-network/ui export stays reachable through the shims", () => {
  it("discovers the mirrored subpaths", () => {
    // A manifest rename or a resolution failure would empty this list and make
    // every assertion below pass by having nothing to check.
    expect(mirrored.length).toBeGreaterThan(8);
  });

  for (const sub of mirrored) {
    it(`${sub} re-exports all of ui/${sub}`, () => {
      const upstream = declaredExports(uiTypesFor(sub) as string);
      // Guards the .d.ts parse the same way: a bundler output change that
      // stopped matching would otherwise read as "nothing is missing".
      expect(upstream.size).toBeGreaterThan(3);
      const shim = shimExports(resolvePath(packageRoot, "src", sub, "index.ts"));
      expect([...upstream].filter((name) => !shim.has(name)).sort()).toEqual([]);
    });
  }
});

/**
 * A name this package serves from its own file while ui exports the same name
 * is a silent divergence: it type-checks, it resolves, and a consumer gets a
 * different component from the one the upstream docs describe. The three below
 * are intended — the sandbox wordmark is not ui's — so they are pinned rather
 * than forbidden, and anything joining them has to be justified here.
 *
 * ui 11.3.0 adds `PageHeader`, which `src/primitives` also serves from
 * `./heading`. Upgrading will red this and force that collision to be settled
 * deliberately instead of resolving by whichever line was written last.
 */
const INTENDED_SHADOWS: Readonly<Record<string, readonly string[]>> = {
  primitives: ["Logo", "LogoProps", "TangleKnot"],
};

describe("a name served locally while ui exports it too is documented", () => {
  for (const sub of mirrored) {
    it(`${sub} shadows only what is pinned`, () => {
      const upstream = declaredExports(uiTypesFor(sub) as string);
      const shim = shimExports(resolvePath(packageRoot, "src", sub, "index.ts"));
      const shadows = [...shim]
        .filter(([name, origin]) => origin === "local" && upstream.has(name))
        .map(([name]) => name)
        .sort();
      expect(shadows).toEqual([...(INTENDED_SHADOWS[sub] ?? [])].sort());
    });
  }
});

/**
 * The root entry is a curated aggregate, not a mirror, so it is held to a
 * pinned list instead of full parity. Each omission below is a decision the
 * root makes on purpose; a name that leaves ui, or a new one that root forgets,
 * changes this set and reds.
 */
const ROOT_OMISSIONS: Readonly<Record<string, string>> = {
  TerminalInput: "clashes with workspace's own terminal types; re-exported as TerminalDisplayInput",
  TerminalCursor: "clashes with workspace's own terminal types; re-exported as TerminalDisplayCursor",
  ConnectionState: "the editor declares one too, so neither takes the root name; each stays reachable from its subpath",
  RedactedDocSegment: "redaction has no consumer here and ui publishes it only from its root",
  RedactedDocument: "redaction has no consumer here and ui publishes it only from its root",
  RedactedDocumentData: "redaction has no consumer here and ui publishes it only from its root",
  RedactedDocumentProps: "redaction has no consumer here and ui publishes it only from its root",
  RevealResult: "redaction has no consumer here and ui publishes it only from its root",
};

describe("the root entry omits only what it means to omit", () => {
  it("omits exactly the pinned set", () => {
    const upstream = declaredExports(uiTypesFor(".") as string);
    expect(upstream.size).toBeGreaterThan(100);
    const shim = shimExports(resolvePath(packageRoot, "src", "index.ts"));
    const missing = [...upstream].filter((name) => !shim.has(name)).sort();
    expect(missing).toEqual(Object.keys(ROOT_OMISSIONS).sort());
  });
});
