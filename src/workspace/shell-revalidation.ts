/**
 * Snappy in-app navigation: a shared `shouldRevalidate` rule for the agent-app
 * shell route(s) that own the workspace-list / sidebar loader.
 *
 * The shell loader (user + workspace list, sidebar state) runs on every
 * navigation, but its data does not change just by moving between in-app pages.
 * Refetching it on every internal GET nav adds a loader round-trip to each
 * click — on Cloudflare Workers + D1 (HTTP-proxied) that is a visible stall.
 *
 * This helper encodes the rule that makes nav feel instant WITHOUT stranding
 * freshly-mutated data:
 *
 *   - Non-GET navigation (form submit / action) → always revalidate.
 *   - Internal app→app navigation that CHANGES the path → skip revalidation.
 *   - Imperative `useRevalidator().revalidate()` (which targets the SAME url,
 *     so `currentUrl.pathname === nextUrl.pathname`) → revalidate. Creating a
 *     project / thread typically goes through a raw `fetch`, so a same-url
 *     revalidate is the ONLY way the new row reaches the shell loader; the
 *     same-path carve-out below is what keeps that working. Suppressing it is
 *     the project-switcher regression — do not "simplify" it away.
 *   - Anything else (cross-path-prefix nav, entering/leaving the app) →
 *     defer to `defaultShouldRevalidate`.
 *
 * Framework-agnostic by design: sandbox-ui does not depend on react-router, so
 * this takes a plain args object. The shape is a structural subset of
 * react-router's `ShouldRevalidateFunctionArgs`, so an app can wire it as a
 * route export with no adapter:
 *
 * ```ts
 * // app/routes/app.tsx
 * import { shellShouldRevalidate } from "@tangle-network/sandbox-ui/workspace";
 * export const shouldRevalidate = shellShouldRevalidate;
 * ```
 *
 * `shouldRevalidate` MUST be a per-app react-router route export — it cannot be
 * exported FROM a library on the app's behalf — so the "out of the box" win is
 * the one-line re-export above instead of every app re-deriving the rule (and
 * re-introducing the same-url bug).
 */

/**
 * The subset of react-router's `ShouldRevalidateFunctionArgs` this rule reads.
 * Kept structural so callers can pass the full react-router args object as-is.
 */
export interface ShellShouldRevalidateArgs {
  currentUrl: URL;
  nextUrl: URL;
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}

export interface ShellShouldRevalidateOptions {
  /**
   * Path prefix that marks "inside the app shell". Internal navigation between
   * two paths under this prefix skips the shell-loader refetch. Defaults to
   * `"/app"`.
   */
  appPathPrefix?: string;
}

/**
 * Build a `shouldRevalidate` function for the shell route under `appPathPrefix`.
 * Use this when the app mounts under a non-default prefix; otherwise prefer the
 * ready-made {@link shellShouldRevalidate} export.
 */
export function createShellShouldRevalidate(
  options: ShellShouldRevalidateOptions = {},
): (args: ShellShouldRevalidateArgs) => boolean {
  const appPathPrefix = options.appPathPrefix ?? "/app";
  return function shouldRevalidate(args: ShellShouldRevalidateArgs): boolean {
    const { currentUrl, nextUrl, formMethod, defaultShouldRevalidate } = args;
    // Actions (any non-GET method) mutate server state → must revalidate.
    if (formMethod && formMethod !== "GET") return true;
    // Internal app→app navigation to a DIFFERENT path: the shell loader's data
    // (workspace list, sidebar) is path-independent, so skip the refetch. The
    // `!==` guard is load-bearing: a same-path nav is an imperative revalidate
    // (e.g. after creating a project/thread via raw fetch) and must NOT be
    // suppressed, or the new row stays invisible until a hard reload.
    if (
      currentUrl.pathname !== nextUrl.pathname &&
      currentUrl.pathname.startsWith(appPathPrefix) &&
      nextUrl.pathname.startsWith(appPathPrefix)
    ) {
      return false;
    }
    return defaultShouldRevalidate;
  };
}

/**
 * Ready-made shell `shouldRevalidate` for apps mounted under `/app`. Wire it as
 * a one-line route export:
 *
 * ```ts
 * export const shouldRevalidate = shellShouldRevalidate;
 * ```
 *
 * For a non-`/app` prefix, use {@link createShellShouldRevalidate}.
 */
export const shellShouldRevalidate = createShellShouldRevalidate();
