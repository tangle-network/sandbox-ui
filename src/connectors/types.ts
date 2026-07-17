/** One invokable action a connector exposes (the platform's hub tool shape, decoupled from any client). */
export interface ConnectorAction {
  path: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  risk?: "read" | "write" | "destructive" | "unknown";
}

/** One row in the connector catalog browse list. */
export interface ConnectorCatalogEntry {
  providerId: string;
  title: string;
  category?: string | null;
  categoryLabel?: string | null; // display label the host resolved
  authKind?: string | null;
  authKindLabel?: string | null; // display label the host resolved
  actionCount?: number | null;
  triggerCount?: number | null;
  connected?: boolean;
}
