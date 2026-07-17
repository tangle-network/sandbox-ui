"use client";

import { useState } from "react";

/**
 * Readable field table for a hub action's JSON input/output schema: one row
 * per property (name, type, required, description), nested object properties
 * indented beneath their parent up to a small depth. Falls back to raw JSON
 * for schemas that aren't an object-with-properties (unions, bare arrays,
 * boolean schemas) — never guesses at a shape it can't represent honestly.
 */

interface SchemaNode {
  type?: unknown;
  properties?: unknown;
  required?: unknown;
  items?: unknown;
  enum?: unknown;
  description?: unknown;
}

interface FieldRow {
  /** Dot-joined property path, e.g. "account.name". */
  name: string;
  depth: number;
  type: string;
  required: boolean;
  description: string;
  enumValues: string[] | null;
}

/** Nested rows beyond this depth collapse to their parent's `object` type —
 *  deeper shapes are readable in the raw-JSON view. */
const MAX_DEPTH = 3;

function asNode(value: unknown): SchemaNode | null {
  return typeof value === "object" && value !== null
    ? (value as SchemaNode)
    : null;
}

function typeLabel(node: SchemaNode): string {
  const type = Array.isArray(node.type) ? node.type.join(" | ") : node.type;
  if (type === "array") {
    const items = asNode(node.items);
    const itemType = items
      ? Array.isArray(items.type)
        ? items.type.join(" | ")
        : items.type
      : undefined;
    return typeof itemType === "string" ? `array<${itemType}>` : "array";
  }
  if (typeof type === "string") return type;
  if (Array.isArray(node.enum)) return "enum";
  return "any";
}

function collectRows(
  schema: SchemaNode,
  depth: number,
  prefix: string,
  out: FieldRow[],
): void {
  const properties = asNode(schema.properties);
  if (!properties) return;
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((n): n is string => typeof n === "string")
      : [],
  );
  for (const [name, rawProp] of Object.entries(
    properties as Record<string, unknown>,
  )) {
    const prop = asNode(rawProp) ?? {};
    const enumValues = Array.isArray(prop.enum)
      ? prop.enum.map((v) => JSON.stringify(v))
      : null;
    out.push({
      name: prefix ? `${prefix}.${name}` : name,
      depth,
      type: typeLabel(prop),
      required: required.has(name),
      description: typeof prop.description === "string" ? prop.description : "",
      enumValues,
    });
    if (depth + 1 >= MAX_DEPTH) continue;
    // Recurse into object properties, and into array<object> item properties.
    const child =
      typeLabel(prop) === "object" || asNode(prop.properties)
        ? prop
        : (asNode(prop.items)?.properties ?? null)
          ? (asNode(prop.items) as SchemaNode)
          : null;
    if (child) {
      collectRows(child, depth + 1, prefix ? `${prefix}.${name}` : name, out);
    }
  }
}

function schemaRows(schema: unknown): FieldRow[] | null {
  const node = asNode(schema);
  if (!node || !asNode(node.properties)) return null;
  const rows: FieldRow[] = [];
  collectRows(node, 0, "", rows);
  return rows;
}

export interface SchemaTableProps {
  schema: unknown;
  /** Toggle/table caption, e.g. "Input" or "Output". */
  label: string;
}

export function SchemaTable({ schema, label }: SchemaTableProps) {
  const [showRaw, setShowRaw] = useState(false);
  const rows = schemaRows(schema);
  const rawJson = JSON.stringify(schema, null, 2) ?? "null";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </span>
        {rows !== null && rows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-primary text-xs transition-colors hover:underline"
          >
            {showRaw ? "Field view" : "Raw JSON"}
          </button>
        )}
      </div>

      {rows === null || rows.length === 0 || showRaw ? (
        rows !== null && rows.length === 0 && !showRaw ? (
          <p className="text-muted-foreground text-sm">No fields.</p>
        ) : (
          <pre className="overflow-x-auto rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed">
            {rawJson}
          </pre>
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b bg-surface-container-high">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground text-xs">
                  Field
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground text-xs">
                  Type
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground text-xs">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="border-border border-b last:border-b-0"
                >
                  <td
                    className="whitespace-nowrap px-3 py-1.5 align-top font-mono text-foreground text-xs"
                    style={{ paddingLeft: `${0.75 + row.depth * 1}rem` }}
                  >
                    {row.name.split(".").at(-1)}
                    {row.required && (
                      <span className="ml-0.5 text-destructive" title="Required">
                        *<span className="sr-only">required</span>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 align-top font-mono text-muted-foreground text-xs">
                    {row.type}
                  </td>
                  <td className="px-3 py-1.5 align-top text-muted-foreground text-xs">
                    {row.description}
                    {row.enumValues && (
                      <span className={row.description ? "ml-1" : ""}>
                        One of: {row.enumValues.join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
