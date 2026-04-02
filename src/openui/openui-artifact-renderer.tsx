import { Fragment, type ReactNode } from "react";
import { ArrowRight, Minus } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../primitives/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../primitives/table";
import { CodeBlock } from "../primitives/code-block";
import { Markdown } from "../markdown/markdown";

export type OpenUIPrimitive = string | number | boolean | null | undefined;

export interface OpenUIAction {
  id: string;
  label: string;
  tone?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
  onPress?: () => void;
}

interface OpenUIBaseNode {
  id?: string;
}

export interface OpenUIHeadingNode extends OpenUIBaseNode {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3 | 4;
  kicker?: string;
  meta?: string;
}

export interface OpenUITextNode extends OpenUIBaseNode {
  type: "text";
  text: string;
  tone?: "default" | "muted" | "success" | "warning" | "error";
  mono?: boolean;
}

export interface OpenUIBadgeNode extends OpenUIBaseNode {
  type: "badge";
  label: string;
  tone?: "default" | "secondary" | "success" | "warning" | "error" | "info" | "sandbox";
}

export interface OpenUIStatNode extends OpenUIBaseNode {
  type: "stat";
  label: string;
  value: string;
  change?: string;
  tone?: "default" | "success" | "warning" | "error" | "info";
}

export interface OpenUIKeyValueNode extends OpenUIBaseNode {
  type: "key_value";
  items: Array<{
    id?: string;
    label: string;
    value: ReactNode | OpenUIPrimitive;
    tone?: "default" | "muted";
  }>;
}

export interface OpenUICodeNode extends OpenUIBaseNode {
  type: "code";
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export interface OpenUIMarkdownNode extends OpenUIBaseNode {
  type: "markdown";
  content: string;
}

export interface OpenUITableNode extends OpenUIBaseNode {
  type: "table";
  columns: Array<{
    key: string;
    header: string;
    align?: "left" | "right";
  }>;
  rows: Array<Record<string, ReactNode | OpenUIPrimitive>>;
  caption?: string;
}

export interface OpenUIActionsNode extends OpenUIBaseNode {
  type: "actions";
  actions: OpenUIAction[];
}

export interface OpenUISeparatorNode extends OpenUIBaseNode {
  type: "separator";
  label?: string;
}

export interface OpenUIStackNode extends OpenUIBaseNode {
  type: "stack";
  direction?: "row" | "column";
  gap?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "stretch";
  wrap?: boolean;
  children: OpenUIComponentNode[];
}

export interface OpenUIGridNode extends OpenUIBaseNode {
  type: "grid";
  columns?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
  children: OpenUIComponentNode[];
}

export interface OpenUICardNode extends OpenUIBaseNode {
  type: "card";
  title?: string;
  description?: string;
  eyebrow?: string;
  badge?: OpenUIBadgeNode;
  actions?: OpenUIAction[];
  children?: OpenUIComponentNode[];
}

export type OpenUIComponentNode =
  | OpenUIActionsNode
  | OpenUIBadgeNode
  | OpenUICardNode
  | OpenUICodeNode
  | OpenUIGridNode
  | OpenUIHeadingNode
  | OpenUIKeyValueNode
  | OpenUIMarkdownNode
  | OpenUISeparatorNode
  | OpenUIStackNode
  | OpenUIStatNode
  | OpenUITableNode
  | OpenUITextNode;

export interface OpenUIArtifactRendererProps {
  schema: OpenUIComponentNode | OpenUIComponentNode[];
  onAction?: (action: OpenUIAction) => void;
  className?: string;
}

const GAP_STYLES = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
} as const;

const GRID_STYLES = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
} as const;

const ALIGN_STYLES = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

function formatValue(value: ReactNode | OpenUIPrimitive) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value;
}

