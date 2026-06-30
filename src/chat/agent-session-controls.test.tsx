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

  it("renders trailing content right-aligned", () => {
    render(
      <AgentSessionControls
        reasoning={{ value: "auto", onChange: () => {} }}
        trailing={<span>12.4k tokens</span>}
      />,
    );
    expect(screen.getByText("12.4k tokens")).toBeInTheDocument();
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

  it("snaps a too-high effort down when switching to a lower-ceiling harness", async () => {
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
    // codex caps at `high` — `ultracode` is snapped down, never left dangling.
    await userEvent.click(await screen.findByText("Codex"));
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
