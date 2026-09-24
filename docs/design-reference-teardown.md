# Sandbox UI design reference teardown

**Direction for Sandbox product teams:** keep the selected runtime visible as inspection context in developer workspaces.
Task and review products can lead with the task or artifact while retaining its runtime association.
This is a design hypothesis to test across consumers; a task may involve more than one runtime.
Chat can direct work, but a file, preview, terminal, log, or result should become the main surface when the task calls for it.
This extends the existing [UI direction](../UI-DIRECTION.md) into review criteria for the component and flow audit.

## Evidence and limits

I inspected public pages in Chromium on 2026-09-23 at 1440 × 900 and 390 × 844 CSS pixels.
The screenshots below are captures of those pages, not mockups or proof of signed-in product behavior.
E2B, Daytona, Modal, and v0 exposed useful public first views.
Replit and Lovable could not be accessed in this browser session; Cursor's agent URL stopped at a verification page.
For those three products, I used official product documentation and captured the documentation pages instead.
The cited docs establish documented behavior; the screenshots establish only the visible public composition.
No authenticated competitor task, accessibility audit, or performance comparison was run.

| Reference | Browser evidence | Behavior source | Source class |
| --- | --- | --- | --- |
| [E2B](https://e2b.dev/) | [desktop](screenshots/design-references-2026-09/e2b-desktop.webp), [mobile](screenshots/design-references-2026-09/e2b-mobile.webp) | [E2B Embed dashboard](https://github.com/e2b-dev/runtime/blob/main/embed/README.md) | Public page: inspiration; maintained runtime README: product evidence |
| [Daytona](https://www.daytona.io/) | [desktop](screenshots/design-references-2026-09/daytona-desktop.webp), [mobile](screenshots/design-references-2026-09/daytona-mobile.webp) | [Playground](https://www.daytona.io/docs/en/playground/), [web terminal](https://www.daytona.io/docs/web-terminal) | Public page: inspiration; official docs: product evidence |
| [Modal](https://modal.com/) | [desktop](screenshots/design-references-2026-09/modal-desktop.webp), [mobile](screenshots/design-references-2026-09/modal-mobile.webp) | [Developing and debugging](https://modal.com/docs/guide/developing-debugging), [deployment history](https://modal.com/docs/guide/managing-deployments) | Public page: inspiration; official docs: product evidence |
| [Vercel v0](https://v0.app/) | [desktop](screenshots/design-references-2026-09/v0-desktop.webp), [mobile](screenshots/design-references-2026-09/v0-mobile.webp) | [Sandbox](https://v0.app/docs/sandbox), [deployments](https://v0.app/docs/deployments) | Public product start: product evidence; official docs: product evidence |
| Replit | [Preview docs capture](screenshots/design-references-2026-09/replit-docs.webp) | [Preview](https://docs.replit.com/features/editor/preview), [task board](https://docs.replit.com/features/agent/task-board) | Official docs: product evidence; live app not observed |
| Lovable | [Preview toolbar docs capture](screenshots/design-references-2026-09/lovable-docs.webp) | [Preview toolbar](https://docs.lovable.dev/features/preview-toolbar), [publish](https://docs.lovable.dev/features/publish) | Official docs: product evidence; live app not observed |
| Cursor web | [Cloud Agent docs capture](screenshots/design-references-2026-09/cursor-docs.webp) | [Cloud Agents](https://cursor.com/docs/cloud-agent), [agent overview](https://cursor.com/docs/agent/overview) | Official docs: product evidence; live app not observed |

The public first views use four distinct hierarchies.
E2B uses an oversized uppercase display beside a terminal illustration, with sparse spacing and an orange primary action.
Daytona uses a two-column layout with smaller display type, a code sample, and a blue primary action.
Modal centers its heading and action over a wide green abstract shape; the first view has no inspectable product artifact.
v0 uses a narrow centered request field on white, then gives examples and template previews the next visual tier.
The desktop layouts fit within wide page margins; E2B and Daytona stack their media below actions on mobile.
The static captures do not establish motion behavior, so animation is not part of the recommendation.

## What transfers

### E2B: the machine is the product object

The public first view pairs one strong claim with a terminal-shaped machine artifact.
Its mobile view keeps the claim and actions readable before the machine moves below them.
E2B Embed's evaluation dashboard documents a sandbox list, templates, a terminal, and a filesystem inspector.
That establishes a useful product object: one selected machine with several ways to inspect it.

**Adopt:** keep sandbox identity, lifecycle state, and access scope visible while users switch between terminal, files, and preview.
Open an event's recorded output or current file when available, and label which version the user sees.
**Avoid:** copying terminal art, uptime numbers, or a dark industrial palette when those marks are not real runtime state.

![E2B public desktop first view](screenshots/design-references-2026-09/e2b-desktop.webp)

### Daytona: different tools, one active sandbox

The public first view pairs its claim with a small SDK code sample.
Its mobile layout stacks the action and code example without hiding the primary action.
Daytona's Playground documents Sandbox, Terminal, and VNC tabs that operate on the same active sandbox.
Its sandbox configuration can also produce code snippets from the chosen values.
Opening Terminal or VNC creates a sandbox with the configured values when none is active.
Running a new management configuration replaces the existing Playground sandbox.

**Adopt:** bind each workspace mode to the same selected sandbox and show the mode's real controls.
A terminal needs command input; a preview needs an address and reload; a file needs inspection and editing controls.
**Avoid:** tabs that switch only the heading while leaving the same generic chat input underneath.
Do not show a VNC or code mode unless the consumer can execute it.
If entering a mode creates or replaces a runtime, disclose the target and consequence before the switch.

![Daytona public desktop first view](screenshots/design-references-2026-09/daytona-desktop.webp)

### Modal: operational evidence belongs near the app

The public landing view uses a bright brand field, but it does not show enough application state to define the runtime UI.
Modal's product docs describe an App page with application and system logs, CPU, RAM, GPU, and call history.
The CLI prints a direct link to that App page, and deployment history supports App version rollback.

**Adopt:** make execution-specific evidence openable from its command result or agent event.
Put failures, timestamps, logs, resource data, and previous versions near the affected run.
**Avoid:** a dashboard of decorative metrics when users need the exact failed call and its evidence.
Do not transfer the landing page's glow into operational status styling.

![Modal public desktop first view](screenshots/design-references-2026-09/modal-desktop.webp)

### Vercel v0: intent first, then a shared working environment

The public start view gives the request field the most space, with examples and templates below it.
On mobile, that order remains clear without a second navigation system in the first view.
The v0 docs say each chat owns a sandbox with a Preview tab, logs, terminal, and code editor on one filesystem.
That filesystem can persist across multiple sessions in the chat.
The docs also separate the working sandbox from production deployment.

**Adopt:** begin a new task with a clear input, then promote the resulting artifact into a workbench.
Keep live preview, code, and logs tied to the selected workspace, with recorded outputs attributed to an execution and revision.
Distinguish working state from published state.
**Avoid:** making a large composer the dominant surface after users need to inspect or verify an artifact.
Do not imply that a successful preview means the deployed app is live.

![v0 public product start at desktop](screenshots/design-references-2026-09/v0-desktop.webp)

### Replit: a preview is a test surface

Replit's Preview docs show an interactive app view with device presets, developer tools, and a temporary URL.
Its task board docs separate drafts, active work, and work ready for review.
Active also includes queued tasks, and Ready does not prove that work passed independent checks.
The Done column can also include archived or cancelled tasks, so Done alone does not prove an applied result.
The visible documentation capture includes a vendor-provided Preview image, but the signed-in editor was not accessible here.

**Adopt:** attach a usable preview and its URL to the work it tests.
Expose responsive sizes and errors where a builder can act on them.
Give queued, running, reviewable, applied, failed, and cancelled work distinct states.
**Avoid:** adding every editor tool to the default shell before the user has a task that needs it.

![Replit Preview documentation in Chromium](screenshots/design-references-2026-09/replit-docs.webp)

### Lovable: point at the artifact to explain a visual change

Lovable documents preview modes for selecting elements, editing text, drawing an annotation, and commenting.
Each mode changes how the user acts on the preview, and unfinished edits must be sent or discarded before switching.
The docs keep publishing as a separate action from editing.

**Adopt:** let preview users point to an element or area when a written description is ambiguous.
Match the control to the action, keep draft edits visible, and require an explicit publish action.
**Avoid:** adding visual editing affordances to terminal, log, or file surfaces where pointing has no clear meaning.
Do not silently turn an annotation into a verified code change.

![Lovable Preview toolbar documentation in Chromium](screenshots/design-references-2026-09/lovable-docs.webp)

### Cursor web: finish with reviewable work

Cursor documents cloud agents that produce diffs, pull requests, screenshots, videos, logs, and a remote desktop.
Its general Agent overview documents local file checkpoints, separate from Git, and ways to steer running work.
The Cloud Agent docs page displays a product media frame, but the signed-in agent UI was not accessible here.

**Adopt:** a completed coding run should link to the changed files and the evidence used to check them.
Keep interruption, follow-up, and review actions close to the active run.
**Avoid:** forcing repository and PR controls into non-code Sandbox consumers.
Show only the evidence and actions supported by the current task.

![Cursor Cloud Agent documentation in Chromium](screenshots/design-references-2026-09/cursor-docs.webp)

## Direction for Sandbox UI

These references suggest a task-specific main surface with an explicit runtime inspection context.
Show runtime identity and lifecycle separately from execution status, duration, connection health, and failure reason.
Show the execution and artifact revision used for a preview, file, result, or log so users can tell whether it is current.
Label live views separately from recorded output, and disclose when historical content was not retained.
The main surface should show the selected artifact: preview, file, terminal, graph, result, or execution history.
The agent timeline should open the evidence associated with each event, or event details if there is no artifact.
Keep active edits, input drafts, scroll position, and terminal sessions when users switch panes.
Do not move keyboard focus or replace an actively edited pane just because a new artifact appears.
Distinguish unsupported modes, read-only inspection, denied access, temporary unavailability, and pending actions.
Distinguish a stopped execution from a stopped runtime and a disconnected client from either.
Show request sent, acknowledged, and completed as separate facts, with a recovery path after failure or lost connection.
Bind check results to the exact artifact revision; later edits make those results stale for the new revision.
Publishing names the revision, destination, and audience, and shows completion after confirmation.

On desktop, the current [workspace shell direction](../UI-DIRECTION.md#recommended-shared-component-model) can use parallel task and artifact panes.
On mobile, keep one primary pane visible and make labeled pane switching reachable with the software keyboard open.
Use the existing [theme strategy](../UI-DIRECTION.md#theme-strategy) and brand tokens instead of importing a competitor's palette.
Give the artifact more space than persistent chrome, reserve monospace for code and machine identifiers, and keep full identifiers accessible.
Use text or shape with status color, and make selected, focused, error, and disconnected states distinct.
The composer and agent controls remain owned by `@tangle-network/agent-app/web-react`, as the existing UI direction specifies.
Visible activity must correspond to real work; an idle skeleton or invented status should never imply progress.

The next rebuilds should prioritize the surfaces that make this model fail in a real task.
That means broken artifact opening, unclear run state, inaccessible controls, clipped mobile content, and hidden errors come before decorative refinements.
Validate the direction with tasks that select the right runtime, locate a failure, open its output, resume work, and distinguish draft from published state.
Compare task completion, wrong-context actions, lost work, and effort with the current flow.

## Quality rubric for the component and flow audit

Score each of the 96 components and five main product flows out of 10.
Keep **2/10 as the fixed planning assumption** throughout the lane.
Record the observed score separately, only after a check; unassessed is not a measured 2/10.
Score the actual rendered state in Storybook or a consumer, not source code alone.

| Dimension | Points | A full score requires |
| --- | ---: | --- |
| [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) | 0–2 | Applicable Level A and AA checks outside the two dedicated dimensions pass, including names, contrast, status messages, and target size. |
| [Keyboard use](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | 0–2 | All applicable actions work without a pointer; the widget's entry, navigation, activation, dismissal, and exit contract works. |
| [Responsive behavior](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 0–2 | Actions and content work at desktop, mobile, narrow pane widths, and 320 CSS px reflow without unjustified two-axis scrolling. |
| Visual polish | 0–2 | The primary task and current state are legible at first glance; text fits, hierarchy is clear, and artifacts have enough room. |
| Consistency | 0–1 | The component uses owned tokens, language, states, spacing, and interaction patterns across both themes. |
| [Performance](https://web.dev/articles/inp) | 0–1 | Representative rendering and interactions have measured responsive behavior; field INP is at most 200 ms at p75 when available. |

Mark each dimension Pass, Partial, Fail, Unmeasured, or Not applicable.
Award full points for Pass, half for Partial, and zero for Fail or Unmeasured; require a reason for Not applicable.
Normalize earned points over applicable points to 10, and report the applicable denominator and evidence coverage beside the score.
The WCAG conformance gate still checks keyboard and reflow criteria; their point allocations appear in the dedicated dimensions above.
Record the inventory commit, component or route, state, WCAG criterion ID, check method, and screenshot, recording, or trace for each finding.
An automated accessibility scan can find defects but cannot establish WCAG conformance by itself.
Component checks contribute evidence; they do not establish conformance for a complete consumer page or process.

For each component, inspect relevant default, focus, disabled, selected, expanded, loading, empty, error, overflow, and permission states in both themes.
Also inspect stale or disconnected states and a runtime switch while an earlier request remains pending, where relevant.
Capture desktop at 1440 × 900 and mobile at 390 × 844; test actual pane widths, 200% text, and 320 CSS px reflow.
For each flow, use the real consumer route and exercise success, failure, keyboard operation, and return to work after an interruption.
Name the five flows, roles, prerequisites, and expected outcomes in the audit ledger; never infer a flow pass from component averages.
Use a performance trace or field metric for flows; profile render and layout work for components without interaction.
Report field INP by device, p75, time window, and sample count; label lab traces and measure operation readiness separately.
Use a manual screen reader check alongside automated scans for components that expose content or controls.
Do not silently convert missing evidence into a pass or finalize acceptance with required evidence unmeasured.

An 8/10 score is the rebuild target, not a waiver for an applicable Level A or AA failure in the declared scope.
Wrong-runtime actions, lost work, false state, exposed data, and incomplete core tasks also block acceptance regardless of the score.
Fix and recheck each blocking failure before accepting a component or flow.
