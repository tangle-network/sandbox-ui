// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WorkspaceSurface, WorkspaceSurfaceTitle } from "./workspace-surface";

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

  it("renders the title as the page heading, h1 by default", () => {
    render(<WorkspaceSurface title="Vault">x</WorkspaceSurface>);
    const heading = screen.getByRole("heading", { level: 1, name: "Vault" });
    expect(heading.closest("[data-shell-header]")).not.toBeNull();
  });

  it("takes a heading level for pages nested under another h1", () => {
    render(<WorkspaceSurface title="Runs" headingLevel={2}>x</WorkspaceSurface>);
    expect(screen.getByRole("heading", { level: 2, name: "Runs" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("renders no empty heading without a title and keeps actions at the right", () => {
    render(<WorkspaceSurface actions={<button type="button">New</button>}>x</WorkspaceSurface>);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
  });

  it("gives a custom header its heading through WorkspaceSurfaceTitle", () => {
    render(
      <WorkspaceSurface
        header={
          <>
            <WorkspaceSurfaceTitle>Studio</WorkspaceSurfaceTitle>
            <span>Tabs</span>
          </>
        }
      >
        x
      </WorkspaceSurface>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Studio" })).toBeTruthy();
  });
});
