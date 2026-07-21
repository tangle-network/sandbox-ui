import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { MentionItem } from "./agent-composer";
import { MentionList, type MentionListHandle } from "./mention-list";

const ITEMS: MentionItem[] = [
  { id: "a.ts", label: "a.ts", detail: "src/a.ts" },
  { id: "b.ts", label: "b.ts", detail: "src/b.ts" },
  { id: "c.ts", label: "c.ts", detail: "src/c.ts" },
];

function key(name: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: name });
}

describe("MentionList", () => {
  it("shows the loading state", () => {
    render(
      <MentionList items={[]} loading error={false} onSelect={() => {}} />,
    );
    expect(screen.getByText("Searching…")).toBeInTheDocument();
  });

  it("shows the error state", () => {
    render(
      <MentionList items={[]} loading={false} error onSelect={() => {}} />,
    );
    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
  });

  it("shows the custom empty text", () => {
    render(
      <MentionList
        items={[]}
        loading={false}
        error={false}
        emptyText="Nothing here"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("uses renderItem when provided", () => {
    render(
      <MentionList
        items={ITEMS}
        loading={false}
        error={false}
        renderItem={(item) => <span>custom-{item.id}</span>}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("custom-a.ts")).toBeInTheDocument();
  });

  it("navigates with arrows and selects the highlighted item on Enter", () => {
    const onSelect = vi.fn();
    const ref = createRef<MentionListHandle>();
    render(
      <MentionList
        ref={ref}
        items={ITEMS}
        loading={false}
        error={false}
        onSelect={onSelect}
      />,
    );

    // First row highlighted by default.
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    expect(ref.current!.onKeyDown(key("ArrowDown"))).toBe(true);
    expect(ref.current!.onKeyDown(key("ArrowDown"))).toBe(true);
    expect(ref.current!.onKeyDown(key("Enter"))).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[2]);
  });

  it("selects on Tab", () => {
    const onSelect = vi.fn();
    const ref = createRef<MentionListHandle>();
    render(
      <MentionList
        ref={ref}
        items={ITEMS}
        loading={false}
        error={false}
        onSelect={onSelect}
      />,
    );
    expect(ref.current!.onKeyDown(key("Tab"))).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });

  it("consumes Enter even with no items so the message never submits", () => {
    const onSelect = vi.fn();
    const ref = createRef<MentionListHandle>();
    render(
      <MentionList
        ref={ref}
        items={[]}
        loading={false}
        error={false}
        onSelect={onSelect}
      />,
    );
    expect(ref.current!.onKeyDown(key("Enter"))).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects the hovered item on Enter, not the arrow-highlighted default", () => {
    const onSelect = vi.fn();
    const ref = createRef<MentionListHandle>();
    render(
      <MentionList
        ref={ref}
        items={ITEMS}
        loading={false}
        error={false}
        onSelect={onSelect}
      />,
    );

    const options = screen.getAllByRole("option");
    // Index 0 is highlighted by default; hover moves the highlight to index 2
    // without ever touching the keyboard.
    fireEvent.mouseEnter(options[2]!);
    expect(options[2]).toHaveAttribute("aria-selected", "true");

    expect(ref.current!.onKeyDown(key("Enter"))).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[2]);
  });

  it("does not consume unrelated keys", () => {
    const ref = createRef<MentionListHandle>();
    render(
      <MentionList
        ref={ref}
        items={ITEMS}
        loading={false}
        error={false}
        onSelect={() => {}}
      />,
    );
    expect(ref.current!.onKeyDown(key("a"))).toBe(false);
  });
});
