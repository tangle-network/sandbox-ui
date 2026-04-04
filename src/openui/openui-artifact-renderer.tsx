import { Fragment, type ReactNode } from "react";
import { Minus } from "lucide-react";
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

type LooseRecord = Record<string, unknown>;

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

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeActionTone(value: unknown): OpenUIAction["tone"] {
  switch (value) {
    case "default":
    case "secondary":
    case "outline":
    case "ghost":
    case "destructive":
      return value;
    case "warning":
      return "secondary";
    default:
      return "outline";
  }
}

function normalizeBadgeTone(value: unknown): OpenUIBadgeNode["tone"] {
  switch (value) {
    case "default":
    case "secondary":
    case "success":
    case "warning":
    case "error":
    case "info":
    case "sandbox":
      return value;
    case "neutral":
    case "outline":
      return "secondary";
    default:
      return "default";
  }
}

function normalizeAction(value: unknown): OpenUIAction | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = asString(record.id) ?? asString(record.label);
  const label = asString(record.label) ?? asString(record.id);

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    tone: normalizeActionTone(record.tone ?? record.variant),
    disabled: Boolean(record.disabled),
  };
}

function normalizeKeyValueItems(value: unknown): OpenUIKeyValueNode["items"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .map((item, index) => {
      if (Array.isArray(item) && item.length >= 2) {
        return {
          id: `pair_${index}`,
          label: String(item[0]),
          value: item[1] as ReactNode | OpenUIPrimitive,
          tone: "default" as const,
        };
      }

      const record = asRecord(item);
      if (!record) return null;

      return {
        id: asString(record.id) ?? `pair_${index}`,
        label: asString(record.label) ?? asString(record.key) ?? `Item ${index + 1}`,
        value: (record.value ?? record.text) as ReactNode | OpenUIPrimitive,
        tone: record.tone === "muted" ? ("muted" as const) : ("default" as const),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return items.length > 0 ? items : null;
}

function normalizeTableColumns(value: unknown): OpenUITableNode["columns"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const columns = value
    .map((column, index) => {
      if (typeof column === "string") {
        return {
          key: `col_${index}`,
          header: column,
          align: "left" as const,
        };
      }

      const record = asRecord(column);
      if (!record) return null;

      return {
        key: asString(record.key) ?? `col_${index}`,
        header:
          asString(record.header) ??
          asString(record.label) ??
          asString(record.key) ??
          `Column ${index + 1}`,
        align: record.align === "right" ? ("right" as const) : ("left" as const),
      };
    })
    .filter((column): column is NonNullable<typeof column> => column !== null);

  return columns.length > 0 ? columns : null;
}

function normalizeTableRows(
  value: unknown,
  columns: OpenUITableNode["columns"],
): OpenUITableNode["rows"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows = value
    .map((row) => {
      if (Array.isArray(row)) {
        return Object.fromEntries(
          columns.map((column, index) => [column.key, row[index] as ReactNode | OpenUIPrimitive]),
        );
      }

      const record = asRecord(row);
      if (!record) return null;

      return Object.fromEntries(columns.map((column) => [column.key, record[column.key]]));
    })
    .filter((row): row is Record<string, ReactNode | OpenUIPrimitive> => row !== null);

  return rows.length > 0 ? rows : null;
}

function normalizeNode(node: OpenUIComponentNode): OpenUIComponentNode {
  const record = node as unknown as LooseRecord;

  switch (node.type) {
    case "badge":
      return {
        ...node,
        label: node.label ?? asString(record.text) ?? "Badge",
        tone: normalizeBadgeTone(node.tone ?? record.variant),
      };
    case "actions":
      return {
        ...node,
        actions:
          node.actions ??
          (Array.isArray(record.items)
            ? record.items
                .map((item) => normalizeAction(item))
                .filter((item): item is OpenUIAction => item !== null)
            : []),
      };
    case "key_value":
      return {
        ...node,
        items: node.items ?? normalizeKeyValueItems(record.pairs) ?? [],
      };
    case "table": {
      const columns = node.columns ?? normalizeTableColumns(record.columns) ?? [];
      return {
        ...node,
        columns,
        rows: node.rows ?? normalizeTableRows(record.rows, columns) ?? [],
      };
    }
    case "text":
      return {
        ...node,
        text: node.text ?? asString(record.content) ?? "",
      };
    case "heading":
      return {
        ...node,
        text: node.text ?? asString(record.title) ?? "",
      };
    case "card":
      return {
        ...node,
        title: node.title ?? asString(record.heading),
        description: node.description ?? asString(record.text),
        actions:
          node.actions ??
          (Array.isArray(record.items)
            ? record.items
                .map((item) => normalizeAction(item))
                .filter((item): item is OpenUIAction => item !== null)
            : undefined),
      };
    default:
      return node;
  }
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
  const normalized = normalizeNode(node);

  switch (normalized.type) {
    case "heading": {
      const level = normalized.level ?? 2;
      const HeadingTag = `h${level}` as const;

      return (
        <div className="space-y-1">
          {normalized.kicker && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {normalized.kicker}
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
            {normalized.text}
          </HeadingTag>
          {normalized.meta && <p className="text-sm text-muted-foreground">{normalized.meta}</p>}
        </div>
      );
    }

    case "text":
      return (
        <p
          className={cn(
            "text-sm leading-6 text-foreground",
            normalized.tone === "muted" && "text-muted-foreground",
            normalized.tone === "success" && "text-[var(--surface-success-text)]",
            normalized.tone === "warning" && "text-[var(--surface-warning-text)]",
            normalized.tone === "error" && "text-[var(--surface-danger-text)]",
            normalized.mono && "font-mono text-[13px]",
          )}
        >
          {normalized.text}
        </p>
      );

    case "badge":
      return <Badge variant={normalized.tone ?? "outline"}>{normalized.label}</Badge>;

    case "stat":
      return (
        <Card variant="glass" className="border-border shadow-[var(--shadow-card)]">
          <CardContent className="space-y-2 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {normalized.label}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {normalized.value}
            </div>
            {normalized.change && (
              <div
                className={cn(
                  "text-xs",
                  normalized.tone === "success" && "text-[var(--surface-success-text)]",
                  normalized.tone === "warning" && "text-[var(--surface-warning-text)]",
                  normalized.tone === "error" && "text-[var(--surface-danger-text)]",
                  normalized.tone === "info" && "text-[var(--surface-info-text)]",
                  !normalized.tone || normalized.tone === "default" ? "text-muted-foreground" : undefined,
                )}
              >
                {normalized.change}
              </div>
            )}
          </CardContent>
        </Card>
      );

    case "key_value":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          {normalized.items.map((item, index) => (
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
          {normalized.title && (
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {normalized.title}
            </div>
          )}
          <CodeBlock
            code={normalized.code}
            language={normalized.language}
            showLineNumbers={normalized.showLineNumbers}
            className="border-border bg-background"
          />
        </div>
      );

    case "markdown":
      return (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <Markdown className="prose-sm max-w-none">{normalized.content}</Markdown>
        </div>
      );

    case "table":
      return (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                {normalized.columns.map((column) => (
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
              {normalized.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="border-border">
                  {normalized.columns.map((column) => (
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
          {normalized.caption && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {normalized.caption}
            </div>
          )}
        </div>
      );

    case "actions":
      return renderActions(normalized.actions, onAction);

    case "separator":
      return (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          {normalized.label && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {normalized.label}
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
            normalized.direction === "row" ? "flex-row" : "flex-col",
            GAP_STYLES[normalized.gap ?? "md"],
            ALIGN_STYLES[normalized.align ?? "stretch"],
            normalized.wrap && "flex-wrap",
          )}
        >
          {normalized.children.map((child, index) => (
            <Fragment key={child.id ?? `${child.type}-${index}`}>
              {renderNode(child, onAction)}
            </Fragment>
          ))}
        </div>
      );

    case "grid":
      return (
        <div className={cn("grid", GRID_STYLES[normalized.columns ?? 2], GAP_STYLES[normalized.gap ?? "md"])}>
          {normalized.children.map((child, index) => (
            <Fragment key={child.id ?? `${child.type}-${index}`}>
              {renderNode(child, onAction)}
            </Fragment>
          ))}
        </div>
      );

    case "card":
      return (
        <Card variant="glass" className="border-border shadow-[var(--shadow-card)]">
          {(normalized.eyebrow || normalized.title || normalized.description || normalized.badge || normalized.actions) && (
            <CardHeader className="gap-2 p-4 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  {normalized.eyebrow && (
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {normalized.eyebrow}
                    </div>
                  )}
                  {normalized.title && <CardTitle className="text-base text-foreground">{normalized.title}</CardTitle>}
                  {normalized.description && (
                    <CardDescription className="text-muted-foreground">
                      {normalized.description}
                    </CardDescription>
                  )}
                </div>
                {normalized.badge && <Badge variant={normalized.badge.tone ?? "outline"}>{normalized.badge.label}</Badge>}
              </div>
              {normalized.actions && renderActions(normalized.actions, onAction)}
            </CardHeader>
          )}
          {normalized.children && normalized.children.length > 0 && (
            <CardContent className="space-y-4 p-4">
              {normalized.children.map((child, index) => (
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
    </div>
  );
}
