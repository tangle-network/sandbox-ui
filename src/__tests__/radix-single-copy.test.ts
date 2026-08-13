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

import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const lockfile = readFileSync(
  resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "pnpm-lock.yaml"),
  "utf8",
);

/** `@radix-ui/react-x@1.2.3` occurrences, collected per package. */
function resolvedVersions(source: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const match of source.matchAll(/(@radix-ui\/[a-z-]+)@(\d+\.\d+\.\d+[^\s'"(:]*)/g)) {
    const name = match[1] as string;
    const version = match[2] as string;
    const versions = found.get(name) ?? new Set<string>();
    versions.add(version);
    found.set(name, versions);
  }
  return found;
}

const versions = resolvedVersions(lockfile);
const duplicated = [...versions]
  .filter(([, set]) => set.size > 1)
  .map(([name, set]) => `${name}: ${[...set].sort().join(", ")}`)
  .sort();

describe("the Radix stack resolves to one copy of each package", () => {
  it("finds the Radix packages to check", () => {
    // A lockfile format change that stopped matching would otherwise report
    // "no duplicates" from an empty set — the strongest possible pass from the
    // weakest possible parse.
    expect(versions.size).toBeGreaterThan(20);
  });

  it("no @radix-ui package resolves to more than one version", () => {
    expect(duplicated).toEqual([]);
  });
});
