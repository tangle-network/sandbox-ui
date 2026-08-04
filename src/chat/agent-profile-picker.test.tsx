import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AgentProfilePicker } from "./agent-profile-picker";

const PROFILES = [
  { id: "assistant", name: "Assistant", builtin: true },
  { id: "reviewer", name: "Reviewer" },
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
});
