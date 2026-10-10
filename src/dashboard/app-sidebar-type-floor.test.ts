import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The rail's type floor. Every label the sidebar shows (flyout titles, empty
 * states, the account name, email and plan, the appearance caption, avatar
 * initials) reads at 14px (`text-sm`) or larger, the floor Tangle's products
 * hold. The one exemption is the unread count: a glyph inside a 16px dot on an
 * icon, marked `data-badge="count"`.
 */
const source = readFileSync(join(__dirname, "app-sidebar.tsx"), "utf8");

function tinyType(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => !line.includes('data-badge="count"'))
    .flatMap((line) =>
      [...line.matchAll(/\btext-(?:xs|\[(\d+(?:\.\d+)?)(px|rem)\])/g)]
        .filter((match) => !match[1] || Number(match[1]) * (match[2] === "rem" ? 16 : 1) < 14)
        .map((match) => match[0]),
    );
}

describe("sidebar type floor", () => {
  it("detects text-xs and literal sizes under 14px", () => {
    expect(tinyType('a className="text-xs" b text-[11px] c text-[15px]')).toEqual(["text-xs", "text-[11px]"]);
    expect(tinyType('<span data-badge="count" className="text-xs">')).toEqual([]);
  });

  it("renders no rail label under 14px", () => {
    expect(tinyType(source)).toEqual([]);
  });
});
