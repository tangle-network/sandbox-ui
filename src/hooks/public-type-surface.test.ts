/**
 * The hook types a caller has to NAME must be reachable from the package root.
 *
 * `src/hooks` re-exports with `export *`, so a type is always reachable through
 * the `/hooks` subpath. The root entry is a hand-typed list, which means a type
 * can be absent from it while every test and `tsc` stay green: nothing imports
 * it by name, so nothing notices. That is how `SessionDegradation` shipped
 * missing in the first place.
 *
 * The assertions here are type-level and erased at runtime, so `vitest` is not
 * what enforces them - `pnpm typecheck` is. That makes WHERE this file lives
 * load-bearing: tsconfig excludes `src/__tests__/**`, and a file at the repo
 * root is outside `include` altogether, so in either place these assertions
 * compile to nothing and pass with the export deleted. It has to sit under
 * `src/` and outside `src/__tests__/`. Verified by deleting the export and
 * watching this file go red.
 */

import { describe, expect, it } from "vitest";
import type {
  SessionDegradation,
  SessionInfo,
  UseSessionStreamOptions,
  UseSessionStreamResult,
} from "../index";

/** Fails to compile if `Name` is not exported from the root as a usable type. */
type Reachable<T> = [T] extends [never] ? never : true;

type Assertions = [
  Reachable<SessionDegradation>,
  Reachable<SessionInfo>,
  Reachable<UseSessionStreamOptions>,
  Reachable<UseSessionStreamResult>,
];

// `degradation` is typed with `SessionDegradation`, so a caller that renders the
// notice has to name it. This assignment is what makes the root export
// load-bearing rather than incidental.
const fromResult: SessionDegradation | null =
  null as UseSessionStreamResult["degradation"];

describe("public hook type surface", () => {
  it("keeps the session-stream types nameable from the package root", () => {
    const checked: Assertions = [true, true, true, true];
    expect(checked).toHaveLength(4);
    expect(fromResult).toBeNull();
  });
});
