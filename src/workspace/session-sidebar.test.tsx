import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import {
  registerActiveSession,
  resetActiveSessions,
  setActiveSessionRunning,
} from "@tangle-network/ui/stores";
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

describe("SessionSidebar — quiet variant", () => {
  afterEach(() => {
    resetActiveSessions();
  });

  it("renders no icon-in-a-box header and no running chip, only the new-chat text button", () => {
    registerActiveSession({ sessionId: "t1", title: "First thread" });
    setActiveSessionRunning("t1", true);

    const branded = render(
      <SessionSidebar title="Chats" items={baseItems} onCreate={() => {}} createLabel="New chat" />,
    );
    // The default header is the branded one: an icon box beside the title and
    // a chip counting the running sessions.
    expect(branded.container.querySelector("div.h-7.w-7")).not.toBeNull();
    expect(branded.getByText("1")).toBeInTheDocument();
    branded.unmount();

    const quiet = render(
      <SessionSidebar
        title="Chats"
        items={baseItems}
        onCreate={() => {}}
        createLabel="New chat"
        variant="quiet"
      />,
    );
    expect(quiet.container.querySelector("div.h-7.w-7")).toBeNull();
    expect(quiet.queryByText("1")).toBeNull();
    const create = quiet.getByRole("button", { name: "New chat" });
    expect(create.className).toMatch(/\btext-sm\b/);
    expect(create.className).toMatch(/\btext-muted-foreground\b/);
    expect(create.className).toMatch(/\bhover:text-foreground\b/);
    expect(create.className).not.toMatch(/\bborder\b/);
  });

  it("renders the collapse button only when onCollapse is given", () => {
    const onCollapse = vi.fn();
    const { getByRole, rerender, queryByRole } = render(
      <SessionSidebar title="Chats" items={baseItems} variant="quiet" onCollapse={onCollapse} />,
    );
    fireEvent.click(getByRole("button", { name: "Hide chats" }));
    expect(onCollapse).toHaveBeenCalledTimes(1);

    rerender(<SessionSidebar title="Chats" items={baseItems} variant="quiet" />);
    expect(queryByRole("button", { name: "Hide chats" })).toBeNull();
  });

  it("fills the selected row with a surface, not the accent, and hides neutral badges", () => {
    const items: SessionSidebarItem[] = [
      { id: "t1", title: "Pinned thread", isPinned: true },
      { id: "t2", title: "Flagged thread", badges: [{ id: "b", label: "Needs attention", tone: "warning" }] },
    ];
    const { getByText, queryByText } = render(
      <SessionSidebar title="Chats" items={items} currentItemId="t1" variant="quiet" />,
    );
    const row = getByText("Pinned thread").closest("li")?.firstElementChild as HTMLElement;
    expect(row.className).toMatch(/\bbg-surface-container-high\b/);
    expect(row.className).toMatch(/\brounded-lg\b/);
    expect(row.className).toMatch(/\bpy-2\b/);
    expect(row.className).toMatch(/\bpl-2\b/);
    expect(row.className).toMatch(/\bpr-3\b/);
    expect(row.className).not.toMatch(/\bbg-accent\b/);
    expect(row.className).not.toMatch(/\bborder/);
    expect(getByText("Pinned thread").className).toMatch(/\bleading-5\b/);
    // The neutral "Pinned" badge is noise in the rail; a warning badge still reads.
    expect(queryByText("Pinned")).toBeNull();
    expect(getByText("Needs attention")).toBeInTheDocument();
  });

  it("keeps the default variant's accent selection and its neutral badge", () => {
    const { getByText } = render(
      <SessionSidebar
        title="Chats"
        items={[{ id: "t1", title: "Pinned thread", isPinned: true }]}
        currentItemId="t1"
      />,
    );
    const row = getByText("Pinned thread").closest("li")?.firstElementChild as HTMLElement;
    expect(row.className).toMatch(/\bbg-accent\b/);
    expect(getByText("Pinned")).toBeInTheDocument();
  });

  it("renders search as a borderless field", () => {
    const { getByLabelText } = render(
      <SessionSidebar title="Chats" items={baseItems} variant="quiet" />,
    );
    const input = getByLabelText("Search sessions");
    expect(input.className).toMatch(/\bborder-0\b/);
    expect(input.className).toMatch(/\bbg-transparent\b/);
  });
});

describe("SessionSidebar — icon slot", () => {
  it("renders the icon in a 16×20 slot with the status dot as a corner badge", () => {
    const { getByTestId, getByText } = render(
      <SessionSidebar
        title="Chats"
        items={[{ id: "t1", title: "Codex thread", status: "running", icon: <svg data-testid="glyph" /> }]}
      />,
    );
    const slot = getByTestId("glyph").parentElement as HTMLElement;
    expect(slot.className).toMatch(/\bh-5\b/);
    expect(slot.className).toMatch(/\bw-4\b/);
    expect(slot.className).toMatch(/\brelative\b/);
    const dot = slot.querySelector("span.absolute") as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.className).toMatch(/\bh-1\.5\b/);
    expect(dot.className).toMatch(/\bw-1\.5\b/);
    expect(dot.className).toMatch(/\brounded-full\b/);
    expect(dot.className).toMatch(/status-running/);
    // The slot precedes the title inside the row button.
    const button = getByText("Codex thread").closest("button") as HTMLElement;
    expect(button.firstElementChild).toBe(slot);
  });

  it("keeps the leading dot when no icon is given", () => {
    const { getByText } = render(
      <SessionSidebar title="Chats" items={[{ id: "t1", title: "Plain thread", status: "error" }]} />,
    );
    const button = getByText("Plain thread").closest("button") as HTMLElement;
    const dot = button.firstElementChild as HTMLElement;
    expect(dot.className).toMatch(/\bh-1\.5\b/);
    expect(dot.className).toMatch(/\bshrink-0\b/);
    expect(dot.className).not.toMatch(/\babsolute\b/);
    expect(button.querySelector("span.absolute")).toBeNull();
  });
});

