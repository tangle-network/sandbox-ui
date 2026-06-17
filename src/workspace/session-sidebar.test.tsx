import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { SessionSidebar, type SessionSidebarItem } from "./session-sidebar";
import {
  dispatchSessionCreated,
  SESSION_CREATED_EVENT,
  type SessionOptimisticController,
} from "./session-optimistic";

const baseItems: SessionSidebarItem[] = [
  { id: "t1", title: "First thread", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "t2", title: "Second thread", updatedAt: "2026-01-02T00:00:00.000Z" },
];

describe("SessionSidebar — optimistic items", () => {
  it("optimistically prepends a thread on the shared create event", () => {
    const { getByText, queryByText } = render(
      <SessionSidebar title="Chats" items={baseItems} optimistic />,
    );
    expect(queryByText("Brand-new thread")).toBeNull();

    act(() => {
      dispatchSessionCreated({ id: "t3", title: "Brand-new thread" });
    });

    expect(getByText("Brand-new thread")).toBeInTheDocument();
  });

  it("ignores the create event when optimistic is off (backward compatible)", () => {
    const { queryByText } = render(
      <SessionSidebar title="Chats" items={baseItems} />,
    );
    act(() => {
      dispatchSessionCreated({ id: "t3", title: "Brand-new thread" });
    });
    expect(queryByText("Brand-new thread")).toBeNull();
  });

  it("optimistically renames via the imperative controller ref", () => {
    const ref = createRef<SessionOptimisticController | null>();
    const { getByText, queryByText } = render(
      <SessionSidebar title="Chats" items={baseItems} optimistic optimisticRef={ref} />,
    );
    expect(getByText("First thread")).toBeInTheDocument();

    act(() => {
      ref.current?.update("t1", { title: "Renamed thread" });
    });

    expect(getByText("Renamed thread")).toBeInTheDocument();
    expect(queryByText("First thread")).toBeNull();
  });

  it("optimistically removes via the imperative controller ref", () => {
    const ref = createRef<SessionOptimisticController | null>();
    const { queryByText } = render(
      <SessionSidebar title="Chats" items={baseItems} optimistic optimisticRef={ref} />,
    );
    expect(queryByText("Second thread")).toBeInTheDocument();

    act(() => {
      ref.current?.remove("t2");
    });

    expect(queryByText("Second thread")).toBeNull();
    expect(queryByText("First thread")).toBeInTheDocument();
  });

  it("supports a custom create-event name via the options object", () => {
    const { getByText, queryByText } = render(
      <SessionSidebar
        title="Chats"
        items={baseItems}
        optimistic={{ eventName: "creative-thread-created" }}
      />,
    );
    // Default event name does nothing for this instance.
    act(() => {
      dispatchSessionCreated({ id: "tX", title: "Default-name thread" }, SESSION_CREATED_EVENT);
    });
    expect(queryByText("Default-name thread")).toBeNull();

    act(() => {
      dispatchSessionCreated({ id: "t9", title: "Custom-name thread" }, "creative-thread-created");
    });
    expect(getByText("Custom-name thread")).toBeInTheDocument();
  });
});
