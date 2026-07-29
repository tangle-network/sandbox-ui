# Changelog

## 0.93.1

### Workflows

- **A node opens from the keyboard.** React Flow makes a node tabbable but gives it no activation key, so a keyboard user could reach every node in the graph and open none of them — the detail panel was mouse-only, on every consumer of this component. Enter and Space on a focused node now fire `onNodeClick` exactly as a click does, and consume the key both ways — `preventDefault` so Space doesn't scroll the page out from under the press, and `stopPropagation` so a key already spent on opening a node doesn't also reach the host around the graph (a form that submits on Enter shouldn't fire when the user meant "open this node"). Both only once a node actually resolves: a press on canvas chrome, or on nothing, is not the graph's to swallow. Armed only when the host supplies `onNodeClick`: a graph with nothing to activate into must not swallow Enter/Space from the page.

## 0.93.0

### Workflows

- **The graph can draw a topology it is told, instead of only the one it infers.** `buildWorkflowGraph` derived edges from `do`-list position — a linear spine — which is exactly right for a workflow that runs as one and wrong for any workflow whose definition declares its own (`needs`, guards, cycles). A new `edges` option (`WfEdgeSpec[]`) replaces the inferred spine with the declared one: guarded edges carry a `whenLabel` chip, cycle-closing edges are detected and rendered dashed with the run's visit budget (`maxNodeVisits`), and the layout is **re-ranked by longest path** so a diamond reads as a diamond rather than declared edges drawn over a chain's positions. Fan-out edges survive a declared topology (a branch leaf is the graph's own node, which no declared spec addresses); the positional join does not, because what follows a fan-out is then declared rather than inferred. An edge naming a step the definition has no slot for is a loud `error`, never a quiet fall back to the spine — drawing edges the run will not take is worse than refusing to draw. Guards arrive pre-summarized, so this package never acquires a second, drifting interpretation of a condition schema it does not own.

- **Node ids are now exported instead of re-derived.** `a${index}`, `a${i}-b${j}` and `"trigger"` were internals that consumers had to reconstruct to key a run overlay or address a node — and `WfNode.id` is a bare `string`, so a rename here type-checked cleanly at every call site and simply lost their edges. `TRIGGER_NODE_ID`, `triggerNodeId`, `triggerNodeIndex`, `actionNodeId` and `branchNodeId` are the format's only spelling, asserted against a real build so a drift fails in this package rather than silently in a consumer.

- **A list-form `on:` draws one node per subscription.** `on:` accepts one trigger or a list of them with OR semantics; modelled as a single node, a three-subscription workflow rendered one unlabelled "Trigger" and hid two of the three ways it could start. Each entry is now its own node in the trigger's layer, and every one of them edges into the body. Entry 0 keeps the plain `trigger` id, so a single-trigger graph — and any host that persisted that id — is unchanged. `on: []` is now "Empty workflow" rather than a zero-node layout whose min/max over an empty set produced NaN positions.

- **`script.run`, `sandbox.snapshot`, `trace.analyze` and `webhook` are named steps.** All four fell to the generic branch and read as their humanized identifier with no subtitle. They now carry a title, a subtitle that says what distinguishes one from another (a script's granted connections, the sandbox a snapshot captures, the analysts a trace runs), a description, and their own glyph.

- **The canvas can edit the topology it draws.** `onEdgeConnect` turns the graph from a diagram into an editor: node handles become visible and draggable, an edge takes focus and answers Delete/Backspace, and `onEdgeClick` asks to edit a guard. Every callback speaks node ids and the canvas holds no pending state — an accepted edit returns as new `yaml` + `edges`, a rejected one simply never arrives — so this package reports gestures and never has to know what a `needs` row is. Fan-out and trigger edges fire none of them: neither is a row in anyone's declared topology, so offering the gesture would invite an edit with nowhere to land. Omit the callbacks and the graph stays exactly the read-only visualisation it has always been; nodes remain undeletable and unconnectable either way, because a node is a `do` entry and removing one is a list edit, not a canvas gesture.

- **`selectedNodeId` reflects the host's selection.** A consumer that opened a node's detail panel had no way to show which node it belonged to. Carried by context rather than merged into node data, so a selection change does not rebuild the node objects the run-state merge works to keep stable.

- **Edge labels get a corridor they fit in.** A chip sits between two layers, and at the ordinary separations (72 expanded, 20 compact) it was several times the gap it occupied and spilled across the nodes either side. A graph with labelled edges now pitches its layers at `EDGE_LABEL_LANE`, and a guarded cycle's two chips stack rather than sit side by side — the same reservation principle the node heights already follow. Graphs without labelled edges are unaffected.

## 0.92.0

### Dashboard

- **Every section is reachable on a phone.** `hideBelow` set `display:none` on the whole rail and nothing replaced it, so below the breakpoint an app's destinations had no entry point at all — measured across the four Tangle agent products at 390x844: 0 menu buttons, 0 of 5 destinations reachable, against 5 of 5 on desktop. `SidebarLayout` now renders a mobile bar (menu + brand/switcher + account) and a left drawer built from the SAME nav-item renderer the rail uses, so a product that adds a destination gets it on both surfaces. The drawer also absorbs the docked panel's content, since a phone has no room to dock a panel beside a rail. `SIDEBAR_MOBILE_WIDTH` already existed and was documented as the mobile drawer's width; this is the drawer it was waiting for. Consumers that hand-rolled their own mobile bar should delete it or two bars will stack.

### Chat

- **The composer no longer clips its own send button.** The pickers sat in a `shrink-0` box, so on a narrow viewport they kept their full intrinsic width (measured 347px) and pushed send to `right: 470` against a 390px viewport — outside the card, where `overflow-hidden` clipped it, and with `scrollWidth === clientWidth` it could not even be scrolled to. Attach and send are now pinned and everything between them shares one shrinkable, horizontally scrollable strip; `ml-auto` on the trailing group preserves the previous right-alignment, so a desktop composer is unchanged. Measured on gtm at 390x844: clipped nodes 10 to 0, send button right edge 470 to 359, visible false to true.

## 0.91.5

### Integrations

- **The loading skeleton now reserves exactly the space it becomes.** It was smaller than the panel it turned into, so the page dropped every time the catalog landed — measured in Chromium at the same 12 tiles on both sides, 332.69px vs 386.69px on desktop (+54px) and 436px vs 588px on mobile (+152px). Two causes, both the skeleton guessing geometry rather than rendering it: it omitted the search and sort row entirely, and its tile was a bare `aspect-square` while a real tile's content (48px logo, an 8px gap, a fixed 32px label, 12px padding each side = 112px) beats the square once the column is narrower than that. The toolbar is now one component rendered by both states, and the skeleton tile carries the same box class and the same logo/label blocks as a provider tile, so all three read one shared constant. Both states now measure identically at both breakpoints. Adds `skeletonCount` (default 12) for consumers that know their catalog size.

## 0.91.4

## 0.91.3

### Workspace

- **The rail, list, record, and mobile drawer headers now share one 56 px row.** Workspace panes consume a single exported header component, including the session sidebar, so their dividers cannot drift into the stepped edge that appeared when local padding produced 36–41 px headers.

## 0.91.2

### Fixes

- **A message you send now appears in the transcript immediately.** `useSessionStream` recorded nothing locally on send, and the session bus carries `message.updated` only for the assistant's reply — so a user message first arrived in the `session.idle` refetch, after the agent had finished answering it. The wait scaled with the model's response time. `send` now echoes the message into `messages`/`partMap` before the request and flips `isStreaming`, so the transcript updates on submit and composers gate a second send. Echoes are retired when the turn ends, when the send is rejected, or when the hook is pointed at another session, so the backend's history stays authoritative.

## 0.91.1

### Fixes

- **The harness menu no longer keeps its search filter across openings.** Searching for a harness, selecting it, and reopening the menu later left every other harness hidden with nothing on screen explaining why. The filter now resets when the menu closes, matching the model menu.

## 0.90.3

### Integrations

- **Integration cards now stay inside narrow app panels.**
  Provider labels and connection metadata shrink and truncate while status and actions remain visible, including the 320 px mobile layout.
- **Products can distinguish OAuth readiness from inbound-event readiness.**
  `ProviderReadiness.eventIngressConfigured` is an optional shared field, so email, Slack, and Teams receivers can report missing event delivery setup without inventing a product-local type.

## 0.90.2

### Fixes

- **The terminal's REST fallback now sends a JSON body when creating a PTY.** It declared `Content-Type: application/json` and sent nothing, so the sidecar rejected the request as malformed before the handler ran. The request now carries the current geometry — the same fields the WebSocket `init` frame uses — which also spares the new PTY a resize round-trip. The fallback runs only when the direct WebSocket dial fails, so this surfaced solely on stacks without that path, where the terminal could not open at all.

## 0.90.1

### Agent interface

- **Sandbox UI now requires `@tangle-network/agent-interface ^0.36.0`.** Package metadata, workspace pins, documentation, and the packed-consumer check use the same current contract.

## 0.90.0

### Agent interface

- **Sandbox UI now requires `@tangle-network/agent-interface ^0.35.0`.** Picker and chat APIs continue to accept only canonical `HarnessType` values such as `claude-code` and `kimi-code`; the removed `claude`, `claudish`, and `kimi` aliases remain rejected rather than normalized.

### Maintenance

- **The development toolchain has no known audited vulnerabilities.** Storybook moves to `10.5.4`, and patched transitive releases replace vulnerable `ws`, `brace-expansion`, and `esbuild` versions.

## 0.89.0

### Chat

- **Sandbox UI now uses the current canonical agent-interface contract.** Chat controls consume canonical harness values directly and require `@tangle-network/agent-interface ^0.34.0`; that version intentionally removed deprecated alias names, so the package no longer advertises support for an incompatible older contract.

## 0.88.1

### Terminal

- **The terminal WebSocket offers the `tangle.terminal.v1` echo subprotocol.** `usePtySession` previously offered only the `bearer.<…>` credential. A server must never echo that back — it would put the live terminal token in a response header — so both backends select no subprotocol, and Chrome then fails the handshake with "Sent non-empty 'Sec-WebSocket-Protocol' header but no response was received". The non-credential marker is now offered alongside the credential so the server has something safe to select, which is what the sandbox-api and sidecar edges already look for.

## 0.88.0

### Chat

- **The model picker defaults to the compact pill.** `ModelPicker`'s default `variant` is now `pill` — the inline, cost-showing trigger every current consumer already opts into — instead of the full-width `field`. The labelled form-field layout is still available via `variant="field"`.

## 0.87.1

### Packaging

- **Published imports now install every declared runtime dependency.** Version `0.87.0` externalized the mention editor's five TipTap modules but listed them only as development dependencies, so a clean consumer importing `./chat` failed its production build with `Could not resolve "@tiptap/core"`; the package now owns those private implementation dependencies, repeats the optional peer contract for the UI editor and session-store surfaces it re-exports, and proves every public JS/CSS export from the packed tarball in a clean Vite consumer before release.
- **Releases now publish the artifact CI actually tested.** The workflow packs once, verifies the tarball in a blank consumer, compares its SHA-1 with npm and GitHub Packages, publishes only missing identical versions, verifies both registries, and creates the GitHub Release last so partial runs are safely resumable.
- **Package maintenance is current and single-sourced.** The stale npm lockfile, unused collaboration and rendering packages, manually duplicated bundler exclusions, and obsolete Storybook 8 packages are gone; pnpm, Node, Storybook, the shared Tangle UI packages, and direct dependencies now use their current supported releases.
- **TypeScript remains on `5.9.3` intentionally.** TypeScript 7 typechecks the source, but tsup's declaration bundler currently rejects it; moving to a pre-1.0 replacement bundler only for that version bump would add release risk without changing the published API.

### Chat

- **Reasoning controls follow the current agent-interface capability contract.** Codex exposes its supported `xhigh` and `ultracode` levels, Kimi's off state uses canonical `none`, and switching agents can only preserve or reduce an explicit effort rather than silently increasing it.

## 0.87.0

### Chat

- **The `@`-mention suggestion popover floats on the popover surface.** It shipped filled with `bg-surface-container-high` — a token a host can legitimately rescope for its composer area, where it resolved to effectively transparent and left the popover bleeding into the conversation behind it. It now takes `bg-popover` / `text-popover-foreground` with the standard border, the same surface family the library's other floating panels use, so it reads as an overlay in any host without one having to correct it.
- **New API:** `MENTION_PILL_CLASS` (exported from `./chat`) — the mention pill's class contract. It was private to the editor, so a host rendering a pill anywhere else (a sent message's transcript row being the obvious case) could only copy the string, leaving one visual contract living as two unlinked copies that silently desync the moment the composer is restyled. It now lives in a leaf module with no editor import, so re-exporting it does not pull the lazily-loaded TipTap chunk into a consumer's bundle.
- **New API:** `AgentComposerMention.popoverClassName` — a supported hook for retheming the suggestion popover. Without it a host has to reach in through the popover's ARIA attributes from app CSS, which an `aria-label` copy-edit here would silently break. Merged onto the popover root after the component's own classes, so the consumer's win.

## 0.86.0

### Chat

- **`AgentComposer` learns `@`-mentions (opt-in).** A new optional `mention` prop swaps the plain `<textarea>` for a TipTap-based rich input: typing the trigger (default `@`) opens a caret-anchored suggestion popover fed by the host's async `fetchItems(query)`, keyboard-navigable (↑/↓, Enter/Tab selects, Esc closes — a popover-open Enter selects and never submits), with loading/empty/error states. A picked item becomes an **atomic inline pill** (`@label`, full id on hover): not enterable, skipped over by arrow keys, deleted whole by a single backspace. `value` stays a plain string — pills serialize as `@<id>` and restore from a programmatic value set for ids the editor has seen — so the controlled contract, Enter/Shift+Enter, autosize, placeholder/disabled/autoFocus, Cmd/Ctrl+L, clipboard file paste → `onAttach`, drag-and-drop, and IME composition guards all behave exactly as the textarea path does. Suggestion fetches are debounced (100 ms) with stale-response protection, and the popover re-anchors on scroll/resize instead of detaching from the caret.
- **Without the `mention` prop, nothing changes.** The textarea path is untouched and behavior-identical, and the TipTap stack (including the two new deps `@tiptap/extension-mention` and `@tiptap/suggestion`) lives in a lazily-loaded chunk — `./chat` consumers that never pass `mention` download none of it.
- **New API** (exported from `./chat`): `MentionItem` (`{ id, label, detail?, kind? }`) and `AgentComposerMention` (`{ trigger?, fetchItems, onMentionsChange?, renderItem?, emptyText? }`). `onMentionsChange` reports the pills currently in the document — including after a programmatic restore — so a host can mirror the mentioned items into its send body. Designed to plug directly into `@tangle-network/agent-app`'s `useFileMentions` hook for sandbox file mentions.

## 0.85.1

### Chat

- **Workspace chat send now base64-encodes text parts on the wire (fixes #183).** `useSessionStream`'s `send()` posted `{ type: "text", text }` as raw UTF-8, but the sidecar's send-message route base64-decodes every text part at the request boundary (its universal wire format — readable prompt bodies false-positive on ingress WAF shell-injection rules). Any message with a character outside the base64 alphabet (a space, punctuation) was rejected with `400 INVALID_REQUEST`; a message that happened to be valid base64 (a bare word) was silently mis-decoded to garbage. Chat was non-functional for real input. The text part is now encoded via a new internal `encodeTextForWire` helper that mirrors the sandbox SDK and the server decoder byte-for-byte; the receive path is unchanged (the sidecar persists decoded UTF-8, so history and streamed parts already arrive as plain text).

## 0.85.0

### Connectors

- **New `./connectors` module** — building blocks for a browsable Tangle-hub integration/connector library, a sibling of the existing `./integrations` module. Not framework-generic UI: it encodes Tangle-product concepts (the `provider.action` path model, `integration.invoke` workflow steps, the hub action/risk shape), so it's authored here rather than in `@tangle-network/ui`. Host-**app**-agnostic within Tangle, though — any Tangle app (not just the platform) can render the same catalog over its own hub data, since the components take their data as props and leave fetching, navigation, and connect flows to the host:
  - **`ConnectorCatalogList`** — a searchable, category/auth-filterable browse list. The host supplies `entries`, a `getConnectorHref` resolver, an optional `onOpenConnector` for SPA navigation (a modifier/middle-click still falls through to the real href for open-in-new-tab), an optional `renderIcon` for brand marks, and an optional `onRequestIntegration`. Rows show a category · auth · N actions · M trigger events detail line and a connected indicator.
  - **`ConnectorActionList`** — a searchable list of a connector's invokable actions; each row expands to its `provider.action` path (copyable), a readable input/output schema table, a ready-to-paste `integration.invoke` step (Copy step YAML), and an optional Build-with-assistant callback. Risk renders as a Badge (`read`/`write`/`destructive`/`unclassified`).
  - **`SchemaTable`** — a readable field table for a JSON input/output schema (required marks, nested objects, array item types, enum values) with a raw-JSON toggle; falls back to raw JSON for shapes it can't tabulate.
  - **`integrationStepYaml(path, inputSchema)`** — a pure helper that stubs a workflow `integration.invoke` step block from an action's input schema.

## 0.84.0

### Chat

- **`AgentComposer` leads its bottom row with the attach buttons.** The paperclip (and folder) buttons sat after the `flex-1` control strip, so they landed mid-row between the model picker and the send button. Attachment is the composer's primary left-side affordance, so the row now runs attach · folder · controls · trailing · send — the attach buttons come first and the control strip keeps its `flex-1` growth, so `trailing` + send stay pinned to the far right. Pure reorder: no change to the attach handlers, drag-and-drop overlay, or clipboard-paste ingress.

## 0.81.0

### Workflows

- **An agent node says WHO runs it.** A node whose profile is a minted catalog id (`ap_` + 16 random characters) was titled by humanising that id — "Ap nro qux n7d c7 ll30", which names nothing and cannot be resolved without the host's catalog. It is now the generic **"AI Agent"**, carrying the brand mark of the model it runs, resolved from the model slug alone. A model with no published mark keeps its kind glyph rather than getting an invented logo. A human-authored slug is untouched — the minted-id shape is pinned to its exact length, so `ap_code_review` stays "Ap code review".
- **The mark names the model the run ACTUALLY used.** The subtitle already yields to `state.model` once a run is live (a router can fall back to another lab); the mark now agrees with it, so a fallback run can't show one lab's logo beside another lab's name.
- **The graph reframes itself when density changes.** Node ids and count are unchanged across a compact/expanded flip, so React Flow won't auto-fit and the graph was left mis-zoomed. It now refits — and *glides* to the new framing rather than jumping, because the reader is watching it happen. Motion is opt-out: a reader who asked for `prefers-reduced-motion`, or an environment that cannot report the preference, gets the framing without the movement.

### Dashboard

- **New API:** `modelBrandFor(model: string)` and `ModelBrandStack` (exported from `./dashboard`) — the mark for a model, resolved from the id alone, so any surface holding a model string shows the same glyph the picker does instead of deriving one of its own. Returns `null` for a model with no published mark.

### Internal

- The brand table, its resolution, and the marks move to a leaf module. Rendering a mark previously meant importing from the model picker, and a bundler cannot split a source module — so the `./workflows` entry pulled in the entire picker (`@radix-ui/react-dropdown-menu`, the `ModelPicker` component and its rows). A consumer rendering a workflow graph downloaded a dropdown it never shows. The picker re-exports the leaf, so nothing about the public API changes.

## 0.80.0

### Chat

- **`AgentComposer` handles clipboard paste.** Pasting files onto the textarea funnels them through the existing `onAttach(FileList)` contract — no new callback, so every consumer that already wires `onAttach` gets paste for free. A clipboard bitmap arrives named `image.png` in every browser; it is auto-renamed `pasted-image-<n>.<ext>` (per-mount counter) so two screenshots don't collide. Plain-text paste is untouched, and paste is inert when `onAttach` isn't set — same gate as drag-and-drop.
- **Attachment chips can carry an image thumbnail and a retryable error.** `ComposerFile` gains `previewUrl` (object URL, rendered in place of the paperclip icon — the app owns creation and revocation) and `errorMessage` (shown truncated on an error chip, full text in the tooltip). New `onRetryFile` prop renders a retry button on error chips, so a failed upload is recoverable without re-selecting the file. A `pending` chip is now visually distinct from a `ready` one (dimmed).
- **Two opt-in send gates.** `canSubmitWhileBusy` lets Enter keep submitting while a turn streams — for composers that queue the next turn instead of blocking on the current one (the Stop button rule is unchanged). `canSubmitAttachmentsOnly` allows submitting with empty text when at least one attachment is staged — a screenshot IS the message. Both default off; no existing consumer changes behavior.
- **`accept` is enforced, not decorative.** It previously reached only the native picker dialog — a type the picker refused to offer arrived unchecked via drop (and would have via paste). Every ingress path now runs through one funnel that filters against `accept` before `onAttach` sees anything; the new `onRejectFiles` callback receives the filtered-out files with human-readable reasons (without it, rejection is silent — the same feedback the picker gives). Folder attach is exempt (directory selection has no native accept semantics).
- **New pure validation module** (exported from `./chat`): `validateComposerFiles(files, { maxSizeBytes, maxCount, currentCount, accept })` returns `{ accepted, rejected }` with human-readable rejection reasons, and `isAcceptedType` matches the native `<input accept>` grammar (`.png`, exact MIME, `image/*`). The composer uses it for its own `accept` enforcement; apps use it in `onAttach` for the policy the composer can't know — size and count limits — before any network call.

## 0.77.0

### Workflows

- **New `waiting` node status — a run blocked on a human is not a run that is working.** `0.76.0` models the `decision` step but has no status for the state it puts the run INTO: a host had to map it onto `running`, so the step the run was *stuck* on rendered as the live one — pulsing bar, primary accent, "Running" pill — while it went nowhere without the viewer. `waiting` is now first-class: the warning-amber accent (status colour, pill, border ring, inbound edge, and a soft glow), a **"Waiting on you"** label, and a progress bar that sits where the run stopped **without animating** — a moving bar would say otherwise. It reads as prominently as the running node, because it is the one node the viewer has to act on.
- New API: `WfNodeStatus` (exported from `./workflows`) gains `"waiting"`. Additive for a host that renders the graph — pass `{ status: "waiting" }` in `nodeState` and the node styles itself. A consumer holding an exhaustive `Record<WfNodeStatus, T>` of its own must add the new key. Everything the status drives (colour, pill, border, edge) is internal to the package.

## 0.76.0

### Workflows

- **The compact node is now an n8n-style icon tile, and it is the DEFAULT density.** A workflow graph is read structure-first, and a row of branded tiles — the provider's logo (or the step's glyph) with the node's name underneath — is what makes the shape of a run legible at a glance. The detail is one density toggle (or one node click) away. `defaultCompact` now defaults to `true`.
- **Nodes are named the way a person would name them.** An `integration.invoke` is titled for its provider and captioned with its operation (`GitHub` / `create: pulls.reviews`, not `Integration` / `github.pulls.reviews.create`); a `provider_event` trigger is its provider (`GitHub` / `On pull request`); an `agent.run` is its profile and its model (`PR reviewer` / `claude-sonnet-5`); a `schedule` says its cron in English (`Weekdays at 09:00`); an action kind the model doesn't know yet is humanized rather than printed raw.
- **A `decision` (human-in-the-loop) step is modelled.** It previously fell through to the default branch and rendered a node titled `decision`; it now carries the title its author wrote, its options, and its own glyph.
- **Fixed: an `if`-guarded action rendered as a node titled `if`.** A `do` entry may carry control-flow siblings (`if`/`retry`/`onError`) alongside its action key, and YAML preserves the author's key order — so a guard written first was picked as the entry's "kind", producing a node that showed none of the action it guarded (and whose `config` was the guard's condition, not the action's). The kind is now selected by membership, not by position.
- **Contrast, in both themes.** Status colors (node border, badge, edge, progress) now resolve through the semantic surface tokens (`--surface-success-text`, `--surface-danger-text`, …), which carry a light AND a dark value, replacing literal hexes and stock palette shades (`#22c55e`, `text-red-400`) that could only ever read well in one theme. The smallest type is up (9px→11px for content) and the opacity-dimmed muted text (`/70`, `/80`) is gone.
- **The expanded card is reorganized**: identity (mark + title + subtitle), then what the step says (a two-line description — the agent's prompt, the notify URL, the trigger's events), then what it did (run metrics as one quiet line — `$0.03 · 8240/1409 tok` — rather than a row of boxes), then its output, over the pinned status footer. A node the run hasn't reached says "Not run yet" instead of showing an empty card.
- **Output reads as prose, not as a word dump.** An agent's markdown answer is condensed for the preview (headings, bullets, emphasis, fences and links unwrapped to their words, list items separated) so the two visible lines are two lines of WORDS. The full text is unchanged in the node's detail view.
- **The graph no longer shrinks itself past legibility.** `fitView` gains a zoom floor: a long pipeline in a short panel stops shrinking and becomes pannable instead.
- **Layout:** every card band is a `shrink-0` row inside an `overflow-hidden` region, and the reserved row heights are the measured rendered ones — so a band can no longer be flex-squeezed into a half-cut line of text (which is what clipped the agent prompt), and the pinned footer can never be pushed off the card.
- **The graph's TB (top-to-bottom) direction is laid out for its own geometry.** A compact node's name sits UNDER its tile in LR but BESIDE it in TB — because an edge leaves the tile's trailing edge, which in TB is the bottom, i.e. exactly where a name below it would be. Every outgoing edge was being drawn straight through the node's own label. Handles are now anchored to the tile's edge midpoints in one explicit coordinate system, rather than relying on React Flow's per-side offsets (which put the bottom one half a handle past the tile).
- **Fixed: an error message could be silently rewritten.** The markdown condenser was applied to every text output — including a failure's error. It turned a traceback's `__init__.py` into `init.py` and deleted both halves of a shell glob (`src/**/*.ts` → `src//.ts`). Condensing is now opt-in and used ONLY for an agent's own markdown answer; an error, and any non-agent node's output, reaches the reader exactly as it arrived.
- **Fixed: `describeCron` could confirm a broken cron as correct.** `*/90 * * * *` was translated as "Every 90 minutes"; cron steps within a field, so it actually fires hourly. A step is now only translated when it divides its field evenly (60 / 24), and falls back to the raw expression otherwise. `0,7` no longer reads "Sun, Sun".
- **The action kind is selected by EXCLUDING control flow**, not by matching a list of known kinds — so a guarded action of a kind this library doesn't know yet (`agent.review`) still renders as that action instead of as a node titled "if". The `if`/`retry`/`onError` envelope now rides along in the node's `config`, so the detail view can show that a step is conditional or retried.
- **A connector is named, not slugged:** `google-sheets` → "Google Sheets" (was "Google-sheets"), and an initialism survives humanization (`listAPIKeys` → "list API keys", not "list api keys").
- **Breaking (minor):** `WfNodeData` drops `detail` (superseded by the full `config`, which every consumer already reads) and gains `description`. `BuildWorkflowGraphOptions` replaces `measure` with `compact`. `COMPACT_NODE_SIZE` is joined by `COMPACT_NODE_SIZE_RUN`, `COMPACT_NODE_SIZE_TB`, `COMPACT_TILE`, `COMPACT_GAP`, and `COMPACT_LABEL_W`. `classifyOutput` takes a second `condenseMarkdown` argument (default `false` — the safe one).

## 0.75.0

### Workflows

- The workflow node's run **progress bar is now a bottom-pinned status footer** instead of an inline strip. Previously the strip was laid out in the middle of the card's flex column, so its vertical position drifted with however much content sat above it and it landed at a different height on every node. The footer (`mt-auto`, a top border + the progress bar over a rounds/elapsed caption) always sits flush at the card's base, so the bar reads as one consistent line across the whole graph.
- Node output is now **content-aware**. A node's `outputPreview` was rendered as a single plain paragraph even when it was JSON (`{"status":200}`). Output is now classified and rendered under an `OUTPUT`/`ERROR` micro-label: a shallow JSON object renders as `key value` rows, a JSON array or a host-clamped fragment renders in monospace, and prose renders as prose.
- No public API change: `WfNodeState`/`WfNodeData` are unchanged and the graph is a drop-in. The status footer + output renderer share new internal `node-ui`/`node-output` modules (not part of the package's export surface).

## 0.74.0

### Workflows

- `WorkflowGraph` is redesigned as a left-to-right layered flow. The trigger→action spine advances horizontally and `parallel`/`foreach` branches now fan out and **reconverge** onto the next step via fork/join edges (previously they dangled and dead-ended). Node positions are computed from authoritative fixed dimensions, so cards can never overlap — the old height-estimate collision is gone.
- Run state is far more legible: edges are colored by the status of the node they point at and the active hop animates, the running node gets a soft glow, and each node carries a redesigned card — a type icon (schedule/agent/integration/notify/parallel/foreach…), type-aware metric chips (an agent shows model · cost · tokens; a trigger shows only what applies), an output/error preview, and a **progress strip** surfacing agent **rounds** and elapsed time.
- New **compact/expanded density** with a toggle on the full graph: the `defaultCompact` prop starts collapsed, and the preview variant is always compact. Compact nodes are uniform icon tiles for scanning large graphs.
- New API: `WfNodeState.rounds`, a `direction` prop (`"LR"` default / `"TB"`) with orientation-driven handles, and `buildWorkflowGraph`/`buildFlowGraph` gain `direction`, `compact`, and `measure` (caller-supplied node sizing) options plus an exported `COMPACT_NODE_SIZE`.
- The workflow node/edge components now use the library's own canonical tokens (`foreground`, `muted-foreground`, `surface-container-high`, …) instead of utility names only the platform app registered, so they render correctly in any consumer (and in Storybook), not just under the platform's Tailwind config.
- **Breaking (minor):** `WfEdge` replaces `sourceHandle: "out" | "branch"` with `kind: "spine" | "fork" | "join"`. `WfNode` gains authoritative `width`/`height`. `WfNodeData` drops `hasBranches` (it fed the removed right-side branch handle) — infer a fan-out from the `kind: "fork"` edges sourced from a node instead. A consumer that read `edge.sourceHandle` from `buildWorkflowGraph` should switch to `edge.kind`; the rendered graph is unaffected.

## 0.73.0

### Styles

- `globals.css` gains a self-contained, token-driven `.tangle-prose` ruleset
  (headings, lists, links, blockquote, `hr`, inline code, `pre`, and
  hairline-divider tables that scroll horizontally on narrow viewports).
  `@tangle-network/ui`'s `Markdown` renderer (re-exported from this library's
  `/markdown`, `/chat`, and `/run` entries) emits a `tangle-prose` surface, but
  ui ships no `@tailwindcss/typography`, so structured markdown was unstyled in
  consumers that source prose CSS solely from `@tangle-network/sandbox-ui/styles`. Mirrors `@tangle-network/brand`'s
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
