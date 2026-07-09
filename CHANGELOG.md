# Changelog

## 0.73.0

### Styles

- `globals.css` gains a self-contained, token-driven `.tangle-prose` ruleset
  (headings, lists, links, blockquote, `hr`, inline code, `pre`, and a
  `border-collapse` table grid). The `Markdown` renderer emits a `tangle-prose`
  surface but this library ships no `@tailwindcss/typography`, so structured
  markdown was unstyled in consumers that source prose CSS solely from
  `@tangle-network/sandbox-ui/styles`. Mirrors `@tangle-network/brand`'s
  `globals.css` so prose styling ships from a single sandbox-ui import; brand's
  `@layer base`/`utilities` are intentionally not imported wholesale (they carry
  glow chrome this library flattens for Tangle Quiet) (#169).

### CI

- Pin npm to `11.18.0` in `release.yml`. npm `12.0.0` broke
  `npm publish --provenance` with `Cannot find module 'sigstore'`; `11.18.0` is
  the last known-good (>= 11.5.1 for OIDC) (#169).

## 0.72.0

### Dependencies

- Bump `@tangle-network/ui` to `^11.0.0` and `@tangle-network/brand` to `^1.0.0`:
  transcript spacing, markdown tables, remaining WCAG AA (#168).

## 0.71.0

### Chat

- `AgentSessionControls` gains a third `layout` variant, `"combined"`: a single
  labeled trigger that collapses the harness / model / effort pickers behind one
  container-less control (Codex-style), summarizing the current selection as
  icon-prefixed `harness · model · effort`. Each segment carries its picker's own
  glyph — harness logo, model brand stack, and the reasoning glyph (Sparkles for
  Auto, bar-meter for a level). The nested Harness / Model / Effort sections reuse
  the same picker nodes as the other layouts, so the harness→model snap and
  effort re-clamp coherence is inherited. Exports `ReasoningGlyph`,
  `ModelBrandStack`, and `stripBrandPrefix` for building the summary (#166).

## 0.70.0

### Dependencies

- Bump `@tangle-network/ui` to `^9.0.0`: `RunGroup` renders as separated spine
  rows with collapse (no single box) and `AgentTimeline` reverts to its flat
  separated rendering (#165).

## 0.69.0

### Dependencies

- Bump `@tangle-network/ui` to `^8.1.0`: `AgentTimeline` now folds consecutive
  tool activity into the shared `AssistantRunShell` collapsible run shell that
  `RunGroup` uses (additive, default on) (#164).

## 0.68.0

### Dependencies

- **Breaking:** adopt `@tangle-network/ui@8` + `@tangle-network/brand@0.8`. ui@8
  removes `ChatInput`/`ChatInputProps`/`PendingFile` (`ChatContainer` is
  transcript-only; `AgentComposer` is the one composer), so `src/chat` stops
  re-exporting them (#163).

## 0.67.0

### Dependencies

- Bump `@tangle-network/ui` to `^6.0.0` and `@tangle-network/brand` to `^0.7.0`;
  widen `peerDependencies` to accept them (ui `^5.1.0 || ^6.0.0`, brand
  `^0.6.0 || ^0.7.0`) so consumers can move to the ui@6 set without a lockstep
  upgrade. Dependency-only major, no API changes (#162).

## 0.66.0

### Dashboard

- `RailExpandableSubItem` gains an optional `unread` flag: an unread row renders
  a leading dot and a bolded, un-muted label. Suppressed while `isLoading` (the
  shimmer stays the sole "responding" cue) and on the active row you're already
  viewing. Covers both the labeled accordion and the collapsed-rail flyout via
  the shared sub-item row (#160).

## 0.65.0

### Chat

- Reasoning-effort options are now reconciled per harness. A new
  `HARNESS_REASONING_OPTIONS` export overrides the generic depth ladder for
  harnesses whose real control isn't a gradient — `kimi-code`'s binary thinking
  toggle reads Auto / No thinking / Thinking instead of a misleading five-step
  scale. The picker still intersects options with the harness/model `available`
  set, so only supported values render (#158).
- The default `xhigh`/`ultracode` descriptions drop their tool-specific
  parentheticals (#158).

## 0.64.0

### Dashboard

- `RailExpandableSubItem` gains an optional `actions` array that renders a
  hover-revealed kebab menu on labeled-rail rows (e.g. rename/delete); the
  collapsed-rail flyout keeps plain links and is unaffected (#156).
- The `emphasis` "view all" sub-item is now a quiet padded accent link
  (underline on hover) instead of a filled pill, sitting inline with the other
  rows (#156).
- The `isLoading` indicator drops the trailing three-dot ellipsis; the
  gradient-shimmer label is strengthened and is now the sole "responding" cue,
  still respecting `prefers-reduced-motion` (#156).

## 0.63.0

### Dashboard

- Expandable rail rows keep their own icon at rest (open or collapsed); the
  chevron now reveals only on hover, rotated down when open (#152).
- `RailExpandableSubItem` gains an optional `emphasis` flag (bold + accent) for a
  stand-out trailing action (e.g. a "view all" row), and sub-item rows are
  tighter — height `h-8` → `h-7` (#152).
- `RailExpandable` and `SidebarLayoutNavItem` gain an opt-in `defaultOpen` to
  start an expandable item expanded on mount (#154).

### Chat

- A locked harness now shows an informative popover explaining the lock, with a
  fork-to-switch action (#153).

## 0.61.0

### Dashboard

- `RailExpandableSubItem` gains an optional `isLoading` flag that renders a live
  "responding" indicator on the row — a gradient-shimmer label plus a trailing
  three-dot ellipsis, both respecting `prefers-reduced-motion` (#146).

## 0.58.0

### Harness↔model policy sourced from `@tangle-network/agent-interface`

- The chat pickers' harness↔model compatibility and snapping now delegate to
  `@tangle-network/agent-interface` — the single source of truth shared with the
  cli-bridge backends — instead of a local copy. Requires
  `@tangle-network/agent-interface >=0.15.0`.
- `isModelCompatibleWithHarness`, `modelProvider`, `snapHarnessToModel`, and
  `snapModelToHarness` are unchanged in name and signature. The internal
  `HARNESS_MODEL_POLICIES` table is no longer exported (it had no consumers).
- `nanoclaw` is now treated as router-backed (runs any model), matching the
  canonical policy.

### Fixes

- Dashboard: show the full wordmark in the expanded rail (#141).

## 0.57.0

### `AgentSessionControls`: control inline menu placement

- **`AgentSessionControls` gains `menuPlacement?: "auto" | "down"`** (default
  `"auto"`). `"auto"` keeps Radix's collision-aware behavior — the inline
  pickers open downward but flip up when the composer is docked at the bottom of
  the viewport. `"down"` pins them open downward, for a composer floating in open
  space (e.g. a centered new-chat surface) where flipping up would cover the
  heading. Only affects the `"inline"` layout; the gear menu is unchanged.
- **`ModelPicker` and `ReasoningLevelPicker` gain `side` + `avoidCollisions`**
  props, forwarded to their Radix content, so callers can pin menu direction.
  `HarnessDropdown` (internal) likewise honors `avoidCollisions`.
- **Picker menus now cap to the available viewport height and scroll** (via
  Radix's `--radix-dropdown-menu-content-available-height`), so a tall list
  pinned downward from a floating composer never runs off the bottom edge.
- Backward compatible: omitting the new props reproduces the prior behavior
  exactly.

## 0.56.0

### Workflows: raw node config for the full-detail view

- **`WfNodeData.config`** — workflow graph nodes (actions and triggers) now carry
  the raw, untruncated config alongside the compact `detail` map, so a full-detail
  drawer can render every field without the card-sized clamp `detail` applies. It
  is a JSON-safe deep copy of the config (cycles and non-JSON values normalized,
  so it is always serializable) and is omitted when a node has no config.

## 0.55.0

### Assistant panel: composer model picker + full-panel conversation history

- **Model picker in the composer** — the assistant's `ModelPicker` now sits
  directly above the `ChatInput`, so the model the next turn will use reads as
  part of the composer instead of in a separate header toolbar. The text-size
  control moves to the header action row.
- **Full-panel conversation history** — a new `AssistantHistory` view replaces the
  header dropdown with a searchable, recency-sorted list showing each
  conversation's title and relative last-active time, with inline delete. The
  header's history button toggles the view; selecting a thread, sending a message,
  or pressing Escape returns to the conversation. Transcript zoom and live-log
  semantics apply to the chat view only.

## 0.53.0

### Sidebar redesign: unified rail header, expandable/primary nav items, account-menu appearance

A ground-up rework of the dashboard rail, shared by both `SidebarLayout` and
`DashboardLayout` so the two app shells render the same redesigned sidebar.

- **New `RailHeader`** — a three-slot header: brand mark (left), optional middle
  content (e.g. a project switcher), and a dedicated panel-toggle button (right).
  When the rail is collapsed it shows only the brand mark, which morphs into the
  expand button on hover, so the collapse affordance is discoverable without
  spending rail width. Replaces the old "logo doubles as the collapse control"
  interaction in `DashboardLayout` and the footer/​header `RailCollapseToggle` in
  `SidebarLayout`.
- **Primary nav items** — `RailButton` gains `variant="primary"` (and
  `SidebarLayoutNavItem.variant`) for an emphasized pill that stands out from the
  rest of the nav, e.g. a "New" action.
- **New `RailExpandable`** — a nav item that reveals sub-items: an inline
  accordion on the labeled rail (the leading icon morphs into a chevron on hover;
  the row label still navigates via `href`) and a hover flyout on the icon-only
  rail. Sub-items can be fixed (`subItems`) or lazy-loaded (`loadSubItems`, with a
  loading skeleton). `SidebarLayoutNavItem` gains `expandable`, `subItems`,
  `loadSubItems`, `subActiveIds`, and `emptyLabel`.
- **Appearance in the account menu** — `ProfileAvatar` (and both layouts) accept an
  `appearance` controller (`{ value, onChange, modes? }`). It renders a single
  "Appearance" row showing the current theme (e.g. "System (Light)"); hovering it
  opens a submenu with Light / Dark / System and a check on the active mode (à la
  Claude / ChatGPT). The control is theme-engine-agnostic — each host wires it to
  its own theme hook. The standalone rail theme toggle is no longer rendered.
- **`SidebarLayout`** — removed the `showThemeToggle` and `railCollapseToggle`
  props (superseded by `appearance` and the always-in-header toggle). Added
  `appearance`.
- **`DashboardLayout`** — `onLogoClick`/`logoAriaLabel` are deprecated and inert
  (the header now has a dedicated toggle). Added `appearance`.
- New exports from `./dashboard`: `RailHeader`, `RailExpandable`,
  `RailExpandableSubItem`, `RailHeaderProps`, `RailExpandableProps`, `ThemeMode`,
  `AppearanceController`.
- **Deprecations** (still exported, no longer used by the layouts): `RailThemeToggle`
  (superseded by the account-menu `appearance` control) and `SidebarRailHeader`
  (superseded by `RailHeader`).
- **Active item = primary.** The nav item whose route matches the current page
  now renders with the emphasized "primary" look (accent fill + accent ring), so
  the current destination clearly stands out; items are otherwise the default
  style. `RailButton variant="primary"` still forces the look for non-route items.
- **Collapsed-rail tooltips and expandable flyouts are portaled** to `<body>`, so
  they're no longer clipped by the rail's scroll-overflow. The collapsed flyout
  opens on hover with a small close-delay across the trigger→flyout gap, is capped
  to the available viewport space (anchoring upward when the item is near the
  bottom, e.g. a History entry), and scrolls internally so a long list never runs
  off-screen.
- **Click-to-expand:** clicking the empty body of a collapsed rail expands it
  (`SidebarRailNav` gained an `onClick` passthrough; layouts guard on
  `target === currentTarget`).
- The header panel toggle uses the **same panel glyph** in both states.
- `DashboardLayout` no longer renders a Settings nav item in the rail footer —
  Settings lives in the account menu; the footer is just the account avatar.

## 0.51.0

### Assistant panel: searchable model picker, working text-size control, floating history

- The assistant's model selector is now the searchable, brand-aware `ModelPicker`
  (the same component used on the dashboard) instead of a native `<select>`. The
  assistant catalog (`slug` + `label`, optional context window) is mapped onto the
  picker's wire shape; the slug doubles as the canonical value. Searching,
  grouping by lab, recommended models, and provider logos come for free.
- The A−/A+ text-size control now actually scales the transcript. It applies a CSS
  `zoom` on the conversation container, which scales every descendant uniformly
  regardless of the renderer or its font-size utilities — the previous inline
  `font-size` had no effect because the transcript's text utilities set their own
  absolute `rem` sizes and ignored the inherited value.
- Chat history is now an elevated dropdown that floats over the conversation
  (rounded, shadowed, on `surface-container-highest`) and is dismissed by an
  outside press, instead of an inline block that pushed the conversation down with
  little contrast.
- Header/toolbar polish: a dedicated toolbar row groups the model picker and a
  segmented text-size control; the title bar keeps the conversation-level actions
  (history, new chat, close) with consistent hover affordances.

## 0.47.0

### Integrations panel: account identity, disconnect dialog, uniform tiles, platform logos

- **Breaking — `IntegrationConnection.account` removed.** The aspirational
  nested `account?: { identity?; displayName? }` field is replaced with the real
  platform-hub wire field `accountDisplay?: string | null`. The old shape was
  never populated in production. Migration: read `connection.accountDisplay`
  instead of `connection.account?.displayName`.
- Connected tiles now show which account is linked (`accountDisplay`) under the
  provider name.
- The disconnect control is an always-visible, labelled button that opens a
  confirmation dialog with a loading state and inline error; it is always
  dismissable, so a hung `onDisconnect` can no longer trap the user.
- Uniform tile sizing across breakpoints (fixed two-line label height, unified
  logo size).
- Provider logos resolve from the platform's ActivePieces source
  (`cdn.activepieces.com/pieces/<id>.png` plus pinned overrides), with a
  simpleicons slug and a monogram as fallbacks. Consumers under a strict CSP
  should allowlist `cdn.activepieces.com` (and `cdn.simpleicons.org`) under
  `img-src`; logos otherwise degrade to the monogram.

## 0.42.0

### Dashboard labeled rail: collapsible + polished expanded state

- `DashboardLayout`: the labeled rail (`labeledRail`) gains a discoverable
  collapse control (`RailCollapseToggle`) in the rail footer — a labeled
  "Collapse" row when expanded, an "Expand" chevron when collapsed. Shown only
  on the desktop rail; the mobile drawer is always labeled and does not collapse.
- New `defaultRailCollapsed` prop, forwarded to `SidebarProvider`, so a consumer
  can start on the compact icon rail (the choice then persists to localStorage).
  Defaults to expanded, so existing consumers are unaffected.
- Expanded-rail styling now matches `SidebarLayout`: a `px-2` nav gutter (no more
  edge-to-edge rows), an `items-stretch px-2` footer, a labeled profile row
  (`showDetails`), full-width separators, and a left-aligned logo.

## 0.37.1

### Dashboard labeled-rail nav alignment

- `DashboardLayout`: nav link items and the settings link on the labeled rail
  now render as full-width rows on the anchor (`RailButton asChild`), matching
  `SidebarLayout`. Previously they wrapped `<Link><RailButton/></Link>`, which
  left the anchor width-less inside the `items-center` rail nav — every item
  shrank to its label width and centered, so active and inactive items sat at
  different widths/offsets (visible misalignment / active-item offset). Removes
  the nested `<button>` inside the anchor at the same time. Fixes the sidebar
  misalignment reported on narrow/tall and standard desktop rails.

## 0.23.2

### Sidebar rail scroll + shared theme toggle

- `SidebarLayout` / rail: the rail nav now scrolls when there are more items
  than fit the viewport height, instead of compressing the items or pushing the
  profile footer off-screen. `SidebarRailNav` is `overflow-y-auto min-h-0`,
  `RailButton` is `shrink-0`, and the header/footer are pinned (`shrink-0`) — so
  the logo stays on top and the profile (settings / sign-out) stays reachable at
  the bottom on short screens.
- `SidebarLayout`: new `showThemeToggle` prop renders a compact light/dark
  switch (`RailThemeToggle`) in the rail footer beside the profile avatar,
  driven by the shared `useTheme` hook — so apps get one consistent theme
  control instead of hand-rolling their own. The footer shows the user's name
  only (the email stays in the profile dropdown) to leave room for the toggle.
  The toggle is SSR-safe (a `mounted` guard avoids a theme-dependent hydration
  mismatch).

## 0.23.1

### `assets` module

- `assets`: restores the asset-studio component set under the
  `@tangle-network/sandbox-ui/assets` entry point — `ApprovalQueue`,
  `AssetCard`, `AssetEditor`, `VariantCompare`, and the `EmailPreview` /
  `ImagePreview` / `VideoPreview` / `CopyPreview` previews — with the same API
  as 0.22.0. The marketing-asset domain types the components use are vendored
  into the module (`assets/types`), so the package takes no new runtime
  dependency.

## 0.23.0

### `SidebarLayout` (dashboard) + SSR-safe sidebar core

- `dashboard`: new `SidebarLayout` — a top-nav-less app shell built on the
  sidebar rail + slide-out panel, configured by data (nav items, panel
  content, profile/branding) so consumer apps don't hand-roll or re-style
  their own rail. Options: `railLabels` (labeled rail vs. 64px icon-only),
  `closePanelOnNavigate` (close a section-contextual panel on link nav),
  `hideBelow` (responsive hide), plus an account-section divider.
- `SidebarProvider`: optional controlled `panelOpen` / `onPanelOpenChange`.
  When provided the provider never touches `localStorage`, so SSR apps can
  seed the panel from a cookie and avoid the React 19 hydration mismatch that
  left a persisted-open panel stuck closed after reload. The uncontrolled
  `localStorage` path is unchanged.
- `SidebarProvider`: `switchMode` no longer nests `setState` inside the
  `setModeState` updater — fixes the same-mode double-toggle where React's
  eager-bailout ran the nested toggle twice and cancelled it.
- `RailButton`: new `asChild` (via `cloneElement`) renders the rail-button
  styling onto a child link, so nav items stay real anchors without copying
  the class recipe or nesting `<a><button>`. New configurable `railWidth`
  (default 64) backs the labeled rail.
- `ProfileAvatar`: new `showDetails` renders the name/email beside the avatar
  for a labeled rail footer.
- All new props are optional and default to existing behavior; `DashboardLayout`
  and the icon-only rail are unchanged.

## 0.22.1

The `0.22.0` version number was already taken on the registry, so the release
workflow could not publish it. This release ships the same dashboard additions
under a clean version.

### Dashboard

- `ResourceSnapshot` (`./dashboard`): compact panel stacking `ResourceMeter`
  rows for an at-a-glance CPU / memory / disk read, with loading and error
  states and an optional header action slot.
- `ActivityFeed` (`./dashboard`): newest-first list of timestamped activity
  items (commits, snapshots, lifecycle events) with relative times.
- `ResourceMeter` (`./dashboard`): new `valueLabel` override for readouts the
  `value{unit}/max{unit}` template can't express (e.g. byte sizes); bar fill
  clamped to `[0, 100]`. `ResourceSnapshotItem` carries optional `id` and
  `unit`, forwarded to the meter.

## 0.21.1

### Harness ↔ model compatibility + session locking (chat)

- `harness-model-compat` (`./chat`): policy table + pure helpers
  (`isModelCompatibleWithHarness`, `snapModelToHarness`,
  `snapHarnessToModel`, `modelProvider`). Native harnesses are
  vendor-locked (claude-code → Anthropic, codex → OpenAI); opencode is
  router-backed and runs anything.
- `AgentSessionControls` keeps the harness/model pair coherent:
  switching harness snaps an incompatible model to the harness's best
  catalog option (latest standard-frontier first); picking a model the
  harness can't run switches to the model's native harness.
- `AgentSessionHarnessControl.locked` + `lockReason`: a harness bound
  to an active chat session renders an inert lock trigger and filters
  the model catalog to compatible entries.

### Wizard design-system alignment

- ProvisioningWizard restyled to the shared dashboard idiom (standard
  cards, Input/Switch/Button primitives, compact sliders and step
  indicator). No prop or behavior changes.


## 0.21.0

### ProvisioningWizard: AI Agent step removed (breaking)

- The wizard is now Environment → Resources (→ Access). Agent harness,
  model, and system prompt are runtime concerns configured in the
  session chat, not at provisioning.
- `ProvisioningConfig` no longer has `modelTier` / `systemPrompt`.
- `ProvisioningWizardProps` no longer accepts `models`, `popular`,
  `defaultModel`, `onSetDefault`.
- The Advanced Options block (workspace name, driver, git URL, env
  vars, startup scripts, bare mode) moved into the Resources step.
- `TemplatePreset` no longer carries `systemPrompt`.

### Agent chat session controls (new)

- `AgentSessionControls` (`./chat`) — compact composer strip combining
  an agent-harness dropdown (canonical `HARNESS_OPTIONS`), the
  `ModelPicker` pill, and `ReasoningLevelPicker`. Sections render only
  when their control object is provided; `trailing` slot for token/cost
  meters.
- `SandboxWorkbench` `session.composerControls` — renders any node as a
  strip attached beneath the chat composer.
- `useSessionStream().send(text, options?)` — per-turn overrides
  (`agent`, `model {providerID, modelID}`, `system`,
  `reasoningEffort`) forwarded to the sidecar send-message endpoint.


## 0.17.0

### `TangleLoginButton` (auth) + `IntegrationsPanel` / `useIntegrations` (new `./integrations` subpath)

- `auth`: `TangleLoginButton` mirrors the GitHub button — redirects to a
  consumer-side endpoint (default `/auth/tangle`) that wraps
  `PlatformAuthClient.authorizeUrl` from
  `@tangle-network/agent-runtime/platform`. The existing GitHub /
  AuthHeader / UserMenu re-exports from `@tangle-network/ui/auth` are
  unchanged.
- `./integrations` (new subpath):
  - `IntegrationsPanel` — presentational. Catalog, connections,
    optional health map, `onConnect` / `onDisconnect` callbacks. One
    Card per provider; revoked connections fall back to the Connect
    button rather than masquerading as live; EmptyState handles "no
    providers" and "cold-load" states.
  - `useIntegrations({ apiBaseUrl })` — data hook against a thin REST
    shim the consumer mounts over `PlatformHubClient`: `GET catalog`,
    `GET connections`, `GET healthchecks`, `POST auth/start`, `DELETE
    connections/:id`. Healthchecks are best-effort; a 404 there does
    not fail the panel load. `connect()` redirects via
    `window.location.href`; `disconnect()` refreshes the connection
    list.
  - `types` mirror the platform's `/v1/integrations/*` response so the
    UI package has zero dependency on the server-side client.

## 0.16.2

### `SandboxTable` — action parity with `SandboxCard`

- The row's overflow button is now a real dropdown menu. Previously it
  was a plain click handler drawn with the `Code2` icon, which made it
  visually indistinguishable from the IDE quick-action button next to
  it (consumer-side bug, tangle-network/agent-dev-container#1190). The
  trigger now uses `MoreVertical`, opens a `DropdownMenu`, and exposes
  the same action set the cards view already had.
- Adds five new optional props mirroring `SandboxCard`: `onStop`,
  `onKeepAlive`, `onUsage`, `onHealth`, `onFork`. On running rows the
  menu renders Stop / Keep Alive → ─── → View Usage / Health Check
  → ─── → Fork → ─── → View Details. On resumable rows
  (`stopped`/`failed`/`hibernating`/`archived`) it renders Fork →
  ─── → View Details. On transitioning rows (`provisioning`/`creating`)
  it renders View Details only. Each item is gated on its callback
  being passed, and the trigger itself is hidden when no item would
  render.
- `onMore` is preserved as the "View Details" item inside the menu, so
  consumers that already pass it (e.g. for navigating to the sandbox
  detail page) keep working without any code change — the click just
  comes from a menu item instead of the (visually-broken) icon button.
- Quick-action icons (IDE / Terminal / SSH on running rows, the
  Resume / Wake Up pill on resumable rows) are unchanged.
- The Delete trash icon is unchanged. The component fires `onDelete`
  on the user's first click; consumers remain responsible for
  surfacing a confirmation step before invoking the destructive API.
- This is an additive change. No props were removed, renamed, or had
  their types narrowed.

## 0.16.1

### `SandboxTable` — surface a resume path for non-running rows

- The table now renders a dedicated Resume / "Wake Up" button for every
  non-running, non-transitioning row (`stopped`, `failed`, `hibernating`,
  `archived`). Previously only `hibernating` rows got a Wake action, so a
  sandbox auto-stopped by an idle timer had no visible affordance to
  start it again from the dashboard list.
- The `<tr>` body is now a keyboard-accessible button when there is a
  primary action to take. Running rows route the click to `onOpenIDE`;
  resumable rows route it to `onResume`. Action buttons stop event
  propagation so clicking the trash icon never doubles as a resume.
- Adds `onResume?: (id: string) => void` prop. `onWake` is kept for
  back-compat: when `onResume` is absent, a hibernating row still wires
  up its button to `onWake`. Non-hibernating statuses do **not** fall
  back to `onWake` — they were never part of `onWake`'s contract, so
  callers opt in to the new behavior by passing `onResume`.

## 0.16.0

### Breaking — root barrel narrows

- `@tangle-network/sandbox-ui` no longer re-exports the editor surface
  (`TiptapEditor`, `EditorToolbar`, `DocumentEditorPane`, `EditorProvider`,
  `CollaboratorsList`, the editor hooks `useEditorConnection` / `useYjsState`
  / `useAwareness` / `useCollaborators` / `useCollaboratorPresence` /
  `useDocumentChanges`, and their types) from the package root. The editor
  surface drags `@tiptap/*`, `yjs`, and `@hocuspocus/provider` type chains
  into the root entrypoint — specialized collaboration tooling, not generic
  primitives, and not paid for by consumers who don't use them.
- The `@tangle-network/sandbox-ui/editor` subpath is unchanged and is the
  canonical entrypoint for editor consumers.
- Migration:

  ```diff
  - import { TiptapEditor } from "@tangle-network/sandbox-ui";
  + import { TiptapEditor } from "@tangle-network/sandbox-ui/editor";
  ```

  `sed` recipe across a consumer tree:

  ```bash
  grep -rl '"@tangle-network/sandbox-ui"' src/ \
    | xargs sed -i '' -E \
        '/Tiptap|Editor|Collaborat|useYjs|useAwareness|DocumentEditor|ConnectionState/s|"@tangle-network/sandbox-ui"|"@tangle-network/sandbox-ui/editor"|g'
  ```

- No internal consumer in the tangle-ai monorepo is affected — verified that
  no file imports from the `@tangle-network/sandbox-ui` root barrel for any
  editor symbol.

## 0.15.4

### Breaking — `ModelPicker`
- The `presets` prop, the `ModelPreset` interface, and the built-in
  `Fast`/`Balanced`/`Best` defaults are removed. The previous matchers were
  OpenAI-biased (every chain started with a `gpt-5*` regex) and presented a
  fixed taxonomy that never reflected what users actually wanted.
- New `popular?: ReadonlyArray<string>` prop replaces it. Pass canonical
  model ids (`<provider>/<model>`); the picker resolves them against the
  loaded `models` list and renders them in a "Popular" section above the
  full provider-grouped list. Ids absent from the catalog are silently
  skipped, so a stable curation list is safe across catalog rotations.
- Migration: drop the `presets` prop and pass `popular={[...]}` with the
  ids you actually want surfaced. Curation is now the consumer's job.

### Added — `ProvisioningWizard`
- `popular?: ReadonlyArray<string>` — forwarded straight to `ModelPicker`.
- `defaultModel?: string | null` — the user's saved preferred model. Used
  as the initial `modelTier` when `defaultConfig.modelTier` isn't set, and
  as the next-best fallback when the current selection drops out of the
  loaded list. Resolution order: `defaultConfig.modelTier` → `defaultModel`
  → first available `popular` id → `models[0]`.
- `onSetDefault?: (modelId: string) => void` — when provided, the wizard
  renders a "Save as default" link beneath the picker. Persistence is the
  consumer's responsibility; the wizard only invokes the callback.

## 0.15.3

Fix: `ModelPicker`'s search input no longer loses focus after the first matching keystroke. `@radix-ui/react-dropdown-menu`'s Content runs WAI-ARIA menu typeahead on every character keydown that bubbles up — when the typed text matched a model's name, Radix called `setTimeout(() => match.focus())` and yanked focus off the search input. Printable keydowns now stop at the input; Escape (document-level capture listener), Tab, and arrow keys are unaffected.

## 0.15.2

`ProvisioningWizard` model selection now uses `ModelPicker` — search, provider grouping, presets, pricing, and context-length display in one component instead of a flat HTML `<select>`. The wizard's prop is `models: ModelInfo[]` (the wire-format payload from Tangle Router's `/v1/models`); the prior `modelOptions: ModelOption[]` API and the `ModelOption` export are removed. Adds a `triggerClassName` prop on `ModelPicker` so callers can size the trigger to match surrounding form fields.

## 0.15.1

Republish of 0.15.0 — the 0.15.0 release pipeline silently skipped publish due to `HEAD~1`-diff fragility when the merge commit's parent already carried the bumped version. Contents identical to 0.15.0; this version exists so npm consumers can install the re-export bridge work from PR #36.

## 0.15.0

### Changed
- Source tree slimmed: ~104 files moved to `@tangle-network/ui@^1.0.1`. Public exports unchanged — every name still resolves; types forward transitively. New peer dep: `@tangle-network/ui@^1.0.1`. `@tangle-network/brand` peer bumped to `^0.3.0`.

### Re-exports kept indefinitely
No deprecation timeline. Migration is opt-in.

### Migration recipe (optional)
Consumers wishing to flip imports to the more truthful path:

    pnpm add @tangle-network/ui

    sed -i '' \
      -e 's|@tangle-network/sandbox-ui/primitives|@tangle-network/ui/primitives|g' \
      -e 's|@tangle-network/sandbox-ui/chat|@tangle-network/ui/chat|g' \
      -e 's|@tangle-network/sandbox-ui/run|@tangle-network/ui/run|g' \
      -e 's|@tangle-network/sandbox-ui/files|@tangle-network/ui/files|g' \
      -e 's|@tangle-network/sandbox-ui/editor|@tangle-network/ui/editor|g' \
      -e 's|@tangle-network/sandbox-ui/markdown|@tangle-network/ui/markdown|g' \
      -e 's|@tangle-network/sandbox-ui/auth|@tangle-network/ui/auth|g' \
      -e 's|@tangle-network/sandbox-ui/openui|@tangle-network/ui/openui|g' \
      -e 's|@tangle-network/sandbox-ui/utils|@tangle-network/ui/utils|g' \
      $(grep -rl '@tangle-network/sandbox-ui/' src/ 2>/dev/null)

DO NOT migrate: `dashboard`, `workspace`, `pages`, `terminal`, `hooks` (partial), `stores` (partial), `types` (partial). Those remain genuinely sandbox-ui surfaces.

## 0.14.0

### New: WebSocket transport for `usePtySession` (with HTTP+SSE fallback)

`usePtySession` (the hook that powers `<TerminalView>`) now opens a WebSocket against `${apiUrl}/terminals/:id/ws` for terminal I/O. Keystrokes flow as binary frames, server output as text frames, and resize as a small JSON control frame. The HTTP+SSE path (`POST /input` + `GET /stream`) is preserved as a fallback so the hook keeps working against backends that don't yet ship the WS endpoint, and against environments where `WebSocket` is unavailable.

- **Why**: the previous HTTP+SSE flow paid a per-keystroke round-trip from browser → edge → orchestrator → sidecar → back. Through Cloudflare that's typically 150–400 ms each direction; users reported "seconds of typing latency" against busy backends. WS collapses the chain onto a single persistent socket.
- **No `apiUrl`/`token` API changes.** Consumers don't need to do anything to opt in; the hook tries WS first and falls back transparently if the upgrade doesn't open within 1.5 s.
- **The HTTP+SSE input-coalescing contract is preserved on the WS path.** `sendCommand`'s drain loop still serializes one dispatch at a time and coalesces keystrokes that arrive while a send is in flight — same ordering guarantees, fewer round-trips.

### Bearer auth migrates from URL query to `Sec-WebSocket-Protocol` (security)

The hook used to put the bearer token in the WebSocket URL query string (`wss://…?token=…`). That value shows up in edge-proxy access logs, browser DevTools network panels, referrer headers on internal links, and log-aggregation systems. The token now rides in the `Sec-WebSocket-Protocol` request header instead, base64url-encoded into a `bearer.<encoded>` value (RFC 7230's `token` grammar excludes `+`/`/`/`=`).

- **Non-disruptive against backends that don't consume the subprotocol.** Per RFC 6455 §4.2.2, an unrecognized offered subprotocol is silently dropped from the response and the connection still establishes. Same-origin browser users continue to authenticate via session cookie at the edge.
- **Backends opting in** to read the bearer subprotocol should: strip `bearer.` prefix → pad to base64 length and swap `-`/`_` for `+`/`/` → `atob` → validate as the bearer value. The matching decoder lives in the agent-dev-container CF Worker / orchestrator chain.
- **`Authorization: Bearer …`** is unchanged on REST calls (POST /terminals, PATCH, DELETE).

### New: GPU rendering via `@xterm/addon-webgl` (optional peer)

`<TerminalView>` now loads `@xterm/addon-webgl` to render glyphs on the GPU. xterm's DOM/canvas renderer is the fallback in three cases: the addon throws on construction (no WebGL context, headless test env), context loss fires later (the addon disposes itself, xterm reverts), or the package is not installed at all.

- **New optional peerDependency: `@xterm/addon-webgl: ^0.19.0`.** Listed under `peerDependenciesMeta.optional`; the `<TerminalView>` module loads it via dynamic `import()` so a consumer who doesn't install it gets a working terminal with the default renderer instead of a module-load crash.
- **Build externalization**: the addon is in tsup's `external` list alongside the other xterm peers. Without that fix the build was bundling the full WebGL addon (~50 KB) into `dist/terminal.js`. After the fix, `dist/terminal.js` dropped from ~162 KB to ~6 KB.
- **`@xterm/addon-fit`, `@xterm/addon-web-links`, `@xterm/xterm`** stay required peers — the terminal can't function without them.

### New: per-frame output coalescing in `<TerminalView>`

PTY output chunks accumulate into a per-frame buffer and flush in a single `xterm.write` per `requestAnimationFrame`. Bursty streams (`ls /usr/bin`, `tail -f`, log dumps) drive the xterm parser once per frame instead of N times, and the renderer schedules one paint aligned to the display refresh.

### Why this whole shape

The latency-driver was the per-keystroke HTTP RTT — that's why the WS transport is the headline change. The WebGL addon and RAF coalescing are paint-side wins that round out the experience under heavy output. The auth-channel move was a related concern surfaced during review of the WS work and is shipped together so the security posture lands with the new transport, not after.

## 0.13.0

### Breaking (build / install)

- **Design tokens now consumed from `@tangle-network/brand`** — single source of truth across every Tangle app. `src/styles/tokens.css` (492 LOC, byte-identical to brand's) is deleted; `src/styles/globals.css` now does `@import "@tangle-network/brand/styles/tokens.css"`. The build pipeline (`scripts/copy-styles.mjs`) resolves brand's `tokens.css` via Node package-exports and copies it to `dist/tokens.css`, so consumers that hit `@tangle-network/sandbox-ui/tokens.css` directly (e.g. the blueprint-agent SCSS bridge) keep working unchanged.
- **New required peerDependency: `@tangle-network/brand: ^0.2.0`.** Consumers must add it to their direct deps. pnpm auto-installs peers; npm/yarn users may need to install it explicitly.
- **`postcss-import` added as a devDep** to resolve the bare-specifier `@import` for brand's tokens; runs before Tailwind v4's plugin (`filter` skips `@import "tailwindcss"` so Tailwind still owns its own resolution).

### Why

`@tangle-network/brand` was extracted from sandbox-ui as the single source of truth for design tokens. Until now sandbox-ui still kept a local copy and diverged by chance only — any drift would have silently broken downstream apps that pull tokens from either package. This release closes the loop: brand changes propagate via npm bumps; sandbox-ui re-ships brand's bytes verbatim.

## 0.10.9

### Breaking (behavior)

- **Stopped bundling Google Fonts via CSS `@import url(...)`**: `src/styles/globals.css` no longer emits `@import url("https://fonts.googleapis.com/css2?family=Geist...")`. Consumers must load the font families sandbox-ui references (Geist, Geist Mono, Outfit, Manrope, Inter) themselves — either via `@fontsource/*` packages or an HTML `<link>`. See README "Fonts".
- **Why this changed**: a URL `@import` inside a library CSS file is only spec-valid when the file is loaded as a top-level stylesheet. If a consumer does `@import "@tangle-network/sandbox-ui/globals.css"` from their own CSS (a CSS chain import), PostCSS inlines our file verbatim at that position; any `@import url(...)` in our file then lands after the consumer's preceding rules, which the CSS spec disallows, and PostCSS rejects the build with "@import must precede all other statements". The failure surfaces in the consumer's Vite/webpack output as a blank page. The 0.10.6 validator enforced correct ordering *within* our single built file — it could not and did not protect consumers who chain-imported the file.
- **Migration**: If your app relied on sandbox-ui to fetch these fonts for you, add them yourself. Example:
  ```html
  <!-- index.html -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" />
  ```
  Or, for self-hosted: `npm install @fontsource/geist-sans @fontsource/geist-mono @fontsource/outfit @fontsource/manrope @fontsource/inter` and import the weights you need from your app entry.

### Fixes

- **Validator inverted**: `scripts/validate-built-css.mjs` now *forbids* any URL `@import` in the built output, catching at the library's build boundary the exact pattern that failed for downstream consumers. Tests updated.

## 0.10.7

### Fixes

- **Provisioning wizard sliders — labelled max is now reachable (#738)**: HTML range inputs snap the thumb to `min + k*step`, so the labelled `max` is only selectable when `(max − min)` is a whole multiple of `step`. When team/plan limits trimmed the max off the step grid (e.g. `STORAGE_MIN=20`, plan `storageMaxGB=50`, `STORAGE_STEP=8` → thumb capped at 44 instead of 50), users could not select the exact limit the UI advertised. Added `alignSliderStep(min, max, desiredStep)` that shrinks the step to the largest divisor of `(max − min)` not exceeding `desiredStep`, preserving the caller's granularity — integer steps stay integer (RAM, storage), and CPU's 0.5 step stays on one-decimal values via a ×10 scaling pass to avoid float-modulo quirks. CPU, RAM, and storage sliders now route their min/max through the helper, so the thumb can reach both endpoints. The min side was never blocked (HTML anchors the grid to `min`); this fix closes the max side.
- **Seeded values now land on the new step grid**: When a saved `defaultConfig`, a preset, or the template-reset button seeds the sliders with a number that was on-grid under a different plan's step (e.g. `storageGB=28` on the old step-8 grid, loaded under a tighter plan whose aligned step is 6), React state held the off-grid value while the browser painted the thumb at the nearest stop — the on-screen reading and the state disagreed until the user dragged. Added `snapSliderValue(value, min, max, step)` and ran every seed site through it (initial `useState`, the limit-change effect, `applyPreset`, reset button), so state and paint stay in lock-step.
- **Regression coverage**: Added unit tests for `alignSliderStep` (identity when already aligned, divisor search, equal-bounds, zero/negative guards) and for `snapSliderValue` (on-grid pass-through, nearest-stop rounding, clamp-before-snap, 0.5-step float stability, non-finite/zero-step fallbacks), plus an integration test that mounts the wizard with the original #738 plan limits and asserts the rendered `step` attribute divides `(max − min)`.

## 0.10.6

### Fixes

- **`dist/globals.css` CSS spec compliance**: moved the Google Fonts `@import url("https://fonts.googleapis.com/...")` to the top of `src/styles/globals.css`, ahead of `@import "./tokens.css"` and `@import "tailwindcss"`. PostCSS inlines both of those during build, which previously pushed the Google Fonts `@import` to ~line 406 of the built CSS — after real rules — and the CSS spec mandates `@import` must precede all statements except `@charset`/empty `@layer`. Downstream bundlers (Vite, webpack) were emitting a warning and dropping the `@import`, so Geist/Geist Mono/Outfit/Manrope/Inter were not actually being fetched in consumers that relied on this library to load them.
- **Build-time regression guard**: `scripts/copy-styles.mjs` now fails the build if the built `globals.css` doesn't have the Google Fonts `@import` at the top, preventing the ordering from silently regressing in future edits.

> Versions 0.10.0–0.10.5 were published without changelog entries.

## 0.9.0

> Versions 0.5.0–0.8.4 were published without changelog entries.

### Breaking Changes

- **Themes removed**: `ocean`, `ember`, `forest`, `dawn`, `operator`, `builder`, and `consumer` themes have been removed. Only the default dark theme and `vault` (light) remain. The `theme` prop on `WorkspaceLayout` now accepts `"vault"` only.
- **`ProvisioningConfig.startupScriptIds`**: New optional field added to the exported interface. Existing code is unaffected since the field is optional.

### New Components

| Component | Subpath | Purpose |
|---|---|---|
| `StartupScriptsPage` | `/pages` | Full CRUD page for managing sandbox startup scripts |
| `PromoBanner` | `/dashboard` | Themed promotional banner with CTA button |
| `InfoPanel` | `/dashboard` | Themed info card for stats rows |



### Improvements

- **Pricing page**: Added eyebrow prop, FAQ section, billing period toggle.
- **Provisioning wizard**: Startup scripts integration, deploy error feedback, load error surfacing, `maxLength` on name/prompt inputs, runtime driver validation.
- **Secrets page**: Redesigned with stats row, `InfoPanel` integration, race-safe data loading via generation counter, `showSpinner` parameter to avoid flash on mutation refresh.
- **Design tokens**: Added `--btn-primary-text`, `--brand-strong-text`, `--brand-strong-text-muted`, `--brand-strong-text-dim` tokens for WCAG-compliant text on themed backgrounds.
- **Card variants**: Restored visual distinctions for `elevated`, `glass`, and `sandbox` card variants.
- **Accessibility**: `aria-label` on script action buttons, `aria-hidden` on decorative SVGs, touch-visible action buttons on mobile.
- **Consistent styling**: All primary buttons use `--btn-primary-bg`/`--btn-primary-hover`/`--btn-primary-text` tokens. `font-display` Tailwind utility used consistently instead of `font-[var(--font-display)]`.
- **Test coverage**: Added test suites for `StartupScriptsPage`, `SecretsPage`, `PromoBanner`, `InfoPanel`, `ProvisioningWizard`, and `WorkspaceLayout` (59 tests total).

## 0.4.0

### Breaking Changes

- **Sidebar rewrite**: `AppSidebar` and its types (`SidebarNavItem`, `SidebarSandbox`) are removed. Replaced with composable Rail + Panel primitives (see [docs/sidebar.md](./docs/sidebar.md)).
- **DashboardLayout**: Props `sandboxName`, `sandboxLabel` removed. New props: `modeItems`, `panels`, `defaultPanelOpen`, `defaultMode`, `railFooter`, `profileMenuItems`.
- **User avatar** moved from top nav bar to the sidebar rail footer.

### New Components

| Component | Subpath | Purpose |
|---|---|---|
| `Sidebar` | `/dashboard` | Root sidebar container (width animation, hide support) |
| `SidebarRail` | `/dashboard` | 64px always-visible icon strip |
| `SidebarRailHeader` | `/dashboard` | Top of rail (logo slot) |
| `SidebarRailNav` | `/dashboard` | Middle of rail (flex-1 nav area) |
| `SidebarRailFooter` | `/dashboard` | Bottom of rail (settings, theme, profile) |
| `SidebarPanel` | `/dashboard` | 260px slide-out content panel |
| `SidebarPanelHeader` | `/dashboard` | Panel title bar |
| `SidebarPanelContent` | `/dashboard` | Scrollable panel body |
| `SidebarContent` | `/dashboard` | Main content area with auto margin-left |
| `RailButton` | `/dashboard` | Icon button with badge and tooltip |
| `RailModeButton` | `/dashboard` | RailButton wired to `switchMode()` |
| `RailSeparator` | `/dashboard` | Horizontal divider in the rail |
| `ProfileAvatar` | `/dashboard` | Avatar button + dropdown menu |
| `SidebarProvider` | `/dashboard` | Context provider for sidebar state |
| `useSidebar` | `/dashboard` | Hook: `panelOpen`, `mode`, `switchMode`, `hidden`, `contentMargin` |

### New Constants

- `SIDEBAR_RAIL_WIDTH` (64px)
- `SIDEBAR_PANEL_WIDTH` (260px)
- `SIDEBAR_TOTAL_WIDTH` (324px)

### Migration

Replace `<AppSidebar navItems={...} />` with composable primitives:

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarRail>
      <SidebarRailHeader>{/* logo */}</SidebarRailHeader>
      <SidebarRailNav>{/* RailButton / RailModeButton */}</SidebarRailNav>
      <SidebarRailFooter>{/* settings, profile */}</SidebarRailFooter>
    </SidebarRail>
    <SidebarPanel>{/* panel content */}</SidebarPanel>
  </Sidebar>
  <SidebarContent>{/* page content */}</SidebarContent>
</SidebarProvider>
```

Or use `DashboardLayout` as a convenience wrapper with the new `modeItems` and `panels` props.