describe("SessionSidebar — meta line", () => {
  it("renders meta as a muted 12px second line", () => {
    const { getByText } = render(
      <SessionSidebar title="Chats" items={[{ id: "t1", title: "Codex thread", meta: "Codex · 2m" }]} />,
    );
    const meta = getByText("Codex · 2m");
    expect(meta.className).toMatch(/\btext-xs\b/);
    expect(meta.className).toMatch(/\btext-muted-foreground\b/);
  });

  it("renders a relative age from updatedAt only when showUpdatedAt is set and meta is absent", () => {
    const updatedAt = new Date(Date.now() - 3 * 60 * 60_000);
    const items: SessionSidebarItem[] = [
      { id: "t1", title: "Aged thread", updatedAt },
      { id: "t2", title: "Labelled thread", updatedAt, meta: "Claude Code · 3h" },
    ];
    const hidden = render(<SessionSidebar title="Chats" items={items} />);
    expect(hidden.container.querySelector("time")).toBeNull();
    hidden.unmount();

    const { container, getByText } = render(
      <SessionSidebar title="Chats" items={items} showUpdatedAt />,
    );
    const times = container.querySelectorAll("time");
    expect(times).toHaveLength(1);
    expect(times[0]).toHaveTextContent("3h");
    expect(times[0]).toHaveAttribute("dateTime", updatedAt.toISOString());
    expect(getByText("Claude Code · 3h")).toBeInTheDocument();
  });
});

describe("SessionSidebar — groupBy status", () => {
  const grouped: SessionSidebarItem[] = [
    { id: "done-1", title: "Done thread", updatedAt: "2026-01-05T00:00:00.000Z" },
    { id: "run-1", title: "Working thread", status: "running", updatedAt: "2026-01-04T00:00:00.000Z" },
    { id: "err-1", title: "Failed thread", status: "error", updatedAt: "2026-01-03T00:00:00.000Z" },
    { id: "ask-1", title: "Waiting thread", status: "attention-needed", updatedAt: "2026-01-02T00:00:00.000Z" },
    { id: "done-2", title: "Older done thread", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "done-0", title: "Pinned done thread", isPinned: true, updatedAt: "2025-12-01T00:00:00.000Z" },
  ];

  afterEach(() => {
    resetActiveSessions();
  });

  it("orders groups needs-input, failed, working, done and labels them", () => {
    const { container } = render(
      <SessionSidebar title="Chats" items={grouped} groupBy="status" />,
    );
    const labels = [...container.querySelectorAll("nav section > div")].map((node) => node.textContent);
    expect(labels).toEqual(["Needs input", "Failed", "Working", "Done"]);

    const titles = [...container.querySelectorAll("li button > div > div:first-child")].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual([
      "Waiting thread",
      "Failed thread",
      "Working thread",
      // Within a group the existing sort holds: pinned first, then newest.
      "Pinned done thread",
      "Done thread",
      "Older done thread",
    ]);
    // One stagger across the whole list, not one per group.
    const indices = [...container.querySelectorAll("li")].map((row) => row.style.getPropertyValue("--stagger-index"));
    expect(indices).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("renders no labels while only one group has items", () => {
    const { container, queryByText } = render(
      <SessionSidebar
        title="Chats"
        items={grouped.filter((item) => item.id.startsWith("done"))}
        groupBy="status"
      />,
    );
    expect(container.querySelector("nav section")).toBeNull();
    expect(queryByText("Done")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("takes the group from the store record when one exists for the id", () => {
    registerActiveSession({ sessionId: "done-1", title: "Done thread" });
    setActiveSessionRunning("done-1", true);
    const { container } = render(
      <SessionSidebar title="Chats" items={grouped.slice(0, 1).concat(grouped[4]!)} groupBy="status" />,
    );
    const labels = [...container.querySelectorAll("nav section > div")].map((node) => node.textContent);
    expect(labels).toEqual(["Working", "Done"]);
  });

  it("is off by default: a flat list with no section wrappers", () => {
    const { container } = render(<SessionSidebar title="Chats" items={grouped} />);
    expect(container.querySelector("nav section")).toBeNull();
    expect(container.querySelector("nav > ul")).not.toBeNull();
  });
});

describe("SessionSidebar — fill", () => {
  it("drops the inline width and stretches to the parent", () => {
    const { container } = render(<SessionSidebar title="Chats" items={baseItems} fill />);
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.style.width).toBe("");
    expect(aside.className).toMatch(/\bh-full\b/);
    expect(aside.className).toMatch(/\bw-full\b/);
  });

  it("keeps the 256px inline width by default", () => {
    const { container } = render(<SessionSidebar title="Chats" items={baseItems} />);
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.style.width).toBe("256px");
    expect(aside.className).not.toMatch(/\bw-full\b/);
  });
});
