import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { TaskBoard, type TaskBoardColumn, type TaskBoardItem } from "./task-board";

const columns: TaskBoardColumn[] = [
  { id: "todo", label: "To Do" },
  { id: "done", label: "Done" },
];

const items: TaskBoardItem[] = [
  {
    id: "task-1",
    title: "Draft storyboard",
    status: "todo",
    priority: "high",
  },
];

describe("TaskBoard", () => {
  it("renders task cards without native button nesting", () => {
    const { container } = render(
      <TaskBoard
        items={items}
        columns={columns}
        renderItemMeta={() => (
          <button type="button">
            Move
          </button>
        )}
      />,
    );

    expect(container.querySelector("button button")).toBeNull();
    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it("keeps clickable cards keyboard accessible", () => {
    const onClickItem = vi.fn();
    const { getByRole } = render(
      <TaskBoard
        items={items}
        columns={columns}
        onClickItem={onClickItem}
      />,
    );

    const card = getByRole("button", { name: /Draft storyboard/i });
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onClickItem).toHaveBeenCalledTimes(2);
    expect(onClickItem).toHaveBeenCalledWith(items[0]);
  });
});
