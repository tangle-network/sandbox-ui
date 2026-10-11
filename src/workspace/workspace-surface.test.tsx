// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WorkspaceSurface } from "./workspace-surface";

afterEach(cleanup);

describe("WorkspaceSurface", () => {
  it("puts a page on the floating panel under an inset shell header", () => {
    const { container } = render(
      <WorkspaceSurface title="Assets" actions={<button type="button">Upload</button>}>
        <p>Grid</p>
      </WorkspaceSurface>,
    );
    const surface = container.querySelector("[data-workspace-surface]");
    expect(surface).not.toBeNull();
    const header = surface!.querySelector("[data-shell-header]");
    expect(header?.getAttribute("data-shell-header")).toBe("inset");
    expect(header?.textContent).toContain("Assets");
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
    // The body is the only scroller: the panel and the page stay put.
    expect(screen.getByText("Grid").parentElement?.className).toContain("overflow-auto");
    expect(container.querySelectorAll("[data-workspace-surface]")).toHaveLength(1);
  });

  it("lets a page supply its own header row", () => {
    const { container } = render(<WorkspaceSurface header={<span>Custom</span>}>x</WorkspaceSurface>);
    expect(container.querySelector("[data-shell-header]")?.textContent).toBe("Custom");
  });
});
