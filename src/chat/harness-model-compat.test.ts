import { describe, expect, it } from "vitest";
import * as agentInterface from "@tangle-network/agent-interface";
import { modelProvider, snapHarnessToModel } from "./harness-model-compat";

describe("re-exports", () => {
  it("publishes the canonical agent-interface bindings, not local copies", () => {
    expect(modelProvider).toBe(agentInterface.modelProvider);
    expect(snapHarnessToModel).toBe(agentInterface.snapHarnessToModel);
  });
});

describe("snapHarnessToModel", () => {
  it("picking an Anthropic model under codex switches to claude-code", () => {
    expect(snapHarnessToModel("codex", "anthropic/claude-opus-4-8")).toBe(
      "claude-code",
    );
  });

  it("picking an OpenAI model under claude-code switches to codex", () => {
    expect(snapHarnessToModel("claude-code", "openai/gpt-5.5")).toBe("codex");
  });

  it("picking a Moonshot model under claude-code switches to kimi-code", () => {
    expect(snapHarnessToModel("claude-code", "moonshot/kimi-k2")).toBe(
      "kimi-code",
    );
  });

  it("openclaw and hermes run everything, so no harness change occurs", () => {
    expect(snapHarnessToModel("openclaw", "anthropic/claude-opus-4-8")).toBe(
      "openclaw",
    );
    expect(snapHarnessToModel("hermes", "openai/gpt-5.5")).toBe("hermes");
  });

  it("opencode runs everything, so no harness change occurs", () => {
    expect(snapHarnessToModel("opencode", "anthropic/claude-opus-4-8")).toBe(
      "opencode",
    );
    expect(snapHarnessToModel("opencode", "openai/gpt-5.5")).toBe("opencode");
  });

  it("third-party providers under a locked-vendor harness fall back to opencode", () => {
    expect(snapHarnessToModel("codex", "zai/glm-4.7")).toBe("opencode");
  });
});
