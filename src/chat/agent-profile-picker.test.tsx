import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentProfilePicker } from "./agent-profile-picker";

const PROFILES = [
  {
    id: "studio",
    name: "Studio",
    description: "Build with tools",
    builtin: true,
  },
  {
    id: "assistant",
    name: "Assistant",
    description: "Answer questions",
    builtin: true,
  },
];

describe("AgentProfilePicker", () => {
  it("keeps the standalone trigger treatment when no override is provided", () => {
    render(
      <AgentProfilePicker
        value="assistant"
        onChange={() => {}}
        profiles={PROFILES}
      />,
    );

    const trigger = screen.getByRole("button", { name: /agent profile/i });
    expect(trigger).toHaveClass("bg-surface-container", "shadow-sm");
    expect(trigger).not.toHaveClass("w-full", "bg-transparent", "shadow-none");
  });

  it("merges trigger overrides and keeps the chevron at the trailing edge", () => {
    render(
      <AgentProfilePicker
        value="assistant"
        onChange={() => {}}
        profiles={PROFILES}
        triggerClassName="w-full bg-transparent shadow-none"
      />,
    );

    const trigger = screen.getByRole("button", { name: /agent profile/i });
    expect(trigger).toHaveClass("w-full", "bg-transparent", "shadow-none");
    expect(trigger.querySelector("svg:last-child")).toHaveClass(
      "ml-auto",
      "shrink-0",
    );
  });

  it("bounds the standalone popover to the viewport", async () => {
    render(
      <AgentProfilePicker
        value="assistant"
        onChange={() => {}}
        profiles={PROFILES}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /agent profile/i }),
    );
    expect(screen.getByTestId("agent-profile-popover")).toHaveClass(
      "w-[min(320px,calc(100vw-2rem))]",
    );
  });

  it("keeps unlocked selection behavior unchanged", async () => {
    const onChange = vi.fn();
    render(
      <AgentProfilePicker
        value="studio"
        onChange={onChange}
        profiles={PROFILES}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Agent profile" });
    expect(trigger).toHaveTextContent("Studio");
    expect(trigger).not.toBeDisabled();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: /Assistant/ }));
    expect(onChange).toHaveBeenCalledWith("assistant");
  });

  it("explains an actionable lock without opening the profile menu", async () => {
    const onChange = vi.fn();
    const onNewChat = vi.fn();
    render(
      <AgentProfilePicker
        value="studio"
        onChange={onChange}
        profiles={PROFILES}
        locked
        onNewChat={onNewChat}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Agent profile (locked)",
    });
    expect(trigger).toHaveTextContent("Studio");
    expect(trigger).not.toBeDisabled();

    await userEvent.click(trigger);
    expect(
      screen.getByText("Profile fixed to Studio for this conversation."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "New chat to switch profile" }),
    );
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a locked picker without an action as an inert titled trigger", async () => {
    const onChange = vi.fn();
    render(
      <AgentProfilePicker
        value="studio"
        onChange={onChange}
        profiles={PROFILES}
        locked
        lockReason="Profile is pinned to this conversation"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Agent profile" });
    expect(trigger).toHaveTextContent("Studio");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute(
      "title",
      "Profile is pinned to this conversation",
    );

    await userEvent.click(trigger);
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
