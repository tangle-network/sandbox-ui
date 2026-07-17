import { describe, expect, it } from "vitest";
import { integrationStepYaml } from "./integration-step-yaml";

describe("integrationStepYaml", () => {
  it("stubs only the required fields when the schema names them", () => {
    const yaml = integrationStepYaml("github.issues.create", {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["owner", "repo", "title"],
    });
    expect(yaml).toBe(
      [
        "- integration.invoke:",
        "    path: github.issues.create",
        "    input:",
        '      owner: ""',
        '      repo: ""',
        '      title: ""',
        "",
      ].join("\n"),
    );
  });

  it("stubs every top-level field when nothing is required", () => {
    const yaml = integrationStepYaml("slack.messages.send", {
      type: "object",
      properties: {
        channel: { type: "string" },
        thread: { type: "string" },
      },
    });
    expect(yaml).toContain('channel: ""');
    expect(yaml).toContain('thread: ""');
  });

  it("stubs placeholders by type and uses an enum's first value", () => {
    const yaml = integrationStepYaml("x.y", {
      type: "object",
      properties: {
        count: { type: "integer" },
        dryRun: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } },
        meta: { type: "object" },
        event: { type: "string", enum: ["COMMENT", "APPROVE"] },
      },
    });
    expect(yaml).toContain("count: 0");
    expect(yaml).toContain("dryRun: false");
    expect(yaml).toContain("tags: []");
    expect(yaml).toContain("meta: {}");
    expect(yaml).toContain('event: "COMMENT"');
  });

  it("skips non-string enum members and stubs by type instead", () => {
    // A non-string first enum member must not be inlined — JSON.stringify would
    // emit a type-changing bare token (`true`, `0`, `{}`) or, for a malformed
    // `undefined` member, the literal `undefined`. The type placeholder is used
    // instead, and a later string member is preferred when present.
    const yaml = integrationStepYaml("x.y", {
      type: "object",
      properties: {
        flag: { type: "boolean", enum: [true, false] },
        size: { type: "integer", enum: [1, 2] },
        shape: { type: "object", enum: [{}] },
        broken: { enum: [undefined] },
        nullable: { type: "string", enum: [null, "keep"] },
      },
    });
    expect(yaml).toContain("flag: false");
    expect(yaml).toContain("size: 0");
    expect(yaml).toContain("shape: {}");
    expect(yaml).toContain('broken: ""');
    // A null member is skipped in favor of the first real string.
    expect(yaml).toContain('nullable: "keep"');
    // Never emits type-changing or invalid bare tokens from the enum branch.
    expect(yaml).not.toContain("undefined");
    expect(yaml).not.toContain("flag: true");
  });

  it("quotes keys that are not bare-safe in YAML", () => {
    const yaml = integrationStepYaml("x.y", {
      type: "object",
      properties: { "content-type": { type: "string" }, "1weird": {} },
    });
    expect(yaml).toContain('content-type: ""');
    expect(yaml).toContain('"1weird": ""');
  });

  it("emits an empty input map for schema-less or non-object schemas", () => {
    for (const schema of [undefined, null, true, { type: "string" }, {}]) {
      const yaml = integrationStepYaml("x.y", schema);
      expect(yaml).toBe(
        ["- integration.invoke:", "    path: x.y", "    input: {}", ""].join(
          "\n",
        ),
      );
    }
  });

  it("ignores required names the properties don't define", () => {
    const yaml = integrationStepYaml("x.y", {
      type: "object",
      properties: { real: { type: "string" } },
      required: ["ghost", "real"],
    });
    expect(yaml).toContain('real: ""');
    expect(yaml).not.toContain("ghost");
  });

  it("emits a normal dotted path bare", () => {
    expect(integrationStepYaml("github.issues.create", undefined)).toContain(
      "    path: github.issues.create\n",
    );
  });

  it("quotes a path a YAML parser would coerce to a non-string", () => {
    // Reserved scalar words and pure-numeric tokens would load as
    // boolean/null/number if emitted bare — real hub paths never look like
    // this, but the helper must not silently change the path's type.
    for (const path of ["true", "false", "null", "no", "123", "1.2"]) {
      const yaml = integrationStepYaml(path, undefined);
      expect(yaml).toContain(`    path: ${JSON.stringify(path)}\n`);
    }
  });

  it("quotes a path with structural YAML characters", () => {
    const yaml = integrationStepYaml("a: b\n- c", undefined);
    expect(yaml).toContain(`    path: ${JSON.stringify("a: b\n- c")}\n`);
  });
});
