# Changelog

## 0.23.2

### Sidebar rail scroll + shared theme toggle

- `SidebarLayout` / rail: the rail nav now scrolls when there are more items
  than fit the viewport height, instead of compressing the items or pushing the
  profile footer off-screen. `SidebarRailNav` is `overflow-y-auto min-h-0`,
  `RailButton` is `shrink-0`, and the header/footer are pinned (`shrink-0`) — so
  the logo stays on top and the profile (settings / sign-out) stays reachable at
  the bottom on short screens.
- `SidebarLayout`: new `showThemeToggle` prop renders a light/dark switch in the
  profile dropdown, driven by the shared `useTheme` hook — so apps get one
  consistent theme control instead of hand-rolling their own. Also exposed as
  `showThemeToggle` on `ProfileAvatar`.

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
