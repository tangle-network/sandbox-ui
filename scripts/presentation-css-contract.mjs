import postcss from "postcss";

export const PRESENTATION_BINDINGS = [
  "Heading", "PageHeader", "PageShell", "Card", "CardHeader", "CardContent",
  "CardFooter", "CardTitle", "CardDescription", "Table", "TableHeader",
  "TableBody", "TableFooter", "TableHead", "TableRow", "TableCell", "TableCaption",
];

// Read selectors, not substring markers: comments, declarations containing a
// class name, and empty rules cannot satisfy the compiled-utility contract.
const IDENTIFIER = /\.((?:\\[\da-fA-F]{1,6}\s?|\\[^\n\r\f]|[\w-]|[^\x00-\x7f])+)/g;
const unescapeIdentifier = (value) => value.replace(
  /\\([\da-fA-F]{1,6}\s?|[^\n\r\f])/g,
  (_, escaped) => /^[\da-fA-F]/.test(escaped)
    ? String.fromCodePoint(parseInt(escaped.trim(), 16))
    : escaped,
);

export function assertPresentationUtilities(css, utilities, label = "presentation CSS") {
  if (!(utilities instanceof Set) || utilities.size === 0) {
    throw new Error(`${label}: no rendered presentation utilities were collected`);
  }
  const emitted = new Set();
  const root = postcss.parse(css);
  root.walkAtRules((rule) => {
    if (["import", "source", "theme", "tailwind"].includes(rule.name)) {
      throw new Error(`${label}: unresolved @${rule.name} in compiled output`);
    }
  });
  root.walkRules((rule) => {
    let hasDeclaration = false;
    rule.walkDecls(() => { hasDeclaration = true; });
    if (!hasDeclaration) return;
    for (const [, identifier] of rule.selector.matchAll(IDENTIFIER)) {
      emitted.add(unescapeIdentifier(identifier));
    }
  });
  const missing = [...utilities].filter((name) => !emitted.has(name));
  if (missing.length) {
    throw new Error(`${label}: rendered utilities have no compiled rule:\n${missing.join("\n")}`);
  }
}

/** Derive the contract from the actual installed canonical renderers. */
export async function collectPresentationUtilities() {
  const [{ createElement: h }, { renderToStaticMarkup }, ui] = await Promise.all([
    import("react"), import("react-dom/server"), import("@tangle-network/ui/primitives"),
  ]);
  for (const name of PRESENTATION_BINDINGS) {
    if (!ui[name]) throw new Error(`Installed UI does not export ${name}; install the declared peer floor`);
  }
  const specimens = [
    ...["display", "hero", "page", "section", "subsection", "eyebrow"].map(
      (role) => h(ui.Heading, { role }, role),
    ),
    ...[1, 2].map((level) => h(ui.PageHeader, {
      level, title: "Title", description: "Description", eyebrow: "Eyebrow",
      action: h("button", null, "Action"), meta: "Metadata",
    })),
    h(ui.PageShell, null, "Page"),
    ...["default", "glass", "sandbox", "elevated"].map(
      (variant) => h(ui.Card, { variant, hover: true },
        h(ui.CardHeader, null, h(ui.CardTitle, null, "Title"), h(ui.CardDescription, null, "Description")),
        h(ui.CardContent, null, "Content"), h(ui.CardFooter, null, "Footer")),
    ),
    h(ui.Table, null,
      h(ui.TableCaption, null, "Caption"),
      h(ui.TableHeader, null, h(ui.TableRow, null, h(ui.TableHead, { scope: "col" }, "Column"))),
      h(ui.TableBody, null, h(ui.TableRow, null, h(ui.TableCell, null, "Cell"))),
      h(ui.TableFooter, null, h(ui.TableRow, null, h(ui.TableCell, null, "Footer")))),
  ];
  const utilities = new Set();
  for (const specimen of specimens) {
    const markup = renderToStaticMarkup(specimen);
    for (const [, classes] of markup.matchAll(/\bclass="([^"]+)"/g)) {
      const decoded = classes.replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<")
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
      for (const token of decoded.split(/\s+/)) if (token) utilities.add(token);
    }
  }
  if (utilities.size < 40) throw new Error("Presentation renderer class inventory unexpectedly shrank");
  return utilities;
}
