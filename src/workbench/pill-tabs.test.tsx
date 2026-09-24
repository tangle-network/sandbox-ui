import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PillTabs } from "./pill-tabs";

function Example() {
  const [view, setView] = useState<"code" | "diff" | "ports">("code");
  return (
    <>
      <PillTabs
        items={[
          { value: "code", label: "Code" },
          { value: "diff", label: "Diff" },
          { value: "ports", label: "Ports" },
        ]}
        value={view}
        onChange={setView}
        aria-label="Artifact view"
        idPrefix="artifact"
        panelId="artifact-panel"
      />
      <div id="artifact-panel" role="tabpanel" aria-labelledby={`artifact-${view}`}>{view}</div>
    </>
  );
}

describe("PillTabs keyboard navigation", () => {
  it("moves focus and selection with arrows, Home, and End", () => {
    render(<Example />);
    const code = screen.getByRole("tab", { name: "Code" });
    const diff = screen.getByRole("tab", { name: "Diff" });
    const ports = screen.getByRole("tab", { name: "Ports" });

    code.focus();
    fireEvent.keyDown(code, { key: "ArrowRight" });
    expect(diff).toHaveFocus();
    expect(diff).toHaveAttribute("aria-selected", "true");
    expect(code).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "artifact-diff");

    fireEvent.keyDown(diff, { key: "End" });
    expect(ports).toHaveFocus();
    fireEvent.keyDown(ports, { key: "Home" });
    expect(code).toHaveFocus();
    expect(code).toHaveAttribute("aria-controls", "artifact-panel");
  });
});
