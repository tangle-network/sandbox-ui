import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  canonicalModelId,
  formatPricing,
  formatContext,
  resolveModelBrandIdentity,
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

describe("resolveModelBrandIdentity", () => {
  it("combines provider and lab when the same company hosts its own model", () => {
    const identity = resolveModelBrandIdentity({
      id: "anthropic/claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      _provider: "anthropic",
    });

    expect(identity.combined).toBe(true);
    expect(identity.host.key).toBe("anthropic");
    expect(identity.lab.key).toBe("anthropic");
    expect(identity.lab.logoUrl).toMatch(/^data:image\/svg\+xml/);
  });

  it("keeps host provider and model lab separate for routed models", () => {
    const identity = resolveModelBrandIdentity({
      id: "anthropic/claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      _provider: "openrouter",
    });

    expect(identity.combined).toBe(false);
    expect(identity.host.key).toBe("openrouter");
    expect(identity.lab.key).toBe("anthropic");
  });

  it("infers video labs behind hosting providers", () => {
    const identity = resolveModelBrandIdentity({
      id: "kling/v2.1",
      name: "Kling 2.1",
      _provider: "tcloud",
      architecture: { modality: "text->video" },
    });

    expect(identity.combined).toBe(false);
    expect(identity.host.key).toBe("tcloud");
    expect(identity.lab.key).toBe("kuaishou");
    expect(identity.host.logo).toBe("tangle");
    expect(identity.lab.logoUrl).toMatch(/^data:image\/svg\+xml/);
  });

  it("carries explicit logo URLs for products with real brand assets", () => {
    const identity = resolveModelBrandIdentity({
      id: "anthropic/claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      _provider: "openrouter",
      logos: {
        hostUrl: "/logos/openrouter.svg",
        labUrl: "/logos/anthropic.svg",
      },
    });

    expect(identity.host.logoUrl).toBe("/logos/openrouter.svg");
    expect(identity.lab.logoUrl).toBe("/logos/anthropic.svg");
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
    expect(document.activeElement).toBe(input);

    // Use keyboard() so each keystroke targets document.activeElement — that
    // way, if focus is stolen mid-typing, subsequent characters land on the
    // wrong element and the input value comes back short.
    await user.keyboard("gpt");

    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue("gpt");
  });

  it("ArrowDown from the input does not steal focus to a menu item", async () => {
    // Sanity check against a plausible misreading of the fix: arrow keys are
    // not stopped, but Radix-menu's FIRST_LAST_KEYS handler short-circuits
    // when the keydown target is not the Content element itself, and
    // RovingFocusGroup attaches its arrow handlers to items (not the root),
    // so neither path moves focus when the input is focused.
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={() => {}} models={MODELS} />);
    await user.click(screen.getByRole("button"));
    const input = await screen.findByPlaceholderText("Search models...");
    input.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(input);
  });
});

describe("ModelPicker popular section", () => {
  // The Popular section is opt-in and consumer-driven: callers pass a
  // curated list of canonical ids and the picker resolves them against
  // the loaded `models` catalog. Ids that aren't currently served are
  // silently dropped so the curation list can stay stable across
  // catalog rotations without producing dead rows.
  const MODELS: ModelInfo[] = [
    { id: "gpt-5.4", name: "GPT-5.4", _provider: "openai" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 mini", _provider: "openai" },
    { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", _provider: "anthropic" },
    { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", _provider: "anthropic" },
  ];

  it("renders Popular when ids are provided and at least one resolves", async () => {
    const user = userEvent.setup();
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={MODELS}
        popular={["openai/gpt-5.4", "anthropic/claude-sonnet-4-6"]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Top models")).toBeInTheDocument();
  });

  it("omits the section entirely when popular is empty or unset", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={() => {}} models={MODELS} />);
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Top models")).not.toBeInTheDocument();
  });

  it("silently skips popular ids not present in the loaded list", async () => {
    const user = userEvent.setup();
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={MODELS}
        popular={["ghost/never-served", "openai/gpt-5.4"]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Top models")).toBeInTheDocument();
    // The top-models section is rendered above the per-provider groups, so
    // a resolvable popular id appears in both: a row inside Popular AND
    // its own row inside the openai group. The ghost id appears in
    // neither — that's the silent-skip we're testing.
    expect(screen.getAllByText("GPT-5.4").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/never-served/)).not.toBeInTheDocument();
  });

  it("hides the Popular section while the user is searching", async () => {
    const user = userEvent.setup();
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={MODELS}
        popular={["openai/gpt-5.4"]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Top models")).toBeInTheDocument();
    const input = await screen.findByPlaceholderText("Search models...");
    input.focus();
    await user.keyboard("haiku");
    expect(screen.queryByText("Top models")).not.toBeInTheDocument();
  });
});

describe("ModelPicker model family ordering", () => {
  it("pins core model families before the alphabetical remainder", async () => {
    const user = userEvent.setup();
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={[
          { id: "mistral-large", name: "Mistral Large", _provider: "mistral" },
          { id: "kimi-k2", name: "Kimi K2", _provider: "openrouter" },
          { id: "deepseek-v3", name: "DeepSeek V3", _provider: "openrouter" },
          { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", _provider: "google" },
          { id: "z-ai/glm-4.6", name: "GLM 4.6", _provider: "openrouter" },
          { id: "gpt-5.4", name: "GPT-5.4", _provider: "openai" },
          { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", _provider: "openrouter" },
          { id: "cohere-command-r", name: "Command R", _provider: "cohere" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));

    const labels = ["Anthropic", "OpenAI", "Google", "DeepSeek", "Z.ai", "Kimi", "Cohere", "Mistral"];
    const nodes = labels.map((label) => screen.getAllByText(label)[0]);
    for (let index = 0; index < nodes.length - 1; index += 1) {
      expect(nodes[index].compareDocumentPosition(nodes[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("ModelPicker brand identity", () => {
  const MODELS: ModelInfo[] = [
    { id: "gpt-5.4", name: "GPT-5.4", _provider: "openai" },
    { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", _provider: "openrouter" },
    { id: "mystery-model", name: "Mystery Model" },
  ];

  it("shows routed host to lab identity in model rows", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="openrouter/anthropic/claude-sonnet-4-6" onChange={() => {}} models={MODELS} />);
    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("OpenRouter → Anthropic")).toBeInTheDocument();
  });

  it("renders verified logo assets and no fake monogram text", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="openai/gpt-5.4" onChange={() => {}} models={MODELS} />);
    await user.click(screen.getByRole("button"));

    expect(await screen.findAllByLabelText("OpenAI")).not.toHaveLength(0);
    expect(screen.queryByText("OR")).not.toBeInTheDocument();
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  it("lets users search by inferred lab name even when grouped under a host provider", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={() => {}} models={MODELS} />);
    await user.click(screen.getByRole("button"));
    const input = await screen.findByPlaceholderText("Search models...");
    input.focus();
    await user.keyboard("anthropic");

    expect(screen.getByText("Claude Sonnet 4.6")).toBeInTheDocument();
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
