import { describe, expect, it } from "vitest";
import { classifyOutput } from "./node-output";

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
});
