/**
 * Harness ↔ model compatibility policy, re-exported from its canonical home.
 *
 * The policy itself — which models a harness can run, which native harness a
 * model belongs to, and how to snap an incompatible pair — lives in
 * `@tangle-network/agent-interface`, the single source of truth shared with the
 * cli-bridge backends and the router.
 *
 * The UI adapters this module used to carry (mapping the legacy pickers'
 * catalog shape onto the policy) were removed with the legacy pickers: use
 * ModelPicker / AgentSessionControls from @tangle-network/agent-app/web-react.
 */

export { modelProvider, snapHarnessToModel } from "@tangle-network/agent-interface";
