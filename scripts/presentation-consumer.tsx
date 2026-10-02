import React, { createRef, useLayoutEffect, useState, type ReactNode } from "react";
import {
  Heading, PageHeader, PageShell, SectionTitle, Card, CardHeader, CardContent,
  CardFooter, CardTitle, CardDescription, Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell, TableCaption,
  type HeadingProps, type HeadingVariant, type PageHeaderProps, type PageShellProps,
  type SectionTitleProps, type CardTitleProps, type TableProps,
} from "@tangle-network/sandbox-ui/primitives";
import {
  Heading as RootHeading, PageHeader as RootHeader, PageShell as RootShell,
  CardTitle as RootCardTitle, Table as RootTable,
  type HeadingProps as RootHeadingProps,
} from "@tangle-network/sandbox-ui";
import {
  Heading as CanonicalHeading, PageHeader as CanonicalHeader, PageShell as CanonicalShell,
  CardTitle as CanonicalCardTitle, Table as CanonicalTable,
} from "@tangle-network/ui/primitives";

// These imports resolve exclusively from the installed tarball and its peers.
for (const [name, bridge, root, canonical] of [
  ["Heading", Heading, RootHeading, CanonicalHeading],
  ["PageHeader", PageHeader, RootHeader, CanonicalHeader],
  ["PageShell", PageShell, RootShell, CanonicalShell],
  ["CardTitle", CardTitle, RootCardTitle, CanonicalCardTitle],
  ["Table", Table, RootTable, CanonicalTable],
] as const) {
  if (bridge !== canonical || root !== canonical) throw new Error(`${name}: not the canonical binding`);
}

// The historical named props must remain usable by downstream TS functions,
// not merely by JSX. In particular role and children must remain required.
export const legacyHeading: HeadingProps = { role: "page", as: "h2", children: "Legacy title" };
export const requiredRole: HeadingVariant = legacyHeading.role;
export const rootProps: RootHeadingProps = legacyHeading;
export const legacyHeader: PageHeaderProps = {
  title: "Nested", description: "Description", eyebrow: "Workspace", titleAs: "h2", action: 0,
};
export const legacySection: SectionTitleProps = { title: "Resource limits", description: "Retained section description." };
export const legacyShell: PageShellProps = { children: null };
export const cardTitle: CardTitleProps = { as: "h4", children: "Compute" };
export const tableProps: TableProps = {
  wrapperProps: { role: "region", "aria-label": "Resource usage", tabIndex: 0 },
};
// @ts-expect-error The legacy exported type still requires its visual role.
const missingRole: HeadingProps = { children: "Missing role" };
// @ts-expect-error The legacy exported type still requires children.
const missingChildren: HeadingProps = { role: "page" };
// @ts-expect-error PageShell has never promised ref forwarding or a new app-shell API.
const shellRef: PageShellProps = { children: null, ref: createRef<HTMLDivElement>() };
void [missingRole, missingChildren, shellRef];

const titleText = "Background agent resource management with an_unbroken_identifier_" + "x".repeat(80);
const roles = ["display", "hero", "page", "section", "subsection", "eyebrow"] as const;

export function PresentationConsumer(): ReactNode {
  const headingRef = createRef<HTMLElement>();
  const headerRef = createRef<HTMLElement>();
  const cardRef = createRef<HTMLDivElement>();
  const cardTitleRef = createRef<HTMLHeadingElement>();
  const tableRef = createRef<HTMLTableElement>();
  const [actions, setActions] = useState(0);

  useLayoutEffect(() => {
    for (const [name, ref, tag] of [
      ["Heading", headingRef, "H2"], ["PageHeader", headerRef, "HEADER"],
      ["Card", cardRef, "DIV"], ["CardTitle", cardTitleRef, "H4"], ["Table", tableRef, "TABLE"],
    ] as const) {
      if (ref.current?.tagName !== tag) throw new Error(`${name}: ref did not reach ${tag}`);
    }
    document.documentElement.dataset.presentationReady = "true";
  }, []);

  return (
    <main data-presentation data-action-count={actions}>
      <PageShell>
        <PageHeader
          ref={headerRef} title={titleText} titleId="page-title" eyebrow="Workspace"
          description="The action must wrap below the title on a phone without making the document scroll sideways."
          action={<button type="button" onClick={() => setActions((value) => value + 1)}>Create sandbox</button>}
          meta="Canonical presentation, retained domain composition"
        />
        <SectionTitle {...legacySection} />
        <Heading {...legacyHeading} ref={headingRef} />
        <div>
          {roles.map((role) => (
            <Heading key={role} role={role} as={role === "eyebrow" ? "p" : "h2"} data-type-role={role}>
              {role} typography
            </Heading>
          ))}
        </div>
        <Card ref={cardRef} hover data-card>
          <CardHeader data-card-header>
            <CardTitle {...cardTitle} ref={cardTitleRef} />
            <CardDescription>Actions remain native controls, not a clickable card surface.</CardDescription>
          </CardHeader>
          <CardContent data-card-content>
            <Table {...tableProps} ref={tableRef} style={{ minWidth: 1800 }}>
              <TableCaption>Resource usage by environment</TableCaption>
              <TableHeader><TableRow><TableHead>Environment</TableHead><TableHead>CPU</TableHead></TableRow></TableHeader>
              <TableBody><TableRow><TableCell>Background agent</TableCell><TableCell>2 cores</TableCell></TableRow></TableBody>
            </Table>
          </CardContent>
          <CardFooter data-card-footer><span>Ready</span></CardFooter>
        </Card>
      </PageShell>
    </main>
  );
}
