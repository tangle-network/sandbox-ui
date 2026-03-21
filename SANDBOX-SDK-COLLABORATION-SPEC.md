# Sandbox SDK Collaboration Spec

## Status

- Date: 2026-03-21
- Owner: Sandbox SDK + sandbox-ui
- UI readiness: partial
- SDK readiness: not started
- Goal: implementation-grade handoff

## Executive Summary

Add collaborative document editing to sandbox applications without making `sandbox-ui` orchestrator-specific and without forcing non-collaborative apps to carry extra complexity.

The final product model is:

- preview only
- preview + local edit
- preview + collaborative edit

All three modes should use the same document surface.

The architectural split is:

- `sandbox-ui` owns the document UI, preview/edit mode switching, presence UI, sync UI, and composition
- the sandbox SDK owns collaboration auth, document identity, transport bootstrapping, persistence, and workspace/file synchronization
- project/session realtime remains on the session gateway or equivalent pub/sub path
- Yjs/Hocuspocus is used only for collaborative document state and awareness

## Product Goals

- Give app teams one reusable document-editing surface.
- Support collaboration without creating a second UI architecture.
- Keep local editing as the default low-friction path.
- Make collaborative mode opt-in and secure by default.
- Preserve a clean migration path for GTM Agent, tax-filler-filer, and future sandbox SDK apps.

## Non-Goals

Not required for v1:

- collaborative chat draft composition
- collaborative terminal input
- CRDT-backed run streams
- full multiplayer workspace admin UI
- cross-document transactions
- shared whiteboard/canvas collaboration

## Current State

### Already Done In `sandbox-ui`

- Reusable document surface exists:
  - `/home/drew/code/sandbox-ui/src/editor/document-editor-pane.tsx`
- Local markdown WYSIWYG exists:
  - `/home/drew/code/sandbox-ui/src/editor/markdown-document-editor.tsx`
- Collaboration primitives exist:
  - `/home/drew/code/sandbox-ui/src/editor/editor-provider.tsx`
  - `/home/drew/code/sandbox-ui/src/editor/tiptap-editor.tsx`
  - `/home/drew/code/sandbox-ui/src/editor/use-editor.ts`
- Local vault editing exists in GTM:
  - `/home/drew/code/gtm-agent/src/routes/app.workspace.vault.tsx`
  - `/home/drew/code/gtm-agent/src/hooks/use-vault-browser.ts`
  - `/home/drew/code/gtm-agent/src/routes/api.vault.file.ts`

### Not Done Yet

- No collaboration token issuance in the sandbox SDK
- No stable document identity helper in the sandbox SDK
- No SDK bootstrap endpoint/contract for collaborative docs
- No SDK file bridge between CRDT state and sandbox filesystem
- No permission matrix for collaborative docs
- No production-ready reconnect/refresh flow for collab tokens

## Design Principles

- One document UI, multiple backends
- CRDT only where CRDT is actually needed
- Keep project/session events separate from document sync
- Make read/write authorization server-enforced
- Keep root package imports light; collaboration stays opt-in
- Prefer explicit contracts over app-specific glue

## Final Architecture

### Layer 1: UI

`sandbox-ui` provides:

- `DocumentEditorPane`
- `MarkdownDocumentEditor`
- `EditorProvider`
- `TiptapEditor`
- presence and sync indicators

The UI accepts either:

- `backend: "local"`
- `backend: "collaborative"`

### Layer 2: Document Collaboration Transport

Use Hocuspocus/Yjs for:

- document content
- awareness / collaborator presence
- cursor presence
- sync status

Do not use Yjs for:

- chat activity
- run streaming
- tool execution events
- terminal streams
- approvals

### Layer 3: Project/Session Realtime

Use the session gateway or equivalent project/session pub-sub for:

- active runs
- tool call activity
- file-write events
- runtime events
- approvals
- background session activity

### Layer 4: Filesystem Bridge

SDK/service layer bridges:

- CRDT document -> sandbox file write
- sandbox file change -> CRDT document update

This is not a `sandbox-ui` concern.

## Required Product Experience

Apps should be able to configure:

```ts
editor={{
  enabled: true,
  backend: "local" | "collaborative",
  collaboration?: {
    websocketUrl: string
    documentName: string
    token: string
    user: {
      userId: string
      name: string
      color?: string
    }
  }
}}
```

Expected UX behavior:

- preview works without editor dependencies
- local edit works without collaboration infrastructure
- collaborative edit shows presence and sync state
- read-only collaborative users can still preview and observe presence
- save snapshot is optional and app-controlled

## SDK API Surface

The current spec needs exact contracts. The SDK should expose the following.

### 1. Document Identity Helpers

New module:

- `src/collaboration/document-id.ts`

Exports:

