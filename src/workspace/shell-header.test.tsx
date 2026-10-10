import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ShellHeader, SHELL_HEADER_HEIGHT } from "./shell-header";

describe("ShellHeader", () => {
  it("holds the shell header height against a consumer's class or style", () => {
    const { getByTestId } = render(
      <ShellHeader data-testid="row" className="h-24 min-h-[66px]" style={{ height: 66, minHeight: 66, color: "red" }}>
        Messages
      </ShellHeader>,
    );
    const row = getByTestId("row");
    expect(row.style.height).toBe(SHELL_HEADER_HEIGHT);
    expect(row.style.minHeight).toBe(SHELL_HEADER_HEIGHT);
    expect(row.style.maxHeight).toBe(SHELL_HEADER_HEIGHT);
    // Content styling still reaches the row.
    expect(row.style.color).toBe("red");
    expect(row.className).toContain("border-b");
  });

  it("shortens an inset pane's header by the gutter and border so its divider lands on the same line", () => {
    const { getByTestId } = render(<ShellHeader data-testid="row" inset />);
    expect(getByTestId("row").style.height).toBe(
      "calc(var(--shell-header-height, 3.5rem) - var(--shell-inset-gutter, 0.5rem) - 1px)",
    );
    expect(getByTestId("row").dataset.shellHeader).toBe("inset");
  });

  it("renders a header landmark on request", () => {
    const { container } = render(<ShellHeader as="header">Page</ShellHeader>);
    expect(container.querySelector("header[data-shell-header]")).not.toBeNull();
  });
});
