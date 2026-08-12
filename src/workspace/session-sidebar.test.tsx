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

describe("SessionSidebar — motion", () => {
  it("staggers session rows by position instead of flashing the list in", () => {
    const { container } = render(<SessionSidebar title="Chats" items={baseItems} />);
    const rows = [...container.querySelectorAll("li")];
    expect(rows.length).toBe(2);
    rows.forEach((row, index) => {
      // One arrival for the whole package: the same class the rail's nav items
      // ride, indexed so the list unfolds rather than appearing at once.
      expect(row.className).toMatch(/\bagent-arrive\b/);
      expect(row.style.getPropertyValue("--stagger-index")).toBe(String(index));
    });
  });

  it("marks a running session's shimmer essential and leaves a resting row alone", () => {
    const { getByText } = render(
      <SessionSidebar
        title="Chats"
        items={[
          { id: "t1", title: "Working thread", status: "running" },
          { id: "t2", title: "Resting thread" },
        ]}
      />,
    );
    const working = getByText("Working thread");
    // The sweep is the only thing in the list saying an agent is mid-turn, so
    // reduced motion must not silence it.
    expect(working.className).toMatch(/\bagent-shimmer\b/);
    expect(working).toHaveAttribute("data-motion", "essential");

    const resting = getByText("Resting thread");
    expect(resting.className).not.toMatch(/\bagent-shimmer\b/);
    expect(resting).not.toHaveAttribute("data-motion");
  });

  it("keeps the session title as the row's accessible name while it shimmers", () => {
    // A status label here would REPLACE the title in the row's accessible name.
    const { getByRole } = render(
      <SessionSidebar title="Chats" items={[{ id: "t1", title: "Working thread", status: "running" }]} />,
    );
    expect(getByRole("button", { name: /Working thread/ })).toBeInTheDocument();
  });
});

describe("SessionSidebar — header alignment", () => {
  // SidebarLayout pins the rail header and the view header to h-14 "for
  // cross-view alignment". The panel header has to agree or the workspace shows
  // a stepped top edge: three panels, three different divider heights. This
  // shipped as py-1.5 (41px measured against the rail's 56px), and a consuming
  // app carried a CSS override that named the wrong element and never fixed it.
  it("pins the panel header to the same h-14 as the rail and view headers", () => {
    const { getByText } = render(<SessionSidebar title="Chats" items={baseItems} />);
    const header = getByText("Chats").closest("div.flex.h-14");
    expect(header).not.toBeNull();
    expect(header).toHaveClass("h-14");
    // Height IS the contract — padding cannot stand in for it, because the
    // header's content height varies with the optional subtitle.
    expect(header?.className).not.toMatch(/\bpy-/);
  });
});