```ts
export interface CollaborationDocumentRef {
  workspaceId: string;
  relativePath: string;
}

export function normalizeCollaborationPath(path: string): string;
export function buildCollaborationDocumentId(ref: CollaborationDocumentRef): string;
export function parseCollaborationDocumentId(documentId: string): CollaborationDocumentRef | null;
```

Required output format:

```txt
workspace:{workspaceId}:file:{normalizedRelativePath}
```

Rules:

- paths must be relative
- `/` separators only
- no `..`
- no null bytes
- preserve path casing as stored by the product unless the product defines a lowercasing policy
- document IDs must never expose host absolute paths

### 2. Collaboration Token Issuance

New auth types in:

- `src/auth/types.ts`
- `src/auth/tokens.ts`

New types:

```ts
export type CollaborationAccess = "read" | "write";

export interface CollaborationTokenPayload {
  sub: string;
  pid: string;
  projectId: string;
  documentId: string;
  access: CollaborationAccess;
  typ: "collaboration";
  iat: number;
  exp: number;
}

export interface IssueCollaborationTokenOptions {
  projectId: string;
  documentId: string;
  access: CollaborationAccess;
  userId: string;
  productId: string;
}
```

New function:

```ts
export function issueCollaborationToken(
  signingSecret: string,
  payload: Omit<CollaborationTokenPayload, "iat" | "exp" | "typ" | "sub" | "pid"> & {
    userId: string;
    productId: string;
  },
  ttlMinutes: number,
): string;
```

Requirements:

- short TTL, recommended 10-20 minutes
- refresh before expiry, recommended 60 seconds
- write access must come only from server authorization
- token downgrade must revoke future refreshes

### 3. Collaboration Bootstrap Contract

New SDK types:

- `src/collaboration/types.ts`

```ts
export interface CollaborationBootstrapRequest {
  workspaceId: string;
  relativePath: string;
}

export interface CollaborationBootstrapResponse {
  documentId: string;
  transport: {
    websocketUrl: string;
    token: string;
    expiresAt: number;
  };
  permissions: {
    access: "read" | "write";
    canSnapshot: boolean;
  };
  source: "crdt" | "filesystem";
  initialContent: string;
  snapshotVersion?: string;
}
```

Product/backend endpoint recommendation:

- `POST /api/collaboration/bootstrap`

Response semantics:

- if a persisted CRDT document exists, return `source: "crdt"`
- otherwise seed from current file content and return `source: "filesystem"`

### 4. Collaboration Snapshot Contract

Optional but recommended for markdown artifacts:

```ts
export interface SaveCollaborationSnapshotRequest {
  workspaceId: string;
  relativePath: string;
  documentId: string;
}

export interface SaveCollaborationSnapshotResponse {
  snapshotVersion: string;
  savedAt: string;
}
```

Recommended endpoint:

- `POST /api/collaboration/snapshot`

### 5. File Bridge Service

New SDK/service module:

- `src/collaboration/file-bridge.ts`

Responsibilities:

- bind document updates to sandbox writes
- bind sandbox file-change events back to Yjs updates
- debounce writes
- prevent loopback updates

Suggested interface:

```ts
export interface CollaborationFileBridgeOptions {
  documentId: string;
  relativePath: string;
  writeFile: (path: string, content: string) => Promise<void>;
  subscribeToFileEvents: (
    path: string,
    onChange: (event: CollaborationFileEvent) => void,
  ) => () => void;
}

export interface CollaborationFileEvent {
  path: string;
  type: "updated" | "deleted" | "renamed";
  content?: string;
  nextPath?: string;
  origin?: "agent" | "user" | "system";
  version?: string;
}
```

## Endpoint-Level Contract

This is the minimum backend API needed for product teams.

### `POST /api/collaboration/bootstrap`

Request:

```json
{
  "workspaceId": "ws_123",
  "relativePath": "system/operating-system.md"
}
```

Success response:

```json
{
  "documentId": "workspace:ws_123:file:system/operating-system.md",
  "transport": {
    "websocketUrl": "wss://collab.example.com",
    "token": "jwt",
    "expiresAt": 1774100000
  },
  "permissions": {
    "access": "write",
    "canSnapshot": true
  },
  "source": "filesystem",
  "initialContent": "# Operating System",
  "snapshotVersion": "docv_01"
}
```

Errors:

- `400` invalid path
- `401` unauthenticated
- `403` no access
- `404` workspace or file missing
- `409` file deleted during bootstrap

### `POST /api/collaboration/token`

Request:

```json
{
  "workspaceId": "ws_123",
  "documentId": "workspace:ws_123:file:system/operating-system.md"
}
```

Response:

```json
{
  "token": "jwt",
  "expiresAt": 1774100000,
  "access": "write"
}
```

### `POST /api/collaboration/snapshot`

Request:

