import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TerminalPanel } from "./terminal-panel";

describe("TerminalPanel controls", () => {
  it("exposes Close as its own keyboard button", () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();
    render(<TerminalPanel lines={[]} onToggle={onToggle} onClose={onClose} />);

    const close = screen.getByRole("button", { name: "Close Terminal" });
    close.focus();
    expect(close).toHaveFocus();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();

    const toggle = screen.getByRole("button", { name: "Terminal" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
