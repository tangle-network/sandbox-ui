/**
 * Every `@radix-ui/*` package must resolve to exactly one version.
 *
 * Radix components coordinate through shared internals — a focus scope, a
 * dismissable layer, a presence tracker, a React context. Those are per-module
 * singletons in practice: two copies of `react-focus-scope` are two focus
 * managers that do not know about each other.
 *
 * That is not theoretical. This package once resolved `react-dialog` on one
 * generation of the internals and `react-menu` on a newer one, so a dropdown
 * item that opened a dialog handed focus back and forth forever — a
 * synchronous loop, which is why no test timeout could interrupt it and the
 * vitest worker had to be killed. The suite went from 8 seconds to 27 minutes.
 *
 * The split arrives quietly. Nothing errors, types still check, and most
 * surfaces keep working — only the ones where two components from different
 * generations have to agree. So the invariant is asserted here rather than
 * left to whoever next reads a lockfile diff of several hundred lines.
 *
 * Read from the lockfile, not from `node_modules`: the lockfile is what CI and
 * a fresh clone install, while a working tree accumulates orphans from earlier
 * installs that no longer resolve.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The lockfile, found by walking up rather than by counting `..` segments, so
 * moving this file to another depth does not quietly point it at nothing.
 *
 * The project pins pnpm in `packageManager`, so the filename is the one this
 * repo will have; a different package manager would need a different invariant
 * anyway, since this asserts something about how pnpm resolved the tree.
 */
function findLockfile(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolvePath(dir, "pnpm-lock.yaml");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error("cannot locate pnpm-lock.yaml above this test");
}

/**
 * `@radix-ui/react-x@1.2.3` occurrences, collected per package.
 *
 * The version is matched as semver exactly rather than as "everything up to a
 * delimiter". A lockfile decorates a version with the peers it resolved
 * against, today in parentheses, and a looser pattern that swallowed part of
 * that decoration would read one version as two spellings and report a
 * duplicate that does not exist. A gate that cries wolf gets ignored, so the
 * grammar is pinned to what a version actually is.
 */
function resolvedVersions(source: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const entry = /(@radix-ui\/[A-Za-z0-9._-]+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/g;
  for (const match of source.matchAll(entry)) {
    const name = match[1] as string;
    const version = match[2] as string;
    const versions = found.get(name) ?? new Set<string>();
    versions.add(version);
    found.set(name, versions);
  }
  return found;
}

/**
 * Read inside the tests rather than at module scope. A top-level read turns a
 * missing or unreadable lockfile into a loader crash, which vitest reports as a
 * file that would not import — not as an assertion anyone can act on.
 */
const analyse = () => resolvedVersions(readFileSync(findLockfile(), "utf8"));

/**
 * A floor, not the real count: the lockfile resolves 38 `@radix-ui/*` packages
 * as this is written, and the two direct dependencies pull the rest in
 * transitively, so the number moves whenever Radix reorganises its internals.
 * Half of today's count leaves room for that while still catching the case
 * this guards — a parse that matched almost nothing.
 */
const MINIMUM_RADIX_PACKAGES = 20;

/** The `@radix-ui/*` packages this package depends on by name. */
function declaredRadixDependencies(): string[] {
  const manifest = JSON.parse(
    readFileSync(resolvePath(dirname(findLockfile()), "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  return Object.keys(manifest.dependencies ?? {})
    .filter((name) => name.startsWith("@radix-ui/"))
    .sort();
}

describe("the Radix stack resolves to one copy of each package", () => {
  it("finds the Radix packages to check", () => {
    // A lockfile format change that stopped matching would otherwise report
    // "no duplicates" from an empty set — the strongest possible pass from the
    // weakest possible parse.
    expect(analyse().size).toBeGreaterThan(MINIMUM_RADIX_PACKAGES);
  });

  it("finds every Radix package this one depends on by name", () => {
    // The count floor above only catches a parse that broke for everything. A
    // format change that stopped matching some spellings would slip past it,
    // and could hide a duplicate among exactly the entries it stopped reading.
    // These names come from the manifest rather than from the parse, so they
    // are the one part of the expectation the lockfile cannot quietly rewrite.
    const parsed = analyse();
    const declared = declaredRadixDependencies();
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((name) => !parsed.has(name))).toEqual([]);
  });

  it("no @radix-ui package resolves to more than one version", () => {
    const duplicated = [...analyse()]
      .filter(([, set]) => set.size > 1)
      .map(([name, set]) => `${name}: ${[...set].sort().join(", ")}`)
      .sort();
    expect(duplicated).toEqual([]);
  });
});