```json
{
  "workspaceId": "ws_123",
  "relativePath": "system/operating-system.md",
  "documentId": "workspace:ws_123:file:system/operating-system.md"
}
```

Response:

```json
{
  "snapshotVersion": "docv_02",
  "savedAt": "2026-03-21T18:34:20.000Z"
}
```

## Permission Model

Minimum roles:

- `owner`
- `editor`
- `viewer`

Minimum document access:

- `none`
- `read`
- `write`

### Permission Matrix

| Role | Preview | Local Edit | Collaborative Read | Collaborative Write | Save Snapshot | Invite |
|------|---------|------------|--------------------|---------------------|---------------|--------|
| owner | yes | yes | yes | yes | yes | yes |
| editor | yes | yes | yes | yes | product-defined | product-defined |
| viewer | yes | no | yes | no | no | no |

Rules:

- UI must treat token access as authoritative for collaborative write
- app-local mode toggles cannot elevate access
- preview-only path should still work if collaboration is unavailable

## Bootstrap And Source Of Truth Rules

This is one of the biggest missing pieces in the original spec.

### On First Open

- if persisted CRDT state exists:
  - hydrate from CRDT
  - return `source: "crdt"`
- else:
  - read sandbox file
  - initialize CRDT document from file content
  - return `source: "filesystem"`

### On Divergence

If CRDT persisted state and file content differ:

- CRDT wins for collaborative document state
- filesystem is reconciled by the file bridge
- backend should log divergence
- product may expose “resync from file” as an admin or recovery action later

### On Deleted File

- collaborative doc becomes read-only recovery state until resolved
- UI should surface deletion clearly
- backend must not silently recreate unless product explicitly opts into that behavior

## File Bridge Rules

### CRDT -> File

- debounce writes, recommended 300-750ms
- include version or origin metadata if possible
- mark writes as local bridge writes to avoid echo loops

### File -> CRDT

- agent writes and tool writes must update the collaborative doc
- if the bridge just wrote the same content, ignore the echo
- if file was externally rewritten with different content, apply to Yjs as external origin

### Rename/Delete

Rename:

- issue new document identity only if product chooses rename-as-new-document
- otherwise update path binding while preserving document ID mapping metadata

Delete:

- unbind file bridge
- mark collaborative session read-only
- notify clients through project/session events

## Realtime Model

### Document Transport

Hocuspocus/Yjs handles:

- text changes
- collaborator presence
- awareness state
- cursor positions

### Project/Session Realtime

Session gateway handles:

- run lifecycle
- tool calls
- file-write notifications
- approvals
- background activity
- archive/delete/rename events

Recommended channel strategy:

- project channel for workspace-wide events
- session channel for session/run events
- collaboration server connection for document state only

## Failure And Reconnect Semantics

### Collaboration Server Down

- preview still works
- local edit still works if app supports fallback
- collaborative mode degrades to read-only or local-draft fallback, product choice
- UI must surface degraded state

### Token Expiring

- refresh token before expiry, recommended buffer 60 seconds
- if refresh fails:
  - collaborative doc becomes read-only
  - show reconnect action

### Offline/Reconnection

- preserve unsynced local edits only if local-draft mode is active
- collaborative mode should rely on Yjs local state while reconnecting
- after reconnect, apply normal Yjs merge behavior

## Security Requirements

- document IDs must not expose absolute paths
- collaboration tokens must be scoped to one document and one project
- read tokens must not be able to write
- write permission must be server-validated on every bootstrap/refresh
- file bridge must refuse paths outside workspace scope
- cross-workspace document access must fail closed

## Dependencies

### Existing `sandbox-ui` Dependencies

- `@hocuspocus/provider`
- `@tiptap/core`
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/extension-collaboration`
- `@tiptap/extension-collaboration-cursor`
- `yjs`

### Additional SDK-Side Dependencies

Recommended:

- none required for token issuance beyond existing `node:crypto`
- collaboration transport client can stay browser-native if it only returns config
- if SDK itself grows direct collaboration helpers, add Yjs/Hocuspocus only in a dedicated subpath

Constraint:

- do not force core SDK consumers to install collaboration runtime deps unless they use collaboration features

## Repo Organization Updates

### `sandbox-ui`

Already present:

- `/home/drew/code/sandbox-ui/src/editor/document-editor-pane.tsx`
- `/home/drew/code/sandbox-ui/src/editor/markdown-document-editor.tsx`
- `/home/drew/code/sandbox-ui/src/editor/editor-provider.tsx`
- `/home/drew/code/sandbox-ui/src/editor/tiptap-editor.tsx`

Recommended next cleanup:

- keep collaboration-capable surfaces under `/editor`
- keep root `index.ts` free of collaboration-heavy exports
- keep file/artifact wrappers collaboration-agnostic

### `@tangle-network/sandbox`

Recommended new structure:

- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/index.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/types.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/document-id.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/bootstrap.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/file-bridge.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/snapshot.ts`

