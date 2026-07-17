/**
 * Mechanical `integration.invoke` step-YAML stub for a hub action, derived
 * entirely from the action's JSON input schema: the step shape the workflow
 * language expects, with the action's required fields (or every top-level
 * field when the schema declares none required) stubbed by type. A copy-paste
 * seed for hand-authoring a workflow — not a validated document.
 */

interface JsonSchemaObject {
  type?: unknown;
  properties?: unknown;
  required?: unknown;
  enum?: unknown;
}

function asSchemaObject(value: unknown): JsonSchemaObject | null {
  return typeof value === "object" && value !== null
    ? (value as JsonSchemaObject)
    : null;
}

/** YAML scalar placeholder for a property schema. Enums stub their first
 *  value (a real accepted input beats an empty string); otherwise the
 *  placeholder is the type's empty value. */
function placeholderFor(propSchema: unknown): string {
  const schema = asSchemaObject(propSchema);
  if (!schema) return '""';
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return JSON.stringify(schema.enum[0]);
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "number":
    case "integer":
      return "0";
    case "boolean":
      return "false";
    case "array":
      return "[]";
    case "object":
      return "{}";
    default:
      return '""';
  }
}

/** Bare YAML key when safe, quoted otherwise. */
function yamlKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * The input fields to stub: the schema's `required` list when it names any
 * (in declaration order), else every top-level property — a schema with no
 * required fields gives no signal to cut, and showing all is honest.
 */
function stubFields(inputSchema: unknown): Array<[string, unknown]> {
  const schema = asSchemaObject(inputSchema);
  const properties = asSchemaObject(schema?.properties);
  if (!properties) return [];
  const names = Object.keys(properties);
  const required = Array.isArray(schema?.required)
    ? schema.required.filter(
        (name): name is string =>
          typeof name === "string" && names.includes(name),
      )
    : [];
  const chosen = required.length > 0 ? required : names;
  return chosen.map((name) => [
    name,
    (properties as Record<string, unknown>)[name],
  ]);
}

/** The `- integration.invoke:` step block for an action, ready to paste into a
 *  workflow's `do:` list. */
export function integrationStepYaml(
  path: string,
  inputSchema: unknown,
): string {
  const fields = stubFields(inputSchema);
  // Paths are catalog-controlled dotted identifiers; quote anything else so a
  // hostile manifest value can't break the emitted YAML structure.
  const pathScalar = /^[A-Za-z0-9_.-]+$/.test(path)
    ? path
    : JSON.stringify(path);
  const lines = [
    "- integration.invoke:",
    `    path: ${pathScalar}`,
    ...(fields.length === 0
      ? ["    input: {}"]
      : [
          "    input:",
          ...fields.map(
            ([name, propSchema]) =>
              `      ${yamlKey(name)}: ${placeholderFor(propSchema)}`,
          ),
        ]),
  ];
  return `${lines.join("\n")}\n`;
}
