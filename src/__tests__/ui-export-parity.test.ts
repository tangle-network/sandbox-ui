/** Check named shims against the installed UI declarations; identity is checked on the built bundle. */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const packageRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Strip comments so a name mentioned in prose is never read as an export. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/**
 * Whether a clause names an importable export.
 *
 * `default` passes an identifier test but is not reachable by name, so a
 * `export { default }` would otherwise enter the set as a member no shim can
 * possibly provide.
 */
function isExportedName(name: string | undefined): name is string {
  return !!name && name !== "default" && /^[A-Za-z_$][\w$]*$/.test(name);
}

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
      if (isExportedName(name)) names.add(name);
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

  const star = /export\s+\*\s+(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(star)) {
    const alias = match[1];
    const spec = match[2] as string;
    const origin = spec.startsWith(".") ? "local" : "package";
    // `export * as Foo` publishes one namespace object named Foo, rather than
    // spreading the target's names into this module.
    if (alias) {
      found.set(alias, origin);
      continue;
    }
    if (origin === "package") continue;
    const target = resolveRelative(spec, entry);
    // Silence here would drop every name behind the specifier and read as
    // "nothing is missing" — the same way an unresolved `.d.ts` once did.
    if (!target) {
      throw new Error(`${relative(packageRoot, entry)} re-exports "${spec}", which resolves to no source file`);
    }
    for (const [name, nameOrigin] of shimExports(target, seen)) if (!found.has(name)) found.set(name, nameOrigin);
  }

  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const origin = (match[2] as string).startsWith(".") ? "local" : "package";
    for (const clause of (match[1] as string).split(",")) {
      const name = clause.replace(/^\s*type\s+/, "").split(" as ").pop()?.trim();
      if (!isExportedName(name)) continue;
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

const manifest = (dir: string) => JSON.parse(readFileSync(resolvePath(dir, "package.json"), "utf8"));

/**
 * ui's installed root, walked up from a resolved entry.
 *
 * The path is found rather than assumed because pnpm resolves the dependency
 * into a content-addressed store and the nesting depth is not fixed.
 */
const uiRoot = (() => {
  let dir = dirname(require_.resolve("@tangle-network/ui"));
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(resolvePath(dir, "package.json")) && manifest(dir).name === "@tangle-network/ui") return dir;
    dir = dirname(dir);
  }
  throw new Error("cannot locate the installed @tangle-network/ui root");
})();

const uiExports = (manifest(uiRoot).exports ?? {}) as Record<string, { types?: string } | string>;

/**
 * Named in every failure message so a mismatch reads as "against which ui?".
 *
 * The version is reported, never asserted. Pinning it would turn a correct
 * upgrade — one that bumps ui and updates the shims together — into a failure,
 * which is the opposite of what this suite is for. The lockfile is what holds
 * the version steady; this only makes the measured one visible.
 */
const uiVersion = manifest(uiRoot).version as string;

/**
 * The `.d.ts` ui declares for a subpath, read from the `types` condition of its
 * exports map.
 *
 * The map is what a TypeScript consumer follows, so it is the authority on
 * where the declarations are. Deriving the path from the resolved `.js` instead
 * would encode this bundler's habit of emitting siblings, and would quietly
 * resolve to nothing the day that changes.
 */
function uiTypesFor(subpath: string): string | null {
  const entry = uiExports[subpath === "." ? "." : `./${subpath}`];
  const types = typeof entry === "string" ? undefined : entry?.types;
  if (!types) return null;
  const declarations = resolvePath(uiRoot, types);
  return existsSync(declarations) ? declarations : null;
}

/**
 * The subpaths where this package mirrors ui one-to-one, discovered from the
 * two manifests rather than listed here so a new shim is covered the day it
 * ships. A subpath qualifies when both sides publish it under the same name.
 *
 * Membership deliberately does NOT depend on the declarations resolving. A
 * subpath that qualifies but whose types cannot be found fails its own test
 * below, so coverage can never shrink quietly — dropping it from this list
 * instead would let a resolution change hide real drift behind a suite that
 * still reports all-green.
 */
const mirrored = Object.keys((manifest(packageRoot).exports ?? {}) as Record<string, unknown>)
  .filter((key) => key.startsWith("./") && !key.endsWith(".css"))
  .map((key) => key.slice(2))
  .filter((sub) => uiExports[`./${sub}`] && existsSync(resolvePath(packageRoot, "src", sub, "index.ts")))
  .sort();

/** Hand-typed shims: those that do not forward their ui subpath with a star. */
const handTyped = mirrored.filter(
  (sub) =>
    !new RegExp(`export\\s+\\*\\s+from\\s+['"]@tangle-network/ui/${sub}['"]`).test(
      stripComments(readFileSync(resolvePath(packageRoot, "src", sub, "index.ts"), "utf8")),
    ),
);

describe("every @tangle-network/ui export stays reachable through the shims", () => {
  it("discovers the mirrored subpaths", () => {
    // A manifest rename would empty this list and make every assertion below
    // pass by having nothing to check.
    expect(mirrored.length).toBeGreaterThan(8);
  });

  for (const sub of handTyped) {
    it(`${sub} re-exports all of ui/${sub}`, () => {
      const declarations = uiTypesFor(sub);
      expect(declarations, `ui publishes ./${sub} but its types did not resolve`).not.toBeNull();
      const upstream = declaredExports(declarations as string);
      // Guards the .d.ts parse the same way: a bundler output change that
      // stopped matching would otherwise read as "nothing is missing".
      expect(upstream.size).toBeGreaterThan(3);
      const shim = shimExports(resolvePath(packageRoot, "src", sub, "index.ts"));
      expect(
        [...upstream].filter((name) => !shim.has(name)).sort(),
        `missing from ./${sub}, measured against @tangle-network/ui ${uiVersion}`,
      ).toEqual([]);
    });
  }
});

/** The wordmark remains Sandbox-owned. HeadingProps retains the published
 * required role/children contract; this is a type-only compatibility alias,
 * not a second Heading renderer. All generic runtime bindings are held to
 * canonical identity in re-export-identity.test.ts and the packed consumer.
 */
const INTENDED_SHADOWS: Readonly<Record<string, readonly string[]>> = {
  primitives: ["HeadingProps", "Logo", "LogoProps", "TangleKnot"],
};

describe("a name served locally while ui exports it too is documented", () => {
  for (const sub of mirrored) {
    it(`${sub} shadows only what is pinned`, () => {
      const declarations = uiTypesFor(sub);
      expect(declarations, `ui publishes ./${sub} but its types did not resolve`).not.toBeNull();
      const upstream = declaredExports(declarations as string);
      const shim = shimExports(resolvePath(packageRoot, "src", sub, "index.ts"));
      const shadows = [...shim]
        .filter(([name, origin]) => origin === "local" && upstream.has(name))
        .map(([name]) => name)
        .sort();
      expect(shadows, `shadows in ./${sub}, measured against @tangle-network/ui ${uiVersion}`).toEqual(
        [...(INTENDED_SHADOWS[sub] ?? [])].sort(),
      );
    });
  }
});
