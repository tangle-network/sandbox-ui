import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PreviewView } from "./preview-view";

describe("PreviewView address", () => {
  it("keeps the running frame on its current URL while the address is edited", () => {
    const { container } = render(<PreviewView url="https://example.com/current" />);
    const address = screen.getByRole("textbox", { name: "Preview address" });
    const frame = container.querySelector("iframe") as HTMLIFrameElement;

    fireEvent.change(address, { target: { value: "https://example.com/next" } });
    expect(frame.getAttribute("src")).toBe("https://example.com/current");
    expect(screen.getByRole("link", { name: "Open preview in new tab" })).toHaveAttribute("href", "https://example.com/current");

    fireEvent.keyDown(address, { key: "Enter" });
    expect(container.querySelector("iframe")).toHaveAttribute("src", "https://example.com/next");
  });

  it("rejects a non-web address without navigating the frame", () => {
    const { container } = render(<PreviewView url="https://example.com/current" />);
    const address = screen.getByRole("textbox", { name: "Preview address" });

    fireEvent.change(address, { target: { value: "javascript:alert(1)" } });
    fireEvent.keyDown(address, { key: "Enter" });

    expect(container.querySelector("iframe")).toHaveAttribute("src", "https://example.com/current");
    expect(address).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP or HTTPS");
  });
});
