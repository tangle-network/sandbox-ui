import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, forwardRef } from "react";
import type { HTMLAttributes, Ref } from "react";
import { describe, expect, it } from "vitest";
import { Card, CardTitle, Heading, PageHeader, SectionTitle, Table, TableBody, TableCell, TableRow } from "./index";

describe("canonical presentation compatibility", () => {
  it("forwards Heading refs through a custom semantic element without emitting its visual role", () => {
    const ref = createRef<HTMLElement>();
    const Custom = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>((props, forwarded) => <h4 {...props} ref={forwarded as Ref<HTMLHeadingElement>} />);
    render(<Heading role="page" as={Custom} ref={ref}>Custom title</Heading>);
    expect(ref.current).toBe(screen.getByRole("heading", { level: 4 }));
    expect(ref.current).not.toHaveAttribute("role");
  });

  it("preserves legacy header props, semantic override, attributes and the canonical ref", async () => {
    const ref = createRef<HTMLElement>();
    let count = 0;
    render(<PageHeader ref={ref} title="Nested title" titleAs="h3" eyebrow={0} description={0}
      data-testid="header" aria-label="Header region" action={<button onClick={() => { count++; }}>Legacy action</button>} />);
    expect(ref.current).toBe(screen.getByTestId("header"));
    expect(screen.getByRole("heading", { level: 3, name: "Nested title" })).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(2);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Legacy action" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(count).toBe(1);
  });

  it("honors canonical actions precedence without losing the legacy action input", () => {
    render(<PageHeader title="Actions" action={<button>Legacy</button>} actions={null} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps SectionTitle as an h2 composition with its action and class override", () => {
    render(<SectionTitle title="Section" description="Details" action={<button>Section action</button>} className="mb-2" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Section" });
    expect(heading.closest("header")).toHaveClass("mb-2");
    expect(heading.closest("header")).not.toHaveClass("mb-0");
    expect(screen.getByText("Details")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Section action" })).toBeTruthy();
  });

  it("keeps card titles at h3 by default and forwards explicit levels and refs", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<Card hover data-testid="card"><CardTitle>Default title</CardTitle><CardTitle as="h4" ref={ref}>Nested card</CardTitle></Card>);
    expect(screen.getByRole("heading", { level: 3, name: "Default title" })).toBeTruthy();
    expect(ref.current).toBe(screen.getByRole("heading", { level: 4 }));
    expect(screen.getByTestId("card")).not.toHaveAttribute("tabindex");
    expect(screen.getByTestId("card")).not.toHaveAttribute("role");
  });

  it("forwards the native table ref, wrapper accessibility and wrapper opt-out", async () => {
    const ref = createRef<HTMLTableElement>();
    const { rerender } = render(<Table ref={ref} wrapperProps={{ tabIndex: 0, role: "region", "aria-label": "History" }}>
      <TableBody><TableRow><TableCell>Record</TableCell></TableRow></TableBody>
    </Table>);
    expect(ref.current).toBe(screen.getByRole("table"));
    await userEvent.setup().tab();
    expect(screen.getByRole("region", { name: "History" })).toHaveFocus();
    rerender(<Table wrapper={false} ref={ref}><TableBody><TableRow><TableCell>Record</TableCell></TableRow></TableBody></Table>);
    expect(screen.queryByRole("region")).toBeNull();
    expect(ref.current).toBe(screen.getByRole("table"));
  });
});
