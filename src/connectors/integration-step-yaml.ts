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

/** YAML scalar placeholder for a property schema. A string enum stubs its
 *  first string member (a real accepted input beats an empty string, quoted so
 *  it stays a string); otherwise — non-string/undefined/object enum values, or
 *  no enum — the placeholder is the type's empty value. Non-string enum members
 *  are intentionally NOT inlined: `JSON.stringify` on them would emit a
 *  type-changing bare token (`true`, `{}`, or even `undefined` for a malformed
 *  member), which the type placeholder handles honestly instead. */
function placeholderFor(propSchema: unknown): string {
  const schema = asSchemaObject(propSchema);
  if (!schema) return '""';
  if (Array.isArray(schema.enum)) {
    const firstString = schema.enum.find(
      (value): value is string => typeof value === "string",
    );
    if (firstString !== undefined) return JSON.stringify(firstString);
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

/** YAML 1.1 plain scalars a parser would coerce away from a string —
 *  booleans, null, and the empty value. Numbers are caught separately (they
 *  have no letter, so the "must contain a letter" rule below rejects them). */
const YAML_RESERVED_SCALAR = /^(?:true|false|null|yes|no|on|off|~)$/i;

/** True when `value` is safe to emit as a bare (unquoted) YAML scalar: a plain
 *  identifier-ish token that a YAML parser will load back as the same string.
 *  Requires at least one letter so pure-numeric tokens (`123`, `1.2`) quote,
 *  and rejects reserved words so `true`/`null`/`no` quote — both would
 *  otherwise load as a non-string type. */
function isBareYamlScalar(value: string): boolean {
  return (
    /^[A-Za-z0-9_.-]+$/.test(value) &&
    /[A-Za-z]/.test(value) &&
    !YAML_RESERVED_SCALAR.test(value)
  );
}

/** Bare YAML key when safe, quoted otherwise. Keys use the stricter
 *  identifier rule (must start with a letter/underscore) rather than the
 *  scalar rule, since a dotted or digit-led key reads poorly unquoted. */
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
  // hostile manifest value — a YAML-special token or a structural character —
  // can't change the emitted step's shape or the path's loaded type.
  const pathScalar = isBareYamlScalar(path) ? path : JSON.stringify(path);
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