function renderActions(actions: OpenUIAction[], onAction?: (action: OpenUIAction) => void) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          size="sm"
          variant={action.tone ?? "outline"}
          disabled={action.disabled}
          onClick={() => {
            action.onPress?.();
            onAction?.(action);
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function renderNode(node: OpenUIComponentNode, onAction?: (action: OpenUIAction) => void): ReactNode {
  switch (node.type) {
    case "heading": {
      const level = node.level ?? 2;
      const HeadingTag = `h${level}` as const;

      return (
        <div className="space-y-1">
          {node.kicker && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {node.kicker}
            </div>
          )}
          <HeadingTag
            className={cn(
              "font-semibold tracking-tight text-foreground",
              level === 1 && "text-2xl",
              level === 2 && "text-xl",
              level === 3 && "text-lg",
              level === 4 && "text-base",
            )}
          >
            {node.text}
          </HeadingTag>
          {node.meta && <p className="text-sm text-muted-foreground">{node.meta}</p>}
        </div>
      );
    }

    case "text":
      return (
        <p
          className={cn(
            "text-sm leading-6 text-foreground",
            node.tone === "muted" && "text-muted-foreground",
            node.tone === "success" && "text-[var(--surface-success-text)]",
            node.tone === "warning" && "text-[var(--surface-warning-text)]",
            node.tone === "error" && "text-[var(--surface-danger-text)]",
            node.mono && "font-mono text-[13px]",
          )}
        >
          {node.text}
        </p>
      );

    case "badge":
      return <Badge variant={node.tone ?? "outline"}>{node.label}</Badge>;

    case "stat":
      return (
        <Card variant="glass" className="border-border shadow-[var(--shadow-card)]">
          <CardContent className="space-y-2 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {node.label}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {node.value}
            </div>
            {node.change && (
              <div
                className={cn(
                  "text-xs",
                  node.tone === "success" && "text-[var(--surface-success-text)]",
                  node.tone === "warning" && "text-[var(--surface-warning-text)]",
                  node.tone === "error" && "text-[var(--surface-danger-text)]",
                  node.tone === "info" && "text-[var(--surface-info-text)]",
                  !node.tone || node.tone === "default" ? "text-muted-foreground" : undefined,
                )}
              >
                {node.change}
              </div>
            )}
          </CardContent>
        </Card>
      );

    case "key_value":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          {node.items.map((item, index) => (
            <div
              key={item.id ?? `${item.label}-${index}`}
              className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3"
            >
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {item.label}
              </dt>
              <dd
                className={cn(
                  "mt-1 text-sm font-medium text-foreground",
                  item.tone === "muted" && "text-foreground",
                )}
              >
                {formatValue(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      );

    case "code":
      return (
        <div className="space-y-2">
          {node.title && (
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {node.title}
            </div>
          )}
          <CodeBlock
            code={node.code}
            language={node.language}
            showLineNumbers={node.showLineNumbers}
            className="border-border bg-background"
          />
        </div>
      );

    case "markdown":
      return (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <Markdown className="prose-sm max-w-none">{node.content}</Markdown>
        </div>
      );

    case "table":
      return (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                {node.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "h-10 text-[11px] uppercase tracking-[0.1em] text-muted-foreground",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {node.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="border-border">
                  {node.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "py-3 text-sm text-foreground",
                        column.align === "right" && "text-right tabular-nums",
                      )}
                    >
                      {formatValue(row[column.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {node.caption && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {node.caption}
            </div>
          )}
        </div>
      );

    case "actions":
      return renderActions(node.actions, onAction);

    case "separator":
      return (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          {node.label && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {node.label}
            </span>
          )}
          <div className="h-px flex-1 bg-border" />
        </div>
      );

    case "stack":
      return (
        <div
          className={cn(
            "flex",
            node.direction === "row" ? "flex-row" : "flex-col",
            GAP_STYLES[node.gap ?? "md"],
            ALIGN_STYLES[node.align ?? "stretch"],
            node.wrap && "flex-wrap",
          )}
        >
          {node.children.map((child, index) => (
            <Fragment key={child.id ?? `${child.type}-${index}`}>
              {renderNode(child, onAction)}
            </Fragment>
          ))}
        </div>
      );

    case "grid":
      return (
        <div className={cn("grid", GRID_STYLES[node.columns ?? 2], GAP_STYLES[node.gap ?? "md"])}>
          {node.children.map((child, index) => (
            <Fragment key={child.id ?? `${child.type}-${index}`}>
              {renderNode(child, onAction)}
            </Fragment>
          ))}
        </div>
      );

    case "card":
      return (
        <Card variant="glass" className="border-border shadow-[var(--shadow-card)]">
          {(node.eyebrow || node.title || node.description || node.badge || node.actions) && (
            <CardHeader className="gap-2 p-4 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  {node.eyebrow && (
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {node.eyebrow}
                    </div>
                  )}
                  {node.title && <CardTitle className="text-base text-foreground">{node.title}</CardTitle>}
                  {node.description && (
                    <CardDescription className="text-muted-foreground">
                      {node.description}
                    </CardDescription>
                  )}
                </div>
                {node.badge && <Badge variant={node.badge.tone ?? "outline"}>{node.badge.label}</Badge>}
              </div>
              {node.actions && renderActions(node.actions, onAction)}
            </CardHeader>
          )}
          {node.children && node.children.length > 0 && (
            <CardContent className="space-y-4 p-4">
              {node.children.map((child, index) => (
                <Fragment key={child.id ?? `${child.type}-${index}`}>
                  {renderNode(child, onAction)}
                </Fragment>
              ))}
            </CardContent>
          )}
        </Card>
      );
  }
}

/**
 * OpenUIArtifactRenderer — contained renderer for OpenUI-like structured
 * artifact payloads using sandbox-ui primitives and theme tokens. This is an
 * extension surface for generated inspectors/results, not a replacement for
 * the sandbox shell.
 */
export function OpenUIArtifactRenderer({
  schema,
  onAction,
  className,
}: OpenUIArtifactRendererProps) {
  const nodes = Array.isArray(schema) ? schema : [schema];

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[16rem] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-card p-6 text-center",
          className,
        )}
      >
        <div className="space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
            <Minus className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium text-foreground">No structured artifact payload</div>
          <div className="text-sm text-muted-foreground">
            Pass an OpenUI-like schema to render dynamic result panels with sandbox-ui primitives.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {nodes.map((node, index) => (
        <Fragment key={node.id ?? `${node.type}-${index}`}>
          {renderNode(node, onAction)}
        </Fragment>
      ))}
      <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <ArrowRight className="h-3.5 w-3.5" />
        Structured artifact rendered through sandbox-ui primitives
      </div>
    </div>
  );
}
