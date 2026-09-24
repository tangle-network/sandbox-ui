# Sandbox UI component and flow audit

**Decision:** keep the lane's **2/10 planning assumption** until the required consumer tasks pass.
The catalog exposes useful building blocks, but the current evidence does not support an accepted quality score for any complete product flow.
The [96-file ledger](component-quality-ledger.csv) records an evidence floor for every component and leaves its full quality score unassessed.
An evidence floor measures what the checks proved; it is not a claim that an untested component is poor.

## Scope and method

The inventory is the 96 non-test, non-story `.tsx` files under `src` at sandbox-ui commit `928f622`.
At capture time, the hosted [Storybook catalog](https://sandbox-ui-storybook.pages.dev/) had 25 story files and 155 story entries.
The later [catalog expansion](https://github.com/tangle-network/sandbox-ui/pull/288) added 64 story files after this audit's capture.
Its new stories require another browser pass before the evidence tiers or acceptance counts change.
I sampled 34 entries at desktop light, desktop dark, 390 px light, and 320 px light.
That produced 136 Chromium visits, 102 story screenshots, and no page errors.
The [story results](component-audit-story-results.json) retain widths, theme tokens, visible text, and a basic unnamed-control triage.
That triage is not an accessibility-name algorithm or a WCAG conformance scan.

The hosted catalog was deployed by [the merged Storybook workflow](https://github.com/tangle-network/sandbox-ui/actions/runs/35946599810) before the final capture.
Its `index.json` SHA-256 was `c1869c42a3dcc941266e9232ae0e7eddcc222f562ac4ec4a375f360b7a626cb8` after deployment.
The browser used 1440 × 900, 390 × 844, and 320 × 700 CSS pixel viewports.
The 320 px pass measured document overflow without storing another set of screenshots.
Dark and light desktop captures show the sampled first views, while other states remain unobserved.
Dark `renderedThemeToken` values are `null` because Storybook sets `data-sandbox-theme` to an empty string in dark mode.
Use the linked dark screenshots to inspect rendered styling; that metadata value alone cannot establish theme fidelity.

I opened eight real consumer URLs at desktop and mobile widths in an anonymous Chromium context.
The [consumer route results](component-audit-browser-results.json) include the final origin/path, preserved return path, response status, and screenshot.
All 16 visits had no page error; protected routes led to [Tangle sign-in](screenshots/component-audit-2026-09/consumer-dashboard-mobile.webp).
The [dashboard desktop capture](screenshots/component-audit-2026-09/consumer-dashboard-desktop.webp) was repeated after the visible sign-in heading and fonts loaded.
No test account, sandbox, payment, connector grant, or authenticated data was used.
The consumer source review used `agent-dev-container` commit `bd8ce2965f2b78836dea4acf69220c1b9bca5981` without editing its active checkout.
Source findings below describe code at that commit; their deployment and authenticated outcome are unverified.

The scoring rules are in the [design reference teardown](design-reference-teardown.md#quality-rubric-for-the-component-and-flow-audit).
The ledger uses `P` for a partial check, `F` for a demonstrated failure, and `U` for unmeasured.
Partial receives half its dimension's points; failure and unmeasured receive zero.
No dimension was marked Not applicable in this first pass.
Every full quality score remains unassessed because manual WCAG, complete keyboard tasks, and performance evidence are missing.

| Evidence tier | Component files | Verified evidence floor | What the tier establishes |
| --- | ---: | ---: | --- |
| Direct story subject | 13 | 2.5/10 | Sampled first views in both themes and a partial narrow layout check. |
| Direct story subject with narrow fixture gap or failure | 12 | 1.5/10 | Sampled first views; narrow behavior is blocked by the fixture or failed. |
| Import reachable or no story path | 71 | 0/10 | The story graph or source exists; no isolated rendered component check was scored. |

There are 25 direct story subjects, 46 additional files reachable through story imports, and 25 files with no story path.
The 25 without a path are eight asset files, seven pages, five chat files, four workspace files, and one auth file.
Reachability does not prove a branch rendered or that an action worked.
The stricter acceptance count is **0/96 components and 0/5 flows**; this is a coverage gate, not a reset of the 2/10 planning assumption.

## Five consumer flows

Each flow assumes a signed-in developer with permission for the named resource.
For the connector flow, the developer also needs a platform account and a provider that exposes actions.
The expected outcome names the task to test once an authorized test account is available.
Each row has the same **2/10 planning assumption**, a **0/10 verified flow evidence floor**, and an **unassessed full quality score**.
The anonymous redirect is an observed boundary check; it is not a completed flow.

| Flow and real route | Expected outcome | Observed boundary and unobserved task | Evidence and source risk |
| --- | --- | --- | --- |
| 1. Select a sandbox, `/dashboard` | Find the intended workspace, read its current state, and open it. | Sign-in preserved `/dashboard`; list data, failure, filtering, and selection were unobserved. | [desktop](screenshots/component-audit-2026-09/consumer-dashboard-desktop.webp), [mobile](screenshots/component-audit-2026-09/consumer-dashboard-mobile.webp). A list read can appear empty; see finding 1. |
| 2. Run an agent session, `/dashboard/sandbox/:id` | Send a task, see acknowledgement, execution, output, and a safe return after interruption. | Sign-in preserved the requested sandbox path; no real execution or reconnection was observed. | [consumer redirect](screenshots/component-audit-2026-09/consumer-session-desktop.webp), [workbench story](screenshots/component-audit-2026-09/story-workspace-sandboxworkbench--default-desktop-light.webp). The story uses fixture events. |
| 3. Inspect files, changes, and preview, `/dashboard/sandbox/:id?view=ide` | Open the right artifact and revision, inspect its contents, and navigate without losing context. | Sign-in preserved `view=ide`; live files and revisions were unobserved. | [consumer redirect](screenshots/component-audit-2026-09/consumer-artifact-mobile.webp), [mobile artifact story](screenshots/component-audit-2026-09/story-workbench-sandboxartifactpane--default-mobile-light.webp). The story exposes a narrow code pane; preview typing navigates early. |
| 4. Find a connector action, `/app/connectors` → `/app/connectors/:providerId` | Find a provider, inspect its action schema, and start the authorized action or connection. | Platform sign-in preserved both target paths; search result, schema, grant, and action were unobserved. | [catalog redirect](screenshots/component-audit-2026-09/consumer-connectors-mobile.webp), [catalog story](screenshots/component-audit-2026-09/story-connectors-connectorcataloglist--default-desktop-light.webp). Sandbox `/dashboard/integrations` is a stale-bookmark redirect to `/dashboard`. |
| 5. Configure and create, `/dashboard/new` | Select an environment, understand a current quote and limits, create once, and recover from failure. | Sign-in preserved `/dashboard/new`; quote, create response, and recovery were unobserved. | [consumer redirect](screenshots/component-audit-2026-09/consumer-provisioning-mobile.webp), [wizard story](screenshots/component-audit-2026-09/story-pages-provisioningwizard--one-page-desktop-light.webp). Static rate fallback and unnamed sliders require repair. |

The actual connector routes come from the [platform router](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/platform/web/src/client/main.tsx#L408).
The old Sandbox integrations path redirects to the dashboard in the [Sandbox router](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/sandbox/web/src/router.tsx#L141).
The anonymous browser result confirms the redirect before authentication, but it does not establish the signed-in destination's behavior.

## Ranked findings

The first four package findings were reproduced in the deployed Storybook or visible screenshot.
The remaining package and consumer findings are source verified and need an authenticated or assistive-technology check.
The [interaction log](component-audit-interaction-results.json) records the exact focused control, key, and resulting state.

| Priority | Finding | Evidence | Required result |
| --- | --- | --- | --- |
| P1 | A typed preview address changes the iframe `src` before Enter. The address has no associated label. The loading veil also clears after 1.5 seconds without a readiness proof. | [Interaction log](component-audit-interaction-results.json), [source](../src/workbench/preview-view.tsx#L27). | Keep an editable draft separate from the committed address; show loading, failure, and verified ready states. |
| P1 | The artifact story keeps a 240 px file tree beside code at 390 px, leaving roughly 100 px for code. | [mobile screenshot](screenshots/component-audit-2026-09/story-workbench-sandboxartifactpane--default-mobile-light.webp), [source](../src/workbench/code-view.tsx#L42). | Show a labeled tree/code switch on narrow panes and preserve the selected file. |
| P1 | `Code` then ArrowRight leaves focus and selection on `Code`; `Featured` then ArrowRight leaves focus on `Featured`. Both controls claim tab roles. | [Interaction log](component-audit-interaction-results.json), [PillTabs](../src/workbench/pill-tabs.tsx#L55), [integration sort](../src/integrations/integrations-panel.tsx#L192). | Implement the tab keyboard pattern and panel association, or use a named button group for sorting. |
| P1 | Three provisioning sliders have no associated labels. Advanced Options has no `aria-expanded` or `aria-controls`. | [Interaction log](component-audit-interaction-results.json), [wizard](../src/pages/provisioning-wizard.tsx#L1122). | Give each range a programmatic name and expose the disclosure state and target. |
| P1 | A sandbox-list fetch error can render zero cards and zero statistics while the failure remains unused. | [consumer source](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/sandbox/web/src/pages/dashboard/Sandboxes.tsx#L27). | Separate failed, stale, empty, loading, and populated states; retry without claiming an empty account. |
| P1 | A missing live rate resolves to static wizard defaults, while Create readiness checks only resource limits. | [consumer source](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/sandbox/web/src/pages/dashboard/NewSandbox.tsx#L196), [rate fallback](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/sandbox/web/src/pages/dashboard/sandbox-provisioning/useWizardCost.ts#L47). | Require a valid current quote before billable creation and show its source. |
| P1 | Signed-out public-template creation goes to bare `/login`; an unresolved selected version falls back to latest. | [consumer source](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/sandbox/web/src/pages/dashboard/PublicTemplateDetail.tsx#L85). | Resume the exact template and pinned version after sign-in; fail visibly if the version is unavailable. |
| P1 | Landing launch writes full user task text into the query string. | [consumer source](https://github.com/tangle-network/agent-dev-container/blob/bd8ce2965f2b78836dea4acf69220c1b9bca5981/products/sandbox/web/src/components/landing/HeroWorkspace.tsx#L263). | Keep task content in protected intent state and pass an opaque identifier through authentication. |
| P1 | Terminal Close is a click handler on an SVG nested in the terminal header button. | [source](../src/workspace/terminal-panel.tsx#L62). | Give Close a separate named button, independent focus stop, and keyboard activation. |
| P2 | Artifact selection is styled as active but has no programmatic selected state or panel relation. | [source](../src/workspace/sandbox-workbench.tsx#L207). | Expose current artifact and its panel, then verify keyboard and screen-reader navigation. |

The source also documents a polite live-region limitation in [StatusBanner](../src/workspace/status-banner.tsx#L64).
That needs a consumer with a persistent empty status region before dynamic messages can be trusted.
The ledger retains smaller source risks for BackendConfig and CreditBalance controls.

## Coverage blockers and next proof

At 390 px, 13 of 34 sampled states had document overflow; two exceeded the viewport by only 2 px.
The remaining 11 exceeded it by more than 2 px, as did 16 of 34 states at 320 px.
Several are explicitly fixed at 440, 560, 760, or 1000 px in story files.
These screenshots show a Storybook coverage problem; they do not prove the underlying component fails in a responsive consumer.
Provide responsive story variants for those components, then check the component inside a narrow host pane.
The ArtifactPane failure above is independent of that fixture issue because its default story wrapper has no fixed width.

The 25 files with no story path need a rendered fixture or an accessible real consumer route.
They include the asset editor, chat controls, auth button, secrets and startup-script pages, and workspace task surfaces.
For the five flows, use a test account with known data and a reversible sandbox.
Exercise success, failed reads, lost responses, keyboard-only completion, narrow layout, and a return after interruption.
Measure component interaction latency and the complete create-to-command path; no performance point was awarded here.
Run manual screen-reader checks with the automated scan and record the applicable WCAG 2.2 AA criteria.
Accept a component or flow only after these checks pass and the P1 findings are rechecked in the served consumer.
Wrong-runtime actions, lost work, false state, exposed data, and incomplete core tasks also block acceptance regardless of points.

## Control-name follow-up

The original ledger remains a snapshot of commit `928f622`.
The BackendConfig and CreditBalance control-name defects were corrected after that audit.
The [browser proof](screenshots/component-rebuilds/control-names-browser-proof.json) records eight desktop and mobile before/after captures, five control actions, and zero page errors.
Inspect the [BackendConfig before](screenshots/component-rebuilds/control-names-backend-before-390.png) and [after](screenshots/component-rebuilds/control-names-backend-after-390.png) mobile views for the labeled add form.
Inspect the [CreditBalance before](screenshots/component-rebuilds/control-names-credit-before-390.png) and [after](screenshots/component-rebuilds/control-names-credit-after-390.png) mobile views for the visible amount label.
The [keyboard recording](screenshots/component-rebuilds/control-names-keyboard.webm) shows target-specific removal in PortsList, NetworkConfig, and SandboxTable.
Full component scores and the 0/5 authenticated flow acceptance count remain unchanged until manual assistive-technology and consumer-flow checks pass.

## Mobile port actions follow-up

In the 390 px Storybook view before this repair, the Remove port 3000 button began at x=466.5 px.
The table clipped the button while document width remained 390 px, so the action had no visible scroll path.
The [before](screenshots/component-rebuilds/ports-before-390.png) and [after](screenshots/component-rebuilds/ports-after-390.png) screenshots show the change.
At 320 and 390 px, the updated port list keeps status, copy, and remove controls inside the viewport.
The [browser result](screenshots/component-rebuilds/ports-mobile-browser-proof.json) records six desktop and mobile captures, the control positions, keyboard copy and remove actions, and zero page errors.
The [keyboard recording](screenshots/component-rebuilds/ports-mobile-actions.webm) shows Enter copying port 5432's URL and removing only port 3000.
This Storybook component proof does not raise the 0/96 component or 0/5 authenticated-flow acceptance counts.

## Mobile process actions follow-up

The running process action began at x=452.5 px in the 390 px Storybook view before this repair.
The table hid that action without a scroll path, and its 320 px view also widened the document.
The [before](screenshots/component-rebuilds/process-before-390.png) and [after](screenshots/component-rebuilds/process-after-390.png) screenshots show the mobile change.
At 320 and 390 px, the process status and 40 px Kill control now fit inside the viewport.
The [browser result](screenshots/component-rebuilds/process-mobile-browser-proof.json) records six before and after captures, keyboard spawn and kill actions, and zero page errors.
The [keyboard recording](screenshots/component-rebuilds/process-mobile-actions.webm) shows Enter killing only PID 221 and spawning a new command.
The original ledger remains a snapshot; this package story does not prove a completed authenticated consumer flow.

## Text scaling and action feedback follow-up

The hosted #300 Storybook exposed further failures at 320 CSS px with 200% root text size.
The port number overlapped its status by 18 px, and the port and command fields had 0 and 1 px of usable inner width.
Three enabled controls failed text contrast: dark URL 1.79:1, light Expose 2.59:1, and dark Spawn 2.41:1.
Entering `3.5` also exposed port 3, while out-of-range and duplicate values left Expose enabled without feedback.
The [port before](screenshots/component-rebuilds/ports-before-textzoom-light-320.png) and [after](screenshots/component-rebuilds/ports-after-textzoom-light-320-2.png) images show the full port number and field.
The [process before](screenshots/component-rebuilds/process-before-textzoom-dark-320.png) and [after](screenshots/component-rebuilds/process-after-textzoom-dark-320-2.png) images show the full command field.
The [browser result](screenshots/component-rebuilds/textzoom-browser-proof.json) covers 20 local light and dark cases at 320, 390, and 1440 px, with no document overflow or page error.
At 320 px and 200% text, both fields now have 206 px of inner width; the port number and status no longer overlap.
The corrected enabled contrast pairs measure 6.65:1, 7.43:1, and 9.21:1 on the same Storybook states.
Fractional, out-of-range, and existing ports now disable Expose and show a linked error, as the [invalid entry](screenshots/component-rebuilds/ports-invalid-textzoom-320.png) shows.
A valid port still exposes with Enter.
The [port](screenshots/component-rebuilds/ports-textzoom-keyboard.webm) and [process](screenshots/component-rebuilds/process-textzoom-keyboard.webm) recordings show keyboard action and focus recovery.
An [isolated Orca run](screenshots/component-rebuilds/textzoom-orca-proof.txt) spoke the process exit result after Kill.
These are package-story checks; the original ledger, 0/96 full component acceptance, and 0/5 authenticated-flow acceptance remain unchanged.
