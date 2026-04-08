# Sandbox UI Design Direction

## Product Context

This library sits under multiple products with different user profiles:

- Technical: Sandbox SDK, Blueprint Agent, Browser Agent, Code Auditor
- Mixed/prosumer: Tax Agent
- Eventually white-labeled or partner-facing surfaces

The shared UI should not behave like a generic chat skin. The product moat, based on current GTM materials, is visible execution: orchestrator + sidecar + secure sandbox runtime. The UI should make that runtime legible, trustworthy, and pleasant to use.

This is a sandbox UI system first. Agent chat is one major surface inside that system, alongside files, terminals, tool activity, previews, audits, editors, and workspace controls.

## Core Conclusion

The right center of gravity is:

- Sandbox-first
- Agent-capable
- Artifact-forward
- Workspace-capable
- Themeable by product and audience

The wrong center of gravity is:

- Single-brand dark theme everywhere
- Modal-heavy file access
- Treating tools, files, and runs as secondary debug output

## What To Learn From Open WebUI

Open WebUI is worth studying for product structure more than visual originality.

Patterns worth adopting:

- Sidebar as a true workspace, not only a chat list
- Folders/projects as reusable context containers
- Rich note/editor workflows with AI side panels
- File search and reusable knowledge attachments
- Pane-based layouts for chat + editor + side content
- Support for different density levels, themes, and user preferences

Patterns to avoid copying directly:

- Admin-heavy information density in core chat surfaces
- File management hidden behind generic modals
- Inconsistent visual system caused by long-lived feature accretion
- Theme overrides layered on top of brittle selectors

## Recommended Shared Component Model

Build the library around a few high-value shells instead of many disconnected widgets.

### 1. Sandbox Workspace Shell

The default product shell for sandbox applications.

Should support:

- Left rail for project/files/context
- Center surface for agent chat, task flow, or structured workspace content
- Right artifact pane for file/document/code/preview
- Optional bottom runtime pane for terminal/logs/tests
- Resizable panes
- Persisted pane state
- URL-addressable state for selected file, tab, panel visibility

### 2. Agent Timeline

A first-class timeline that merges:

- assistant text
- tool invocations
- approvals
- file writes
- command output
- warnings/errors
- completion summaries

Tool activity should read like part of the answer, not like a separate debug stream.

This timeline is essential for agent-backed sandboxes, but it should be optional for non-chat sandbox surfaces.

### 3. Artifact System

Treat files, notes, markdown, PDFs, tables, and code as artifacts with one shared model:

- metadata header
- tabs/history
- comments or annotations later
- open in split view
- open from tool result, chat mention, or file tree

### 4. Agent Composer

A shared prompt composer that can scale from consumer to operator mode:

- message input
- attachments
- model/context chips
- run controls
- optional rich text mode
- quick actions for common tools

### 5. Navigation Primitives

Provide opinionated primitives for:

- project/folder tree
- file tree
- recents
- context chips
- saved views

### 6. Sandbox Runtime Surfaces

Provide shared components for:

- terminal sessions
- command output
- status banners and runtime state
- audit/results panels
- environment/session metadata
- approval and interruption controls

## Theme Strategy

Current styling is too product-specific for a shared library.

Recommended theme layers:

1. Foundation tokens
   - neutrals, spacing, radii, motion, typography, elevation
2. Semantic tokens
   - surface, panel, accent, success, warning, danger, code, selection
3. Product themes
   - default dark
   - `vault` (light)
4. Density modes
   - `comfortable`
   - `compact`

The technical apps should feel precise and information-dense.
The less technical apps should feel calmer, more guided, and less terminal-like.

## Immediate Gaps In The Current Library

### Visual System

- Two token systems coexist (`tokens.css` and `globals.css`)
- The brand is locked to purple/dark assumptions
- Font strategy is inconsistent and partially embedded in the library

### Workspace

- The workspace shell is fixed-width, not resizable
- Panel state is local-only and not URL/persistence aware
- The shell does not yet model artifact-first flows

### Files

- File preview is much less capable than its API comment suggests
- Markdown is not rendered as a true document in file preview
- CSV parsing is naive
- PDF handling is basic iframe fallback only

### Agent Chat And Tooling

- Tool calls are visually separate from the main answer
- Command output works as a debug card, not as a polished execution narrative
- Composer ergonomics are serviceable but not premium

### Sandbox Runtime

- Runtime surfaces exist, but they are not yet unified into one coherent sandbox operating model
- Terminal, files, tool previews, and status components feel adjacent rather than designed as one system

### Accessibility / UX Basics

- Several icon-only buttons need labels
- Focus treatment is inconsistent
- Some copy uses hardcoded shortcut hints and placeholder patterns

## Suggested Implementation Order

### Phase 1: Foundation

- unify tokens
- define semantic themes
- remove product-specific font/network assumptions from the library
- introduce density and panel sizing primitives

### Phase 2: Core Agent Surfaces

- rebuild `WorkspaceLayout` as a resizable sandbox shell
- create `AgentTimeline`
- create `ArtifactPane`
- rebuild `ChatInput` into a stronger shared composer
- unify terminal, status, and command surfaces into one runtime layer

### Phase 3: Document / File Excellence

- real markdown document viewer
- proper code viewer with syntax highlighting and line actions
- robust CSV/table viewer
- richer PDF viewer controls
- shared artifact header and tab model

### Phase 4: Product Variants

- default dark theme for sandbox/devtools
- vault light theme for professional/enterprise contexts
- white-label hooks for partner products

## High-Priority Fixes Before Bigger Refactors

- Add `aria-label` to icon-only controls
- Replace `outline-none` patterns with visible focus states
- Fix placeholder/copy consistency
- Stop claiming unsupported preview capabilities in component docs
- Sanitize or replace custom markdown rendering paths where needed
