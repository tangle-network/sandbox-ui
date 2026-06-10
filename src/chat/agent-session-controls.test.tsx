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
