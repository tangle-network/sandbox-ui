import { describe, expect, it } from "vitest";
import {
  createShellShouldRevalidate,
  shellShouldRevalidate,
  type ShellShouldRevalidateArgs,
} from "./shell-revalidation";

function args(overrides: Partial<ShellShouldRevalidateArgs> & {
  current: string;
  next: string;
}): ShellShouldRevalidateArgs {
  const { current, next, ...rest } = overrides;
  return {
    currentUrl: new URL(`https://app.test${current}`),
    nextUrl: new URL(`https://app.test${next}`),
    defaultShouldRevalidate: true,
    ...rest,
  };
}

describe("shellShouldRevalidate", () => {
  it("skips revalidation on internal /app -> /app GET navigation (different path)", () => {
    expect(
      shellShouldRevalidate(args({ current: "/app/w1/chat", next: "/app/w1/board" })),
    ).toBe(false);
  });

  it("revalidates on imperative same-URL revalidate (project/thread create via raw fetch)", () => {
    // useRevalidator().revalidate() re-runs the loader against the SAME url.
    expect(
      shellShouldRevalidate(args({ current: "/app/w1/chat", next: "/app/w1/chat" })),
    ).toBe(true);
  });

  it("revalidates on a non-GET navigation (form action)", () => {
    expect(
      shellShouldRevalidate(
        args({ current: "/app/w1/chat", next: "/app/w2/chat", formMethod: "POST" }),
      ),
    ).toBe(true);
  });

  it("defers to default on cross-path navigation leaving the app prefix", () => {
    expect(
      shellShouldRevalidate(
        args({ current: "/app/w1/chat", next: "/login", defaultShouldRevalidate: true }),
      ),
    ).toBe(true);
    expect(
      shellShouldRevalidate(
        args({ current: "/login", next: "/app/w1/chat", defaultShouldRevalidate: false }),
      ),
    ).toBe(false);
  });

  it("does not suppress same-URL revalidation even with a GET formMethod", () => {
    expect(
      shellShouldRevalidate(
        args({ current: "/app/w1/chat", next: "/app/w1/chat", formMethod: "GET" }),
      ),
    ).toBe(true);
  });

  it("honors a custom app path prefix", () => {
    const rule = createShellShouldRevalidate({ appPathPrefix: "/workspace" });
    expect(rule(args({ current: "/workspace/a", next: "/workspace/b" }))).toBe(false);
    // /app is no longer "internal" under this prefix, so default applies.
    expect(
      rule(args({ current: "/app/a", next: "/app/b", defaultShouldRevalidate: true })),
    ).toBe(true);
  });
});
