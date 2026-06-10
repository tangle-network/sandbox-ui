import { describe, expect, it } from "vitest";
import {
  isModelCompatibleWithHarness,
  snapHarnessToModel,
  snapModelToHarness,
} from "./harness-model-compat";

const CATALOG = [
  { id: "openai/gpt-5", name: "GPT-5", _provider: "openai" },
  { id: "openai/gpt-5.5", name: "GPT-5.5", _provider: "openai" },
  { id: "openai/gpt-5.5-mini", name: "GPT-5.5 Mini", _provider: "openai" },
  { id: "anthropic/claude-opus-4-8", name: "Opus 4.8", _provider: "anthropic" },
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Sonnet 4.6",
    _provider: "anthropic",
  },
  { id: "zai/glm-4.7", name: "GLM 4.7", _provider: "zai" },
];

describe("isModelCompatibleWithHarness", () => {
  it("claude-code rejects OpenAI models and accepts Anthropic", () => {
    expect(isModelCompatibleWithHarness("claude-code", "openai/gpt-5.5")).toBe(
      false,
    );
    expect(
      isModelCompatibleWithHarness(
        "claude-code",
        "anthropic/claude-opus-4-8",
      ),
    ).toBe(true);
  });

  it("opencode accepts any provider (router-backed)", () => {
    expect(isModelCompatibleWithHarness("opencode", "openai/gpt-5.5")).toBe(
      true,
    );
    expect(isModelCompatibleWithHarness("opencode", "zai/glm-4.7")).toBe(true);
  });

  it("prefix-less sentinel ids are compatible everywhere", () => {
    expect(isModelCompatibleWithHarness("codex", "default")).toBe(true);
    expect(isModelCompatibleWithHarness("claude-code", "")).toBe(true);
  });
});

describe("snapModelToHarness", () => {
  it("switching to codex snaps an Anthropic model to the latest standard-frontier GPT", () => {
    expect(
      snapModelToHarness("codex", "anthropic/claude-opus-4-8", CATALOG),
    ).toBe("openai/gpt-5.5");
  });

  it("standard frontier beats mini even when mini sorts later", () => {
    expect(snapModelToHarness("codex", "zai/glm-4.7", CATALOG)).toBe(
      "openai/gpt-5.5",
    );
  });

  it("switching to claude-code snaps an OpenAI model to the latest Opus", () => {
    expect(snapModelToHarness("claude-code", "openai/gpt-5.5", CATALOG)).toBe(
      "anthropic/claude-opus-4-8",
    );
  });

  it("keeps a compatible model untouched", () => {
    expect(snapModelToHarness("opencode", "zai/glm-4.7", CATALOG)).toBe(
      "zai/glm-4.7",
    );
    expect(
      snapModelToHarness("claude-code", "anthropic/claude-sonnet-4-6", CATALOG),
    ).toBe("anthropic/claude-sonnet-4-6");
  });

  it("returns the original id when the catalog has nothing compatible", () => {
    const anthropicOnly = CATALOG.filter((m) =>
      m.id.startsWith("anthropic/"),
    );
    expect(snapModelToHarness("codex", "zai/glm-4.7", anthropicOnly)).toBe(
      "zai/glm-4.7",
    );
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
