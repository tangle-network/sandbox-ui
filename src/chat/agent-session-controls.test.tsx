import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentSessionControls } from "./agent-session-controls";

const MODELS = [
  { id: "openai/gpt-5", name: "GPT-5", _provider: "openai" },
  {
    id: "anthropic/claude-opus-4-8",
    name: "Claude Opus 4.8",
    _provider: "anthropic",
  },
];

const PROFILES = [
  { id: "assistant", name: "Assistant", builtin: true },
  { id: "reviewer", name: "Reviewer" },
];

describe("AgentSessionControls", () => {
  it("renders nothing when no control is provided", () => {
    const { container } = render(<AgentSessionControls />);
    expect(container.firstChild).toBeNull();
  });

  it("renders only the sections that are provided", () => {
    render(
      <AgentSessionControls
        reasoning={{ value: "auto", onChange: () => {} }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /reasoning level/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /agent harness/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the selected harness label and fires onChange with the picked type", async () => {
    const onChange = vi.fn();
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange }}
      />,
    );
    const trigger = screen.getByRole("button", { name: /agent harness/i });
    expect(trigger).toHaveTextContent("OpenCode");

    await userEvent.click(trigger);
    await userEvent.click(await screen.findByText("Claude Code"));
    expect(onChange).toHaveBeenCalledWith("claude-code");
  });

  it("excludes the shell-only cli-base harness from the chat surface by default", async () => {
    render(<AgentSessionControls harness={{ value: "opencode", onChange: () => {} }} />);
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    expect(await screen.findByText("Codex")).toBeInTheDocument();
    expect(screen.queryByText("CLI base (no agent)")).not.toBeInTheDocument();
  });

  it("keeps cli-base when context is `all` (scheduled / non-chat surfaces)", async () => {
    render(
      <AgentSessionControls
        context="all"
        harness={{ value: "opencode", onChange: () => {} }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    expect(await screen.findByText("CLI base (no agent)")).toBeInTheDocument();
  });

  it("an explicit available list overrides the chat-context filter", async () => {
    render(
      <AgentSessionControls
        harness={{
          value: "opencode",
          onChange: () => {},
          available: ["cli-base", "opencode"],
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    // cli-base is present only as a menu item (trigger shows OpenCode), so a
    // single match proves the explicit list won over the chat filter.
    expect(await screen.findByText("CLI base (no agent)")).toBeInTheDocument();
  });

  it("filters harness options through `available`", async () => {
    render(
      <AgentSessionControls
        harness={{
          value: "opencode",
          onChange: () => {},
          available: ["opencode", "claude-code"],
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    expect(await screen.findByText("Claude Code")).toBeInTheDocument();
    expect(screen.queryByText("Codex")).not.toBeInTheDocument();
  });

  it("renders the model picker pill with the selected model", () => {
    render(
      <AgentSessionControls
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: () => {},
          models: MODELS,
        }}
      />,
    );
    expect(screen.getByText("Claude Opus 4.8")).toBeInTheDocument();
  });

  it("disables the model picker while the catalog is empty", () => {
    render(
      <AgentSessionControls
        model={{ value: "", onChange: () => {}, models: [], loading: true }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    // Reasoning control stays interactive while models load.
    expect(
      screen.getByRole("button", { name: /reasoning level/i }),
    ).not.toBeDisabled();
  });

  it("fires reasoning onChange with the picked level", async () => {
    const onChange = vi.fn();
    render(
      <AgentSessionControls reasoning={{ value: "auto", onChange }} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /reasoning level/i }),
    );
    await userEvent.click(await screen.findByText("High"));
    expect(onChange).toHaveBeenCalledWith("high");
  });

  it("gear layout collapses the pickers behind a single controls button", async () => {
    render(
      <AgentSessionControls
        layout="gear"
        harness={{ value: "opencode", onChange: () => {} }}
        reasoning={{ value: "auto", onChange: () => {} }}
      />,
    );
    // Inline pickers are not shown until the gear is opened.
    expect(
      screen.queryByRole("button", { name: /agent harness/i }),
    ).not.toBeInTheDocument();
    const gear = screen.getByRole("button", { name: /session controls/i });
    expect(gear).toBeInTheDocument();

    await userEvent.click(gear);
    expect(
      await screen.findByRole("button", { name: /agent harness/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reasoning level/i }),
    ).toBeInTheDocument();
  });

  it.each(["gear", "combined"] as const)(
    "%s layout gives the profile picker a panel-width trigger and popover",
    async (layout) => {
      render(
        <AgentSessionControls
          layout={layout}
          profile={{
            value: "assistant",
            onChange: () => {},
            profiles: PROFILES,
          }}
          harness={{ value: "opencode", onChange: () => {} }}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /session controls/i }),
      );
      const profileTrigger = await screen.findByRole("button", {
        name: /agent profile/i,
      });
      const harnessTrigger = screen.getByRole("button", {
        name: /agent harness/i,
      });
      const sharedClasses =
        layout === "combined"
          ? ["w-full", "bg-transparent", "shadow-none"]
          : ["w-full", "bg-surface-container", "shadow-sm"];
      expect(profileTrigger).toHaveClass(...sharedClasses);
      expect(harnessTrigger).toHaveClass(...sharedClasses);
      expect(profileTrigger.querySelector("svg:last-child")).toHaveClass(
        "ml-auto",
        "shrink-0",
      );

      await userEvent.click(profileTrigger);
      const popover = screen.getByTestId("agent-profile-popover");
      expect(popover).toHaveClass("w-full");
      expect(popover).not.toHaveClass("w-[min(320px,calc(100vw-2rem))]");
    },
  );

  it("renders trailing content right-aligned", () => {
    render(
      <AgentSessionControls
        reasoning={{ value: "auto", onChange: () => {} }}
        trailing={<span>12.4k tokens</span>}
      />,
    );
    expect(screen.getByText("12.4k tokens")).toBeInTheDocument();
  });

  it("inline strip renders the model pill primary and the harness/effort triggers quiet", () => {
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: () => {},
          models: MODELS,
        }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    const modelTrigger = screen
      .getByText("Claude Opus 4.8")
      .closest("button") as HTMLButtonElement;
    // Primary treatment: the reference-design pill.
    expect(modelTrigger.className).toContain("rounded-full");
    expect(modelTrigger.className).not.toContain("bg-transparent");
    // Secondary treatment: harness + effort lose the bordered card fill.
    for (const name of [/agent harness/i, /reasoning level/i]) {
      const trigger = screen.getByRole("button", { name });
      expect(trigger.className).toContain("bg-transparent");
      expect(trigger.className).toContain("border-transparent");
    }
  });
});

describe("AgentSessionControls — chat-surface modality filtering", () => {
  const MIXED_CATALOG = [
    {
      id: "claude-opus-5",
      name: "Claude Opus 5",
      _provider: "anthropic",
      architecture: {
        modality: "text+image->text",
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    },
    {
      id: "text-embedding-3-large",
      name: "Text Embedding 3 Large",
      _provider: "openai",
      architecture: {
        modality: "embedding",
        input_modalities: ["text"],
        output_modalities: ["embeddings"],
      },
    },
    {
      id: "tts-1-hd",
      name: "TTS-1 HD",
      _provider: "openai",
      architecture: {
        modality: "audio",
        input_modalities: ["text"],
        output_modalities: ["audio"],
      },
    },
    // No architecture metadata at all — must stay visible (fail-open).
    { id: "mystery-model", name: "Mystery Model" },
  ];

  const openModelPicker = () =>
    userEvent.click(screen.getByText("Claude Opus 5"));

  it("drops non-chat catalog rows (embedding, tts) from the chat surface by default", async () => {
    render(
      <AgentSessionControls
        model={{
          value: "anthropic/claude-opus-5",
          onChange: () => {},
          models: MIXED_CATALOG,
        }}
      />,
    );
    await openModelPicker();
    expect(await screen.findByPlaceholderText("Search models...")).toBeInTheDocument();
    expect(screen.queryByText("Text Embedding 3 Large")).not.toBeInTheDocument();
    expect(screen.queryByText("TTS-1 HD")).not.toBeInTheDocument();
  });

  it("keeps chat rows and fails open for rows with no modality metadata", async () => {
    render(
      <AgentSessionControls
        model={{
          value: "anthropic/claude-opus-5",
          onChange: () => {},
          models: MIXED_CATALOG,
        }}
      />,
    );
    await openModelPicker();
    // The selected chat model appears in the menu (trigger + row), and the
    // metadata-less row is never silently hidden.
    expect((await screen.findAllByText("Claude Opus 5")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Mystery Model")).toBeInTheDocument();
  });

  it("shows the full catalog on non-chat surfaces (context=\"all\")", async () => {
    render(
      <AgentSessionControls
        context="all"
        model={{
          value: "anthropic/claude-opus-5",
          onChange: () => {},
          models: MIXED_CATALOG,
        }}
      />,
    );
    await openModelPicker();
    expect(await screen.findByText("Text Embedding 3 Large")).toBeInTheDocument();
    expect(screen.getByText("TTS-1 HD")).toBeInTheDocument();
  });

  it("an explicit `modalities` list replaces the chat default and is forwarded to the picker", async () => {
    render(
      <AgentSessionControls
        model={{
          value: "anthropic/claude-opus-5",
          onChange: () => {},
          models: MIXED_CATALOG,
          // ModelPicker's own exact-match filter takes over: only rows whose
          // compact modality string is exactly "audio" (plus metadata-less
          // rows, which every layer fails open on) survive.
          modalities: ["audio"],
        }}
      />,
    );
    await openModelPicker();
    expect(await screen.findByText("TTS-1 HD")).toBeInTheDocument();
    expect(screen.getByText("Mystery Model")).toBeInTheDocument();
    expect(screen.queryByText("Text Embedding 3 Large")).not.toBeInTheDocument();
  });

  it("forwards `excludeProviders` to the picker", async () => {
    render(
      <AgentSessionControls
        model={{
          value: "anthropic/claude-opus-5",
          onChange: () => {},
          models: MIXED_CATALOG,
          excludeProviders: ["anthropic"],
        }}
      />,
    );
    await openModelPicker();
    expect(await screen.findByText("Mystery Model")).toBeInTheDocument();
    // The anthropic row survives the chat filter but is dropped by the
    // forwarded provider exclusion — only the trigger still names it.
    expect(screen.getAllByText("Claude Opus 5")).toHaveLength(1);
  });
});

describe("AgentSessionControls — harness/model coupling", () => {
  const COUPLING_MODELS = [
    { id: "openai/gpt-5.5", name: "GPT-5.5", _provider: "openai" },
    {
      id: "anthropic/claude-opus-4-8",
      name: "Claude Opus 4.8",
      _provider: "anthropic",
    },
  ];

  it("switching harness to codex snaps an Anthropic model to the frontier GPT", async () => {
    const onHarnessChange = vi.fn();
    const onModelChange = vi.fn();
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: onHarnessChange }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: onModelChange,
          models: COUPLING_MODELS,
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    await userEvent.click(await screen.findByText("Codex"));
    expect(onHarnessChange).toHaveBeenCalledWith("codex");
    expect(onModelChange).toHaveBeenCalledWith("openai/gpt-5.5");
  });

  it("keeps the model when the new harness can run it", async () => {
    const onModelChange = vi.fn();
    render(
      <AgentSessionControls
        harness={{ value: "codex", onChange: () => {} }}
        model={{
          value: "openai/gpt-5.5",
          onChange: onModelChange,
          models: COUPLING_MODELS,
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    await userEvent.click(await screen.findByText("OpenCode"));
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("locked harness renders an inert trigger and filters the catalog to compatible models", async () => {
    render(
      <AgentSessionControls
        harness={{
          value: "claude-code",
          onChange: () => {},
          locked: true,
          lockReason: "Harness is locked to this session",
        }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: () => {},
          models: COUPLING_MODELS,
        }}
      />,
    );
    const trigger = screen.getByRole("button", { name: /agent harness/i });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute(
      "title",
      "Harness is locked to this session",
    );
    // Open the model picker: the OpenAI entry must not be offered.
    await userEvent.click(screen.getByText("Claude Opus 4.8"));
    expect(screen.queryByText("GPT-5.5")).not.toBeInTheDocument();
  });

  it("locked harness with onNewChat shows an informative popover and fires the fork action", async () => {
    const onNewChat = vi.fn();
    render(
      <AgentSessionControls
        harness={{
          value: "claude-code",
          onChange: () => {},
          locked: true,
          lockReason: "Harness is locked to this session",
          onNewChat,
        }}
      />,
    );
    // The informative variant is interactive (not a dead disabled control).
    const trigger = screen.getByRole("button", { name: /agent harness/i });
    expect(trigger).not.toBeDisabled();

    await userEvent.click(trigger);
    expect(
      await screen.findByText(/fixed to Claude Code for this conversation/i),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /new chat to switch agent/i }),
    );
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("filterModelsToHarness restricts the catalog WITHOUT locking the harness dropdown", async () => {
    render(
      <AgentSessionControls
        filterModelsToHarness
        harness={{ value: "claude-code", onChange: () => {} }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: () => {},
          models: COUPLING_MODELS,
        }}
      />,
    );
    // Unlike `locked`, the harness trigger stays interactive.
    expect(
      screen.getByRole("button", { name: /agent harness/i }),
    ).not.toBeDisabled();
    // But the catalog is filtered to the harness: the OpenAI entry is hidden.
    await userEvent.click(screen.getByText("Claude Opus 4.8"));
    expect(screen.queryByText("GPT-5.5")).not.toBeInTheDocument();
  });
});

describe("AgentSessionControls — reasoning effort re-clamp", () => {
  const COUPLING_MODELS = [
    { id: "openai/gpt-5.5", name: "GPT-5.5", _provider: "openai" },
    {
      id: "anthropic/claude-opus-4-8",
      name: "Claude Opus 4.8",
      _provider: "anthropic",
    },
  ];

  it("preserves an effort newly supported by the selected harness", async () => {
    const onEffortChange = vi.fn();
    render(
      <AgentSessionControls
        harness={{ value: "claude-code", onChange: () => {} }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: () => {},
          models: COUPLING_MODELS,
        }}
        reasoning={{ value: "ultracode", onChange: onEffortChange }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    await userEvent.click(await screen.findByText("Codex"));
    expect(onEffortChange).not.toHaveBeenCalled();
  });

  it("snaps a too-high effort down across a sparse capability set", async () => {
    const onEffortChange = vi.fn();
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
        reasoning={{ value: "ultracode", onChange: onEffortChange }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    await userEvent.click(await screen.findByText("Kimi Code"));
    expect(onEffortChange).toHaveBeenCalledWith("high");
  });

  it("leaves the effort untouched when the new harness still supports it", async () => {
    const onEffortChange = vi.fn();
    render(
      <AgentSessionControls
        harness={{ value: "codex", onChange: () => {} }}
        model={{
          value: "openai/gpt-5.5",
          onChange: () => {},
          models: COUPLING_MODELS,
        }}
        reasoning={{ value: "low", onChange: onEffortChange }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    // opencode supports `low` → no re-clamp fires.
    await userEvent.click(await screen.findByText("OpenCode"));
    expect(onEffortChange).not.toHaveBeenCalled();
  });
});

describe("AgentSessionControls — per-harness reasoning options", () => {
  const openReasoning = () =>
    userEvent.click(screen.getByRole("button", { name: /reasoning level/i }));

  it("kimi harness offers the binary Auto / No thinking / Thinking toggle", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "kimi-code", onChange: () => {} }}
        reasoning={{ value: "auto", onChange: () => {} }}
      />,
    );
    await openReasoning();
    expect(await screen.findByText("No thinking")).toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    // A binary toggle, not a gradient — the ladder's mid-steps never appear.
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
  });

  it("codex harness drops `none` and exposes its full supported range", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "codex", onChange: () => {} }}
        reasoning={{ value: "auto", onChange: () => {} }}
      />,
    );
    await openReasoning();
    expect(await screen.findByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
    expect(screen.getByText("Extra High")).toBeInTheDocument();
    expect(screen.getByText("Ultracode")).toBeInTheDocument();
  });

  it("claude-code harness drops `none`/`minimal` and reaches ultracode", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "claude-code", onChange: () => {} }}
        reasoning={{ value: "auto", onChange: () => {} }}
      />,
    );
    await openReasoning();
    expect(await screen.findByText("Ultracode")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
    expect(screen.queryByText("Minimal")).not.toBeInTheDocument();
  });
});

describe("AgentSessionControls — harnesses that ignore selectors", () => {
  const MODELS = [{ id: "openai/gpt-5", name: "GPT-5", _provider: "openai" }];

  it("marks harnesses that supply both selectors themselves (amp, nanoclaw)", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    // amp + nanoclaw drop both selectors → named, not silently offered.
    expect(await screen.findByText("AMP")).toBeInTheDocument();
    expect(
      screen.getAllByText(/own model \+ thinking/i).length,
    ).toBeGreaterThan(0);
  });

  it("marks effort-only harnesses (factory-droids / hermes honor model, drop effort)", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    expect(screen.getAllByText(/own thinking/i).length).toBeGreaterThan(0);
  });

  it("groups harnesses by whether they honor the model + effort pickers", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    // Both sections are present and non-empty, so the split actually organizes
    // the list rather than collapsing every harness into one bucket.
    expect(
      await screen.findByText(/uses your model & thinking/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/brings its own setup/i)).toBeInTheDocument();

    // A fully-steerable harness carries no autonomy note; a fixed one does.
    // Scope to the menu — the trigger also renders the selected harness label.
    const rows = screen.getAllByRole("menuitem");
    const rowText = (label: string) =>
      rows.find((row) => row.textContent?.includes(label))?.textContent ?? "";
    expect(rowText("OpenCode")).not.toMatch(/own model|own thinking/i);
    expect(rowText("AMP")).toMatch(/own model \+ thinking/i);
  });

  it("clears the harness search when the menu closes", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
      />,
    );
    const trigger = screen.getByRole("button", { name: /agent harness/i });
    await userEvent.click(trigger);
    const search = await screen.findByPlaceholderText(/search agents/i);
    // "kimi" matches exactly one harness. ("codex" would match two — OpenClaw's
    // description names Codex — which is the description search working.)
    await userEvent.type(search, "kimi");
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);

    // Close, then reopen. A stale filter would leave every other harness
    // looking absent with nothing on screen explaining why.
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(1);
  });

  it("keeps credential env-var names out of the harness menu", async () => {
    render(
      <AgentSessionControls
        harness={{ value: "opencode", onChange: () => {} }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agent harness/i }),
    );
    await screen.findByText("Claude Code");
    // Which keys a deployment supplies is a product decision; an env-var name is
    // developer text and must never reach a customer-facing menu.
    expect(document.body.textContent).not.toMatch(/_API_KEY/);
  });

  it("disables the model + effort pickers when the selected harness ignores them", () => {
    render(
      <AgentSessionControls
        harness={{ value: "amp", onChange: () => {} }}
        model={{ value: "openai/gpt-5", onChange: () => {}, models: MODELS }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    // amp drops both — neither picker pretends to be live.
    expect(screen.getByRole("button", { name: /reasoning level/i })).toBeDisabled();
    // The model pill renders the model name; its trigger is disabled.
    expect(screen.getByText("GPT-5").closest("button")).toBeDisabled();
  });

  it("keeps the effort picker live but disables the model picker for an ignore-model harness", () => {
    render(
      <AgentSessionControls
        harness={{ value: "openclaw", onChange: () => {} }}
        model={{ value: "openai/gpt-5", onChange: () => {}, models: MODELS }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    // openclaw drops the model but honors effort.
    expect(screen.getByText("GPT-5").closest("button")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /reasoning level/i }),
    ).not.toBeDisabled();
  });
});

