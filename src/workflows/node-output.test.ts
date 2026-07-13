import { describe, expect, it } from "vitest";
import { classifyOutput, condenseText } from "./node-output";

describe("condenseText", () => {
  it("reads an agent's markdown answer back as the sentence it is", () => {
    // The exact shape that made a node's output look like a word dump: prose
    // running straight into a heading, with the markup eating the visible lines.
    const answer = [
      "Perfect! I found your most recent merged pull request.",
      "",
      "## Your Most Recent Merged PR",
      "",
      "- **Title**: Fix the retry loop",
      "- **Repo**: `tangle-network/platform`",
    ].join("\n");
    expect(condenseText(answer)).toBe(
      "Perfect! I found your most recent merged pull request. Your Most Recent Merged PR · Title: Fix the retry loop · Repo: tangle-network/platform",
    );
  });

  it("strips every block marker, keeping the words", () => {
    expect(condenseText("### Heading")).toBe("Heading");
    expect(condenseText("> quoted line")).toBe("quoted line");
    // A list keeps its item boundaries — three bullets run together with plain
    // spaces read as one long sentence, which is the word dump all over again.
    expect(condenseText("1. first\n2) second")).toBe("first · second");
    expect(condenseText("- [x] done\n- [ ] todo")).toBe("done · todo");
  });

  it("unwraps inline emphasis, code, links and images", () => {
    expect(condenseText("**bold** and _kept_ and *italic*")).toBe(
      "bold and _kept_ and italic",
    );
    expect(condenseText("~~struck~~ `code`")).toBe("struck code");
    expect(condenseText("see [the runbook](https://example.com/rb)")).toBe(
      "see the runbook",
    );
    expect(condenseText("![](https://example.com/x.png) after")).toBe("after");
  });

  it("stays linear on an adversarial near-miss line (no catastrophic backtracking)", () => {
    // The structure test recognizes its charset in ONE quantified pass, so a long
    // line of pipes/dashes/colons that ALMOST matches cannot make it backtrack.
    // (The card path clamps input long before this, but a regex that can blow up is
    // a regex that will, somewhere.)
    const nearMiss = `${"|-: ".repeat(20000)}x`;
    const started = performance.now();
    condenseText(nearMiss);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("drops structure-only lines (fences, table rules)", () => {
    const md = ["```ts", "const x = 1;", "```"].join("\n");
    expect(condenseText(md)).toBe("const x = 1;");
    const table = ["| a | b |", "| - | - |", "| 1 | 2 |"].join("\n");
    expect(condenseText(table)).toBe("| a | b | | 1 | 2 |");
  });

  it("leaves plain prose untouched", () => {
    expect(condenseText("Build succeeded. 214 tests passed.")).toBe(
      "Build succeeded. 214 tests passed.",
    );
  });

  it("does not mangle a bare asterisk or an unpaired marker", () => {
    expect(condenseText("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(condenseText("an * unpaired marker")).toBe("an * unpaired marker");
    // A glob and an Angular-style directive read as text, not as emphasis.
    expect(condenseText("no match for pattern src/**/*.test.ts")).toBe(
      "no match for pattern src/**/*.test.ts",
    );
    expect(condenseText("undefined at *ngFor")).toBe("undefined at *ngFor");
  });

  it("never rewrites a dunder — a traceback is not markdown", () => {
    // The node's ERROR preview runs through here too, and real failure text is
    // full of `__init__` / `__main__`. Treating `__…__` as bold silently rewrote
    // the path in a Python traceback, which is the worst possible thing to do to
    // a message someone is reading to find out what broke.
    expect(
      condenseText('Traceback: File "/app/pkg/__init__.py", line 12'),
    ).toBe('Traceback: File "/app/pkg/__init__.py", line 12');
    expect(condenseText("No module named 'my_pkg.__main__'")).toBe(
      "No module named 'my_pkg.__main__'",
    );
    expect(condenseText("a __dunder__ stays put")).toBe(
      "a __dunder__ stays put",
    );
  });
});

describe("classifyOutput", () => {
  it("treats absent/blank input as empty", () => {
    expect(classifyOutput(undefined)).toEqual({ kind: "empty" });
    expect(classifyOutput("")).toEqual({ kind: "empty" });
    expect(classifyOutput("   \n  ")).toEqual({ kind: "empty" });
  });

  it("classifies prose as text", () => {
    const shape = classifyOutput("Build succeeded. 214 tests passed.");
    expect(shape).toEqual({
      kind: "text",
      text: "Build succeeded. 214 tests passed.",
    });
  });

  it("condenses a markdown answer ONLY when the caller says it is markdown", () => {
    const md = "## Summary\n\n- **Passed**: 214 tests";
    expect(classifyOutput(md, true)).toEqual({
      kind: "text",
      text: "Summary · Passed: 214 tests",
    });
    // Off by default: the same string from a non-agent node (an API body) or from
    // an ERROR channel must reach the reader exactly as it arrived.
    expect(classifyOutput(md)).toEqual({ kind: "text", text: md });
  });

  it("never rewrites text it was not told is markdown — the error path", () => {
    // The strings that made this dangerous: condensing an error would rename the
    // file in a traceback and delete both halves of a shell glob.
    const trace = 'File "/app/pkg/__init__.py", line 12';
    const glob = "no match: src/**/*.ts and docs/**/*.md";
    expect(classifyOutput(trace)).toEqual({ kind: "text", text: trace });
    expect(classifyOutput(glob)).toEqual({ kind: "text", text: glob });
  });

  it("treats markup that carries no words as empty, not as a blank block", () => {
    expect(classifyOutput("```\n```", true)).toEqual({ kind: "empty" });
    expect(classifyOutput("---", true)).toEqual({ kind: "empty" });
  });

  it("flattens a shallow JSON object to key/value entries", () => {
    const shape = classifyOutput('{"status":200,"id":4821,"state":"APPROVED"}');
    expect(shape).toEqual({
      kind: "json",
      truncated: false,
      entries: [
        ["status", "200"],
        ["id", "4821"],
        ["state", "APPROVED"],
      ],
    });
  });

  it("renders nested values as shape markers, not walls of text", () => {
    const shape = classifyOutput(
      '{"ok":true,"items":[1,2,3],"meta":{"a":1}}',
    );
    expect(shape).toEqual({
      kind: "json",
      truncated: false,
      entries: [
        ["ok", "true"],
        ["items", "[3 items]"],
        ["meta", "{…}"],
      ],
    });
  });

  it("caps entries and reports truncation for a wide object", () => {
    const wide = JSON.stringify(
      Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i])),
    );
    const shape = classifyOutput(wide);
    if (shape.kind !== "json") throw new Error("expected json");
    expect(shape.entries).toHaveLength(6);
    expect(shape.truncated).toBe(true);
  });

  it("keeps a JSON array as code (its compact literal), not key/value rows", () => {
    const shape = classifyOutput('["a","b","c"]');
    expect(shape).toEqual({ kind: "code", text: '["a","b","c"]' });
  });

  it("keeps a clamped-mid-token JSON fragment as code (still data-shaped)", () => {
    // The host clamps the preview, so a long object arrives unparseable — it must
    // stay monospace `code`, never fall back to prose.
    const shape = classifyOutput('{"status":200,"body":"a very long value tha');
    expect(shape.kind).toBe("code");
  });

  it("does not parse prose that merely mentions a brace", () => {
    const shape = classifyOutput("the config uses { } blocks");
    expect(shape.kind).toBe("text");
  });

  it("treats an empty object as code rather than an empty key/value block", () => {
    expect(classifyOutput("{}")).toEqual({ kind: "code", text: "{}" });
  });

  it("strips a trailing lone high surrogate left by an upstream slice", () => {
    // "😀" is U+1F600 = surrogate pair 😀; an upstream slice that keeps
    // only the high half leaves a lone surrogate that renders as the replacement
    // character. classifyOutput must drop it.
    const shape = classifyOutput("done \uD83D");
    expect(shape).toEqual({ kind: "text", text: "done" });
  });

  it("returns empty when the input is nothing but a lone high surrogate", () => {
    expect(classifyOutput("\uD83D")).toEqual({ kind: "empty" });
  });

  it("keeps a complete surrogate pair intact", () => {
    const shape = classifyOutput("done 😀");
    expect(shape).toEqual({ kind: "text", text: "done 😀" });
  });

  it("strips a lone high surrogate sitting just before a truncation ellipsis", () => {
    // clampPreview appends "…" after truncating; a pair cut at the boundary leaves
    // "<high>…". The surrogate must be dropped while the ellipsis is kept.
    expect(classifyOutput("abc\uD83D…")).toEqual({ kind: "text", text: "abc…" });
  });

  it("strips multiple consecutive trailing lone high surrogates", () => {
    expect(classifyOutput("hello\uD800\uD801")).toEqual({ kind: "text", text: "hello" });
    expect(classifyOutput("hi\uD800\uD801…")).toEqual({ kind: "text", text: "hi…" });
  });

  it("strips lone surrogates mid-string (from concatenated fragments), keeping pairs", () => {
    // A high surrogate not followed by a low, and a low not preceded by a high,
    // are both lone — drop them wherever they appear; a valid pair survives.
    expect(classifyOutput("a\uD83Db")).toEqual({ kind: "text", text: "ab" });
    expect(classifyOutput("a\uDE00b")).toEqual({ kind: "text", text: "ab" });
    expect(classifyOutput("x 😀 y")).toEqual({ kind: "text", text: "x 😀 y" });
  });
});
