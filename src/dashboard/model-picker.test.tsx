import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  canonicalModelId,
  modelDedupKey,
  dedupeModels,
  DEFAULT_FEATURED_MODEL_IDS,
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

describe("modelDedupKey", () => {
  it("collapses the same model served under different host/router prefixes", () => {
    const a = modelDedupKey({ id: "gpt-5.4", _provider: "openai" });
    const b = modelDedupKey({ id: "openai/gpt-5.4", _provider: "tcloud" });
    const c = modelDedupKey({ id: "openrouter/openai/gpt-5.4" });
    expect(a).toBe("openai/gpt-5.4");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("keeps distinct models distinct", () => {
    expect(modelDedupKey({ id: "anthropic/claude-opus-4-8" })).not.toBe(
      modelDedupKey({ id: "anthropic/claude-sonnet-4-6" }),
    );
  });

  it("falls back to the full canonical id for an unknown-lab bare model", () => {
    expect(modelDedupKey({ id: "mystery-model" })).toBe("mystery-model");
  });
});

describe("dedupeModels", () => {
  it("collapses router duplicates to one row per model", () => {
    const out = dedupeModels([
      { id: "gpt-5.4", name: "GPT-5.4", _provider: "openai" },
      { id: "gpt-5.4", name: "GPT-5.4 (tcloud)", _provider: "tcloud" },
      { id: "openrouter/openai/gpt-5.4", name: "GPT-5.4 (OR)" },
      { id: "anthropic/claude-opus-4-8", name: "Claude Opus 4.8", _provider: "anthropic" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.name)).toEqual(["GPT-5.4", "Claude Opus 4.8"]);
  });

  it("prefers a featured row when collapsing duplicates", () => {
    const out = dedupeModels([
      { id: "gpt-5.4", name: "Plain", _provider: "tcloud" },
      { id: "openai/gpt-5.4", name: "Featured", _provider: "openai", featured: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Featured");
  });

  it("is order-stable for surviving rows", () => {
    const out = dedupeModels([
      { id: "z", name: "Z" },
      { id: "a", name: "A" },
      { id: "z", name: "Z dup" },
    ]);
    expect(out.map((m) => m.id)).toEqual(["z", "a"]);
  });
});

describe("ModelPicker dedup + recommended", () => {
  it("renders a single row per model even when the catalog lists it under many hosts", async () => {
    const user = userEvent.setup();
    // Use gpt-5-mini (not on the Recommended seed list) so the only way it
    // can appear twice would be a dedup failure, not the Recommended echo.
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={[
          { id: "gpt-5-mini", name: "GPT-5 mini", _provider: "openai" },
          { id: "openai/gpt-5-mini", name: "GPT-5 mini", _provider: "tcloud" },
          { id: "openrouter/openai/gpt-5-mini", name: "GPT-5 mini" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(screen.getAllByText("GPT-5 mini")).toHaveLength(1);
    expect(screen.getByText(/1 of 1 model/)).toBeInTheDocument();
  });

  it("shows a Recommended section seeded from curated ids when no row is flagged", async () => {
    const user = userEvent.setup();
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={[
          { id: "anthropic/claude-opus-4-8", name: "Claude Opus 4.8", _provider: "anthropic" },
          { id: "some/obscure-model", name: "Obscure" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Recommended")).toBeInTheDocument();
    // The opus seed resolves; it appears in Recommended AND its group.
    expect(screen.getAllByText("Claude Opus 4.8").length).toBeGreaterThanOrEqual(2);
  });

  it("prefers an explicit catalog `featured` flag over the curated fallback", async () => {
    const user = userEvent.setup();
    render(
      <ModelPicker
        value=""
        onChange={() => {}}
        models={[
          { id: "x/handpicked", name: "Handpicked", featured: true },
          { id: "anthropic/claude-opus-4-8", name: "Claude Opus 4.8", _provider: "anthropic" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Recommended")).toBeInTheDocument();
    // Flagged row is recommended; the opus seed is NOT promoted because an
    // explicit flag exists.
    expect(screen.getAllByText("Handpicked").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Claude Opus 4.8")).toHaveLength(1);
  });

  it("exposes a non-empty default featured seed list", () => {
    expect(DEFAULT_FEATURED_MODEL_IDS.length).toBeGreaterThan(0);
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

  it("does not modal-lock the page while open", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={() => {}} models={MODELS} />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByPlaceholderText("Search models...")).toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("switches directly between picker triggers without a dead dismiss click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ModelPicker value="" onChange={() => {}} models={MODELS} label="Primary model" />
        <ModelPicker value="" onChange={() => {}} models={MODELS} label="Fallback model" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /Primary model/i }));
    expect(await screen.findByPlaceholderText("Search models...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Fallback model/i }));

    expect(await screen.findByPlaceholderText("Search models...")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search models..."));
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

    // This model is also recommended (matches a curated seed by dedup key),
    // so its row renders in both the Recommended section and its provider
    // group. A router-served model (host ≠ lab) surfaces the host once as a
    // compact "via <host>" tag instead of a redundant "Host → Lab" subtitle.
    expect((await screen.findAllByText(/via\s+OpenRouter/i)).length).toBeGreaterThanOrEqual(1);
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
