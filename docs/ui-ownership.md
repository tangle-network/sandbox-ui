# UI ownership and consolidation

The four packages form a dependency chain: `brand` → `ui` → `sandbox-ui` → `agent-app`.
Keep imports moving in that direction so lower layers never depend on an app shell.

| Package | Owns | Does not own |
| --- | --- | --- |
| `@tangle-network/brand` | Tangle marks, design tokens, and named themes | Product workflows and third-party model logos |
| `@tangle-network/ui` | Generic controls, chat and run rendering, files, editors, hooks, and model-provider presentation | Sandbox workspace state and app-level picker decisions |
| `@tangle-network/sandbox-ui` | Sandbox dashboards, workspaces, integrations, workflows, terminals, and pages | Copies of generic `ui` components or Tangle artwork |
| `@tangle-network/agent-app` | Composed chat shells, composer controls, model and effort pickers, and hosted-agent flows | Copies of brand marks or lower-level rendering primitives |

## Checked overlaps

| Overlap | Evidence and caller | Decision |
| --- | --- | --- |
| Tangle logo artwork | `sandbox-ui/src/primitives/logo.tsx` repeated `brand/packages/brand/src/logo.tsx`. `DashboardLayout` uses Sandbox `Logo`, and `gtm-agent` imports the published `Logo` and `TangleKnot`. | Done here: retain Sandbox's public props, delegate rendering to Brand, and forward `TangleKnot`. |
| Model-provider SVG paths | `sandbox-ui/src/lib/provider-logo.tsx` and `agent-app/src/web-react/provider-logo.tsx` contain the same provider path table. Sandbox `model-brand` uses one; Agent App picker and Studio controls use the other. | Move the shared SVG data and renderer to `ui` after its public fallback contract is settled. Keep the two callers' fallback colors explicit. |
| Generic UI exports | Sandbox's `primitives`, `chat`, `run`, `files`, `editor`, `hooks`, and other barrels forward `ui` bindings. The packaged identity test checks those imports. | Keep the bridges while consumers use these subpaths. Do not reimplement a forwarded component in Sandbox. |
| Agent controls | Sandbox's legacy composer and pickers were removed. `agent-app/web-react` now owns `ChatComposer`, `ModelPicker`, `EffortPicker`, and `AgentSessionControls`. | Keep those compositions in Agent App. Coordinate any hosted-agent change with its current owner. |
| Integration logos | Sandbox's integration `ProviderIcon` resolves connector URLs and fallbacks. The model-provider SVG table resolves model vendors. | Keep both because they serve different identifiers and failure paths. |
| Theme values | Brand's tokens style Sandbox and generic UI. Agent App has a light-default theme, dark scope, and Konva color mirror with contract tests. | Reconcile semantic values only after checking both theme scopes and the canvas mirror in real consumers. |

## Next consolidation sequence

1. Add a model-provider logo entry to `ui` with the shared SVG table and a theme-safe fallback contract.
2. Release `ui`; then replace Sandbox's local model logo table and run its bridge, package, and dark/light Storybook checks.
3. Coordinate with the Agent App owner before replacing its table. Check picker, Studio, and hosted-agent flows in a packed consumer.
4. Compare resolved Brand and Agent App theme values in both modes before moving any token. Keep Konva's bitmap palette until its runtime contract has an equivalent source.

This change removes 57 source lines and adds 17, for a net reduction of 40 source lines.
The [dark before](screenshots/logo-consolidation/before-dark.png) and [dark after](screenshots/logo-consolidation/after-dark.png) captures are byte-identical.
The [light before](screenshots/logo-consolidation/before-light.png) and [light after](screenshots/logo-consolidation/after-light.png) captures are byte-identical.