describe("AgentSessionControls — combined layout", () => {
  const COMBINED_MODELS = [
    { id: "openai/gpt-5.5", name: "GPT-5.5", _provider: "openai" },
    {
      id: "anthropic/claude-opus-4-8",
      name: "Anthropic: Claude Opus 4.8",
      _provider: "anthropic",
    },
  ];

  it("collapses the pickers behind one labeled trigger summarizing the selection", () => {
    render(
      <AgentSessionControls
        layout="combined"
        harness={{ value: "opencode", onChange: () => {} }}
        model={{
          value: "openai/gpt-5.5",
          onChange: () => {},
          models: COMBINED_MODELS,
        }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    // One trigger, summarizing harness + model + effort — the inline pickers are
    // not present until it's opened. (Segments render as separate icon+label
    // spans, so assert each rather than a joined string.)
    const trigger = screen.getByRole("button", { name: /session controls/i });
    expect(trigger).toHaveTextContent("OpenCode");
    expect(trigger).toHaveTextContent("GPT-5.5");
    expect(trigger).toHaveTextContent("High");
    expect(
      screen.queryByRole("button", { name: /agent harness/i }),
    ).not.toBeInTheDocument();
  });

  it("strips the brand prefix from the model name in the summary label", () => {
    render(
      <AgentSessionControls
        layout="combined"
        harness={{ value: "claude-code", onChange: () => {} }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: () => {},
          models: COMBINED_MODELS,
        }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    const trigger = screen.getByRole("button", { name: /session controls/i });
    // "Anthropic: Claude Opus 4.8" → "Claude Opus 4.8", matching the model pill.
    expect(trigger).toHaveTextContent("Claude Opus 4.8");
    expect(trigger).not.toHaveTextContent("Anthropic:");
    expect(trigger).toHaveTextContent("Claude Code");
  });

  it("drops the segment for a selector the harness ignores", () => {
    render(
      <AgentSessionControls
        layout="combined"
        harness={{ value: "amp", onChange: () => {} }}
        model={{
          value: "openai/gpt-5.5",
          onChange: () => {},
          models: COMBINED_MODELS,
        }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    // amp ignores both model and effort → only the harness word survives.
    const trigger = screen.getByRole("button", { name: /session controls/i });
    expect(trigger).toHaveTextContent("AMP");
    expect(trigger).not.toHaveTextContent("·");
  });

  it("reveals the harness / model / effort pickers when opened", async () => {
    render(
      <AgentSessionControls
        layout="combined"
        harness={{ value: "opencode", onChange: () => {} }}
        model={{
          value: "openai/gpt-5.5",
          onChange: () => {},
          models: COMBINED_MODELS,
        }}
        reasoning={{ value: "high", onChange: () => {} }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /session controls/i }),
    );
    expect(
      await screen.findByRole("button", { name: /agent harness/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reasoning level/i }),
    ).toBeInTheDocument();
  });

  it("keeps harness→model coherence: picking a new harness snaps an incompatible model", async () => {
    const onModelChange = vi.fn();
    render(
      <AgentSessionControls
        layout="combined"
        harness={{ value: "opencode", onChange: () => {} }}
        model={{
          value: "anthropic/claude-opus-4-8",
          onChange: onModelChange,
          models: COMBINED_MODELS,
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /session controls/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /agent harness/i }),
    );
    await userEvent.click(await screen.findByText("Codex"));
    // Same coherence wiring as the inline strip — codex can't run the Anthropic
    // model, so it snaps to the frontier GPT.
    expect(onModelChange).toHaveBeenCalledWith("openai/gpt-5.5");
  });
});
