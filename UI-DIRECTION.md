# Sandbox UI design direction

## Product contract

Make execution understandable. A developer must be able to identify a machine,
see what actually ran, inspect its output, understand its cost, and recover
without confusing unavailable data with an empty result.

The primary acceptance flow is the Sandbox product: signed out → authenticate →
create → see real command output → inspect a preview → stop safely. The second
is a GTM product flow: request a draft → inspect evidence → review the exact
proposal → approve or reject. A Storybook fixture supports these flows; it does
not establish that either product works.

Technical, professional, and white-label products share behavior and semantics.
They may choose different density and theme defaults. They must not fork
credentials, focus behavior, lifecycle semantics, or approval controls.

## Canonical ownership

| Layer | Owns | Does not own |
| --- | --- | --- |
| `@tangle-network/brand` | Foundation and semantic tokens, supported themes, typography, motion and density contracts | React components, product policy |
| `@tangle-network/ui` | Generic accessible controls, focus helpers, dialogs, menus, tabs and generic document primitives | Sandbox API calls, agent orchestration, product navigation |
| `@tangle-network/sandbox-ui` | Technical rendering: terminal, code, changes, artifacts, runtime status and composable pane primitives | Another composer, model/effort/harness picker, or composed application shell |
| `@tangle-network/agent-app` | Canonical composed agent shell, transcript, composer, model/effort/harness controls and assistant | Product billing policy, workspace authorization, duplicate technical renderers |
| Product adapter | Routes, authentication continuation, authoritative data, workspace scope, entitlements, cost and consent policy | Forks of shared components or client-only enforcement |

The dependency direction is brand → ui → sandbox-ui → agent-app → product.
A product can use lower layers directly. sandbox-ui must not import agent-app to
complete a component: the product supplies agent-app surfaces through composition
slots. Generic controls remain in ui; agent-specific controls remain in
agent-app. A menu is not agent-specific merely because it appears in an agent
product.

Keep these boundaries for the current delivery. A smaller package count is not
an outcome by itself. Consolidate duplicated implementations at their existing
owner before considering package mergers.

## Composer and picker canon

Use `ChatComposer`, `ModelPicker`, `EffortPicker`, and `AgentSessionControls` from
`@tangle-network/agent-app/web-react`. `ChatComposer` owns mentions, context items,
attachment lifecycle, send failure and retry, seed prompts, and quiet/labeled
controls. Its `sendVariant="icon"` supplies the circular send treatment.

The removed sandbox-ui `chat/AgentComposer`, `dashboard/ModelPicker`, and
`chat/AgentSessionControls` must not be recreated. Do not rebuild `ChatInput` or
add a replacement composer here. Fix the canonical agent-app implementation and
verify the affected product flow.

## Composition contracts

### Application shell — agent-app, integrated by products

The composed shell owns navigation slots, responsive pane layout, and controls.
Products own URL-addressable selection and workspace-scoped persistence. Use
sandbox-ui's technical panes inside that shell. Do not turn a sandbox-ui pane
primitive into a second application shell.

The resulting product supports an artifact area, optional agent conversation,
and a terminal/log area. Each remains useful independently. Resizing needs a
keyboard alternative. On small screens show one usable pane at a time rather
than squeezing a desktop IDE into the viewport.

### Agent transcript and decisions — agent-app

Assistant output, tool activity, warnings, pending decisions and completion
summaries belong in one inspectable task history. The state of a tool call must
not be confused with the state of the sandbox.

Approval must describe its effect. Bind consent to the exact proposal version,
targets, permissions, and spending boundary. A changed proposal invalidates
consent. The server enforces this; a disabled frontend button is not enforcement.
Approval is not inherently the safe default. Rejection, expiry, and correction
must remain easy and understandable.

### Artifacts and technical rendering — sandbox-ui

Keep one implementation for metadata, code, changes, files, runtime output and
preview chrome. Preserve existing diff and terminal engines. Adapters supply
content, readiness, errors, access policy, and actions.

Every long diff line must remain readable through wrap or local horizontal
scroll. Do not hide content behind `overflow-hidden` without an accessible
alternative. Binary, removed, loading and unavailable files need distinct states.

An execution view shows the command, output, exit status and connection state.
A terminal has an accessible transcript alternative and a documented keyboard
escape. Switching tabs must not destroy the underlying PTY or its history.

A preview distinguishes process started, port listening, HTTP ready and access
policy. A public/private label must describe the enforced backend behavior.
Opening a tab must not silently create or publicly expose a resource.

### Generic controls — ui

Use the existing accessible primitives and focus helpers. Fix an incorrect role,
name, keyboard interaction or focus indicator in the owning component. Do not
remove ARIA attributes with broad runtime DOM selectors or replace shared focus
styles in individual products.

## Theme and density

Brand is the source for foundation and semantic tokens. Consume semantic roles:
surface, panel, text, muted text, border, focus, accent, success, warning, danger,
selection and code. Do not introduce another token system in this package.

Support light, dark and system preference. The product selects its default;
white-label configuration may override approved brand roles, not status meaning
or accessibility requirements. Use comfortable and compact density without
shrinking keyboard focus or touch affordances below their requirements.

Libraries must not require remote fonts or logos at runtime. Font loading and
licensed brand assets belong to the product/build. Prefer reduced motion and
forced-color support over decorative animation.

## State and content rules

Model loading, success-empty, success-data, stale-data, unavailable, forbidden
and failure explicitly. Never turn a failed list into "No sandboxes". Never turn
an unknown price or usage value into zero. Scope every adjacent metric to the
same workspace and time range, or label the different scope visibly.

Pending controls retain an accessible name. Error messages say what failed,
what remains safe, and what action is available. Show request IDs without
leaking credentials, private prompts or provider response bodies.

Create, stop, delete, publish and approve are distinct actions. Explain whether
leaving a screen cancels a running operation. Preserve validated launch intent
through sign-in and routine recovery. Resource creation retries reconcile the
same operation before requesting another machine.

## Review and evidence

Required evidence for a touched critical component:

1. A component-to-story-to-state entry with actual Storybook IDs. Counting story
   files is not a coverage measurement.
2. Commit-addressed rendered review evidence in both themes, narrow and desktop
   widths, plus the affected keyboard interaction.
3. Unit/contract tests for state transitions and a product-flow test at the
   consuming adapter. jsdom tests do not establish visual or screen-reader
   quality.
4. Reviewed visual baselines. Missing expected images must fail; CI must not
   silently approve new screenshots.
5. An accessibility applicability record. Automated axe and contrast checks
   supplement, but do not replace, manual keyboard and assistive-technology
   tasks.

Use "Storybook catalog" for component catalogs, "trace storyboard" for the
eval/run-capsule scene IR, and "creative timeline" for the editing surface.
Do not call a design sequence an existing hosted storyboard without a URL and
owner. Do not report deployment, registry visibility or human testing as complete
on the strength of a build alone.

## Implementation order

1. Resolve ownership and verify the compatible brand/ui focus release chain.
2. Establish reviewable catalogs and critical-state gates.
3. Fix truthful async states, authoritative pricing, authentication continuation
   and idempotent creation in the product/runtime owners.
4. Improve existing diff, terminal, tab, file and preview surfaces in place.
5. Prove the Sandbox and GTM flows, including failure and consent states.
6. Migrate active consumers using verified symbols and tested package tarballs.
   Classify unowned consumers before proposing retirement.

Historical gap lists in older revisions are hypotheses, not current findings.
Reproduce a defect at a named commit before rebuilding an existing capability.
Do not trade product-flow evidence for release count, story count, or a parallel
component implementation.