Auth updates:

- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/auth/types.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/auth/tokens.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/auth/index.ts`

Exports updates:

- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/index.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/package.json`

Docs updates:

- `/home/drew/code/agent-dev-container/products/sandbox/sdk/README.md`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/DESIGN.md`

Tests:

- `/home/drew/code/agent-dev-container/products/sandbox/sdk/tests/unit/collaboration/*.test.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/tests/e2e/collaboration/*.test.ts`

## Expected Files Touched

### `sandbox-ui`

- `/home/drew/code/sandbox-ui/src/editor/index.ts`
- `/home/drew/code/sandbox-ui/src/editor/document-editor-pane.tsx`
- `/home/drew/code/sandbox-ui/src/editor/editor-provider.tsx`
- `/home/drew/code/sandbox-ui/src/editor/tiptap-editor.tsx`
- `/home/drew/code/sandbox-ui/README.md`

### SDK

- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/auth/types.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/auth/tokens.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/auth/index.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/index.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/types.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/index.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/types.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/document-id.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/bootstrap.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/file-bridge.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/src/collaboration/snapshot.ts`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/README.md`
- `/home/drew/code/agent-dev-container/products/sandbox/sdk/DESIGN.md`

## Milestones

### Milestone 0: Contract Lock

Deliverables:

- approve this spec
- agree on document ID format
- agree on token claims and TTL
- agree on bootstrap endpoint

Exit criteria:

- no unresolved contract questions

### Milestone 1: SDK Auth And Types

Deliverables:

- collaboration token payload types
- token issuance helper
- collaboration module exports

Exit criteria:

- unit tests for token encode/decode
- exported types stable

### Milestone 2: Bootstrap Path

Deliverables:

- bootstrap endpoint or product-facing contract
- document ID generation helper
- initial content bootstrap
- refresh token contract

Exit criteria:

- client can open a document in collaborative mode with valid config

### Milestone 3: File Bridge

Deliverables:

- CRDT -> file write path
- file event -> CRDT update path
- loop prevention
- rename/delete handling

Exit criteria:

- human edits and agent file writes stay in sync

### Milestone 4: Product Adoption

Deliverables:

- GTM vault uses `DocumentEditorPane` with `backend="collaborative"`
- feature flag for collaborative mode
- graceful fallback to local edit

Exit criteria:

- one real app uses the full stack successfully

### Milestone 5: Multiplayer Enhancements

Deliverables:

- invites
- follow/watch mode
- project presence
- richer access controls

Exit criteria:

- collaborative workspace story beyond single shared docs

## Checklist

### Contract

- define `CollaborationTokenPayload`
- define bootstrap request/response
- define snapshot request/response
- define file event payloads
- define document ID normalization rules

### SDK

- add `src/collaboration/`
- add auth helpers
- export collaboration subpath or root-safe exports
- document dependency model

### Backend/Product

- add bootstrap endpoint
- add token refresh endpoint
- add snapshot endpoint
- add permission checks
- add workspace path validation

### Sync

- implement CRDT -> file writes
- implement file -> CRDT writes
- add loop prevention
- handle rename/delete

### UX

- surface sync state
- surface collaborator list
- handle read-only mode
- handle server unavailable mode
- handle token expiry/reconnect

### Testing

- unit: token issuance
- unit: document ID helpers
- unit: file bridge loop prevention
- integration: bootstrap + connect
- integration: read-only collaborator
- integration: reconnect after expiry
- integration: agent writes during human editing
- integration: delete/rename behavior

## Acceptance Tests

Minimum acceptance tests before calling the spec implemented:

1. Two users edit the same markdown document concurrently and both see merged content.
2. A viewer can open the same document, see presence, and cannot write.
3. A token expiry refresh happens without dropping the session.
4. An agent/tool rewrites the underlying file and the collaborative document updates.
5. A human edit writes back to the sandbox file after debounce.
6. A deleted file causes the document to degrade safely.
7. A document in another workspace cannot be bootstrapped with the wrong token.
8. Local edit fallback still works when collaboration is unavailable.

## Reusability And Modularity Requirements

- collaboration UI stays in `sandbox-ui/editor`
- file viewers stay usable without collaboration
- SDK collaboration code lives in a dedicated `src/collaboration/` module
- token helpers live in `src/auth/`, not inside app code
- file bridge is isolated from UI and can be tested headlessly
- products can adopt bootstrap/token endpoints without adopting the full multiplayer roadmap

## What Remains To Finish

The original spec is complete as an architecture note after this update, but implementation still remains in the SDK.

The next concrete step is Milestone 1:

- add SDK collaboration types
- add collaboration token issuance
- add document ID helpers

After that, the bootstrap contract can be implemented against one real app, ideally GTM Agent first.
