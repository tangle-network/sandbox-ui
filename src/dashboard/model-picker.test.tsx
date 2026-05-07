import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  canonicalModelId,
  formatPricing,
  formatContext,
  ModelPicker,
  type ModelInfo,
} from "./model-picker";

describe("canonicalModelId", () => {
  it("uses _provider/id when id has no slash (OpenAI shape)", () => {
    expect(canonicalModelId({ id: "gpt-5.4", _provider: "openai" })).toBe("openai/gpt-5.4");
  });

  it("preserves an already-prefixed id (Anthropic shape)", () => {
    expect(canonicalModelId({ id: "anthropic/claude-haiku-4.5", _provider: "anthropic" })).toBe(
      "anthropic/claude-haiku-4.5",
    );
  });

  it("falls back to provider field when _provider absent", () => {
    expect(canonicalModelId({ id: "command-r", provider: "cohere" })).toBe("cohere/command-r");
  });

  it("returns bare id when no provider available", () => {
    expect(canonicalModelId({ id: "mystery-model" })).toBe("mystery-model");
  });

  it("does not double-prefix even when provider matches the prefix", () => {
    expect(canonicalModelId({ id: "openai/gpt-5.4", _provider: "openai" })).toBe("openai/gpt-5.4");
  });
});

describe("formatPricing", () => {
  it("formats per-token decimal strings as $/M tokens", () => {
    expect(formatPricing({ prompt: "0.000003", completion: "0.000015" })).toBe("$3.00 / $15.00 per 1M");
  });

  it("returns null when both prices are zero (router default for unpriced rows)", () => {
    expect(formatPricing({ prompt: "0", completion: "0" })).toBeNull();
  });

  it("returns null when pricing is missing entirely", () => {
    expect(formatPricing(undefined)).toBeNull();
  });

  it("handles sub-cent values without losing precision visually", () => {
    expect(formatPricing({ prompt: "0.00000025", completion: "0.00000125" })).toBe("$0.25 / $1.25 per 1M");
  });
});

describe("formatContext", () => {
  it("formats k-scale", () => {
    expect(formatContext(200_000)).toBe("200k ctx");
  });

  it("formats M-scale with one decimal", () => {
    expect(formatContext(2_000_000)).toBe("2.0M ctx");
  });

  it("returns raw value below 1k", () => {
    expect(formatContext(512)).toBe("512 ctx");
  });

  it("returns null when undefined", () => {
    expect(formatContext(undefined)).toBeNull();
  });
});

describe("ModelPicker search input", () => {
  // Regression for issue #39: typing into the search input lost focus to a
  // matching menu item because @radix-ui/react-dropdown-menu's Content runs a
  // typeahead handler on every character keydown that bubbles up. Focus theft
  // happened only when the typed text matched a model's textValue, which is
  // why early users could "type one character" before getting kicked out.
  const MODELS: ModelInfo[] = [
    { id: "gpt-5.4", name: "GPT-5.4", _provider: "openai" },
    { id: "gpt-5-mini", name: "GPT-5 mini", _provider: "openai" },
    { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", _provider: "anthropic" },
  ];

  it("retains focus on the search input while typing a query that matches a model", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={() => {}} models={MODELS} />);

    await user.click(screen.getByRole("button"));
    const input = await screen.findByPlaceholderText("Search models...");
    // Radix may have focused the Content element on mount; the search input
    // owns text entry, so explicitly seat focus there before typing.
    input.focus();
    expect(document.activeElement).toBe(input);

    // Use keyboard() so each keystroke targets document.activeElement — that
    // way, if focus is stolen mid-typing, subsequent characters land on the
    // wrong element and the input value comes back short.
    await user.keyboard("gpt");

    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue("gpt");
  });
});

describe("ModelInfo type compatibility with router /v1/models", () => {
  // Smoke: a row matching exactly the shape our router returns should compile.
  const sample: ModelInfo = {
    id: "gpt-5.4",
    name: "GPT-5.4",
    _provider: "openai",
    pricing: { prompt: "0.0000025", completion: "0.000015" },
    context_length: 400_000,
    architecture: { modality: "text", input_modalities: ["text", "image"], output_modalities: ["text"] },
    description: null,
  };
  it("typechecks", () => {
    expect(canonicalModelId(sample)).toBe("openai/gpt-5.4");
  });
});
