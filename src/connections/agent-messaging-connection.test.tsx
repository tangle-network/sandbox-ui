import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgentMessagingConnection } from "./agent-messaging-connection";

const readyRoute = {
  status: "ready",
  channelLabel: "app messages",
  destinationLabel: "Member conversation",
} as const;
const enrolled = {
  status: "enrolled",
  target: { agentLabel: "Research assistant", workspaceLabel: "Project A" },
} as const;

describe("AgentMessagingConnection", () => {
  it("does not expose a destination or message action before authorized enrollment", () => {
    const onEnroll = vi.fn();
    render(
      <AgentMessagingConnection
        enrollment={{ status: "eligible" }}
        route={readyRoute}
        onEnroll={onEnroll}
        onOpenMessages={vi.fn()}
      />,
    );
    expect(screen.getByText("Connect your agent to use messaging.")).toBeInTheDocument();
    expect(screen.queryByText("Member conversation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open messages" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect agent" }));
    expect(onEnroll).toHaveBeenCalledOnce();
    expect(screen.queryByText("Ready on")).not.toBeInTheDocument();
  });

  it("waits for the host's enrolled state before showing a ready conversation", () => {
    const onOpenMessages = vi.fn();
    const { rerender } = render(
      <AgentMessagingConnection enrollment={{ status: "eligible" }} route={readyRoute} onEnroll={() => {}} onOpenMessages={onOpenMessages} />,
    );
    rerender(
      <AgentMessagingConnection enrollment={enrolled} route={readyRoute} onEnroll={() => {}} onOpenMessages={onOpenMessages} />,
    );
    expect(screen.getByText("Research assistant")).toBeInTheDocument();
    expect(screen.getByText("Member conversation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open messages" }));
    expect(onOpenMessages).toHaveBeenCalledOnce();
  });

  it("does not present messaging as ready when the shared route is pending, unavailable, or forbidden", () => {
    const onOpenMessages = vi.fn();
    const { rerender } = render(
      <AgentMessagingConnection enrollment={enrolled} route={{ status: "pending" }} onEnroll={() => {}} onOpenMessages={onOpenMessages} />,
    );
    expect(screen.getByText("Setting up messaging…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open messages" })).not.toBeInTheDocument();
    rerender(
      <AgentMessagingConnection enrollment={enrolled} route={{ status: "unavailable" }} onEnroll={() => {}} onOpenMessages={onOpenMessages} />,
    );
    expect(screen.getByText("Messaging is unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open messages" })).not.toBeInTheDocument();
    rerender(
      <AgentMessagingConnection enrollment={enrolled} route={{ status: "forbidden" }} onEnroll={() => {}} onOpenMessages={onOpenMessages} />,
    );
    expect(screen.getByText("You cannot use messaging in this app.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open messages" })).not.toBeInTheDocument();
  });

  it("blocks enrollment when access is checking, forbidden, or failed", () => {
    const onEnroll = vi.fn();
    const { rerender } = render(
      <AgentMessagingConnection enrollment={{ status: "checking" }} route={readyRoute} onEnroll={onEnroll} />,
    );
    expect(screen.queryByRole("button", { name: "Connect agent" })).not.toBeInTheDocument();
    rerender(<AgentMessagingConnection enrollment={{ status: "forbidden" }} route={readyRoute} onEnroll={onEnroll} />);
    expect(screen.getByText("You cannot connect this agent.")).toBeInTheDocument();
    expect(screen.getByText("Agent connection is unconfirmed.")).toBeInTheDocument();
    rerender(<AgentMessagingConnection enrollment={{ status: "error" }} route={readyRoute} onEnroll={onEnroll} />);
    expect(screen.getByText("Could not check agent access.")).toBeInTheDocument();
    expect(onEnroll).not.toHaveBeenCalled();
  });

  it("locks the enrollment action while the host request runs and keeps rejected errors safe", async () => {
    let reject: (reason?: unknown) => void = () => {};
    const onEnroll = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    render(<AgentMessagingConnection enrollment={{ status: "eligible" }} route={readyRoute} onEnroll={onEnroll} />);
    const action = screen.getByRole("button", { name: "Connect agent" });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(onEnroll).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Connecting agent…" })).toBeDisabled();
    reject(new Error("private server detail"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not connect the agent. Try again."));
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
  });

  it("offers a read retry without enrolling when a host check fails", () => {
    const onRetry = vi.fn();
    const onEnroll = vi.fn();
    render(
      <AgentMessagingConnection
        enrollment={{ status: "error" }}
        route={{ status: "error" }}
        onEnroll={onEnroll}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onEnroll).not.toHaveBeenCalled();
  });
});
