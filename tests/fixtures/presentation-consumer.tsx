import React, { createRef, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as P from "@tangle-network/sandbox-ui/primitives";
import * as Root from "@tangle-network/sandbox-ui";
import * as Canonical from "@tangle-network/ui/primitives";
import type { HeadingProps, HeadingVariant, PageHeaderProps, PageShellProps, SectionTitleProps, CardTitleProps, TableProps } from "@tangle-network/sandbox-ui/primitives";

// Checked against installed package declarations, never source aliases.
const headingProps: HeadingProps = { role: "display", as: "h2", children: "Legacy display" };
const visualRole: HeadingVariant = headingProps.role;
// @ts-expect-error Sandbox's named compatibility type still requires its visual role.
const missingLegacyRole: HeadingProps = { children: "Not the legacy contract" };
void missingLegacyRole;
const pageProps: PageHeaderProps = { title: "Workspace presentation", eyebrow: 0, description: "A long identifier: " + "sandbox".repeat(30) };
const shellProps: PageShellProps = { children: null, className: "consumer-shell" };
const sectionProps: SectionTitleProps = { title: "Runs", description: "Retained section API" };
const cardProps: CardTitleProps = { as: "h3" };
const tableProps: TableProps = { wrapperProps: { tabIndex: 0, role: "region", "aria-label": "Run history" } };
const headingRef = createRef<HTMLElement>();
const headerRef = createRef<HTMLElement>();
const cardRef = createRef<HTMLHeadingElement>();
const tableRef = createRef<HTMLTableElement>();
const bindings = ["Heading", "PageHeader", "PageShell", "Card", "CardHeader", "CardContent", "CardFooter", "CardTitle", "CardDescription", "Table", "TableHeader", "TableBody", "TableFooter", "TableHead", "TableRow", "TableCell", "TableCaption"] as const;

function Consumer() {
  const [actions, setActions] = useState(0);
  useLayoutEffect(() => {
    document.body.dataset.identity = String(bindings.every((name) => P[name] === Canonical[name] && Root[name] === Canonical[name]));
    document.body.dataset.refs = String(headingRef.current?.tagName === "H2" && headerRef.current?.tagName === "HEADER" && cardRef.current?.tagName === "H3" && tableRef.current?.tagName === "TABLE");
    document.body.dataset.ready = "true";
  }, []);
  return <main data-actions={actions}>
    <P.PageShell {...shellProps}>
      <P.PageHeader {...pageProps} ref={headerRef} action={<P.Button id="page-action" onClick={() => setActions((n) => n + 1)}>Review changes</P.Button>} />
      <P.SectionTitle {...sectionProps} action={<P.Button id="section-action">Section action</P.Button>} />
      <P.Heading {...headingProps} role={visualRole} ref={headingRef} />
      <P.Card hover data-testid="card">
        <P.CardHeader><P.CardTitle {...cardProps} ref={cardRef}>Build record</P.CardTitle><P.CardDescription>Canonical card anatomy</P.CardDescription></P.CardHeader>
        <P.CardContent>Content keeps its padding without another renderer.</P.CardContent>
        <P.CardFooter><P.Button id="card-action">Open record</P.Button></P.CardFooter>
      </P.Card>
      <P.Table {...tableProps} ref={tableRef} style={{ minWidth: 640 }}>
        <P.TableCaption>Recent runs</P.TableCaption>
        <P.TableHeader><P.TableRow><P.TableHead scope="col">Run</P.TableHead><P.TableHead scope="col">Outcome</P.TableHead></P.TableRow></P.TableHeader>
        <P.TableBody><P.TableRow><P.TableCell>Canonical presentation migration</P.TableCell><P.TableCell>Ready for review</P.TableCell></P.TableRow></P.TableBody>
      </P.Table>
      <div className="tangle-prose"><p>First paragraph.</p><p data-testid="prose-gap">Second paragraph keeps the published gap.</p></div>
    </P.PageShell>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Consumer />);
