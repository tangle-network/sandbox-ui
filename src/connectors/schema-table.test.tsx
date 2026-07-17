import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SchemaTable } from "./schema-table";

describe("SchemaTable", () => {
  it("renders one row per property with type, required mark, and enum values", () => {
    render(
      <SchemaTable
        label="Input"
        schema={{
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            event: { type: "string", enum: ["COMMENT", "APPROVE"] },
            labels: { type: "array", items: { type: "string" } },
          },
          required: ["owner"],
        }}
      />,
    );

    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("Repository owner")).toBeInTheDocument();
    expect(screen.getByText("required")).toBeInTheDocument();
    expect(screen.getByText(/One of: "COMMENT", "APPROVE"/)).toBeInTheDocument();
    expect(screen.getByText("array<string>")).toBeInTheDocument();
  });

  it("indents nested object properties beneath their parent", () => {
    render(
      <SchemaTable
        label="Input"
        schema={{
          type: "object",
          properties: {
            account: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        }}
      />,
    );
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
  });

  it("recurses into the object properties of an array's items", () => {
    render(
      <SchemaTable
        label="Input"
        schema={{
          type: "object",
          properties: {
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  customFieldId: { type: "integer" },
                  fieldValue: { type: "string", description: "The value" },
                },
              },
            },
          },
        }}
      />,
    );
    // The array itself is typed, and its object items' fields are tabulated.
    expect(screen.getByText("fields")).toBeInTheDocument();
    expect(screen.getByText("array<object>")).toBeInTheDocument();
    expect(screen.getByText("customFieldId")).toBeInTheDocument();
    expect(screen.getByText("fieldValue")).toBeInTheDocument();
    expect(screen.getByText("The value")).toBeInTheDocument();
  });

  it("toggles between the field view and raw JSON", () => {
    render(
      <SchemaTable
        label="Input"
        schema={{ type: "object", properties: { a: { type: "string" } } }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Raw JSON" }));
    expect(screen.getByText(/"type": "object"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Field view" }));
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  it("falls back to raw JSON for schemas it can't tabulate", () => {
    render(
      <SchemaTable label="Input" schema={{ anyOf: [{ type: "string" }] }} />,
    );
    expect(screen.getByText(/anyOf/)).toBeInTheDocument();
    // No toggle — there's no field view to switch to.
    expect(screen.queryByRole("button", { name: "Raw JSON" })).toBeNull();
  });

  it("says so when an object schema declares no fields", () => {
    render(
      <SchemaTable label="Input" schema={{ type: "object", properties: {} }} />,
    );
    expect(screen.getByText("No fields.")).toBeInTheDocument();
  });

  it("renders a cyclic schema without crashing the host", () => {
    // Schemas arriving over the wire are JSON (acyclic), but the component
    // takes `unknown`, so a hand-built cyclic object must degrade gracefully.
    // Two independent guards: the MAX_DEPTH cap bounds `collectRows` recursion
    // (the cycle truncates like any deep schema — no stack overflow), and the
    // raw-JSON view uses a safe stringify (a cycle would otherwise throw
    // "Converting circular structure to JSON" and take down the host).
    const cyclic: Record<string, unknown> = { type: "object", properties: {} };
    (cyclic.properties as Record<string, unknown>).self = cyclic;

    expect(() =>
      render(<SchemaTable label="Input" schema={cyclic} />),
    ).not.toThrow();
    // The field view renders the cycle, truncated at the depth cap.
    expect(screen.getAllByText("self").length).toBeGreaterThan(0);

    // The raw-JSON view degrades to a note instead of throwing.
    fireEvent.click(screen.getByRole("button", { name: "Raw JSON" }));
    expect(
      screen.getByText("(schema cannot be shown as JSON)"),
    ).toBeInTheDocument();
  });
});
