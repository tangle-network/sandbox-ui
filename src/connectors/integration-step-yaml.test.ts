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
});
