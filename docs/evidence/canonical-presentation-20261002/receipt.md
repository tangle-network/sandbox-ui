# Canonical presentation browser receipt

The source branch starts from Sandbox UI `main` at `3b77b01` and prepares package 0.118.0.
The before images are the checked-in `main` Storybook snapshots at that revision.
The after images were captured from this branch's rebuilt Storybook in Chromium on GTR.
Storybook loaded bundled fonts, and every tested story was checked for runtime errors and document overflow.

| Surface and state | Before | After |
| --- | --- | --- |
| Page composites, light phone 390 × 844 | [PNG](primitives-heading--page-composites-light-mobile-before.png) | [PNG](primitives-heading--page-composites-light-mobile-after.png) |
| Page composites, dark phone 390 × 844 | [PNG](primitives-heading--page-composites-dark-mobile-before.png) | [PNG](primitives-heading--page-composites-dark-mobile-after.png) |
| Secrets page, light desktop 1440 × 900 | [PNG](pages-secretspage--manage-secrets-light-desktop-before.png) | [PNG](pages-secretspage--manage-secrets-light-desktop-after.png) |
| Secrets page, dark phone 390 × 844 | [PNG](pages-secretspage--manage-secrets-dark-mobile-before.png) | [PNG](pages-secretspage--manage-secrets-dark-mobile-after.png) |
| Workflow graph, dark phone 390 × 844 | [PNG](workflows-framing-candidates--narrow-host-dark-mobile-before.png) | [PNG](workflows-framing-candidates--narrow-host-dark-mobile-after.png) |
| Agent dock, dark phone 390 × 844 | [PNG](chat-artifactagentdock--existing-thread-dark-mobile-before.png) | [PNG](chat-artifactagentdock--existing-thread-dark-mobile-after.png) |

The canonical PageHeader slightly tightens title and description spacing.
The Brand 1.10 theme resolves semantic colors inside nested scopes.
WorkflowGraph now gives React Flow the host's resolved mode, so its dark tiles remain dark and readable.
The explicit vault workspace story resolves to a light surface as its theme requests.
The independent source review found that a graph in a nested Vault workspace still inherited the dark root's React Flow mode. The graph now reads the wrapper's computed scheme, before React Flow's own class can affect it. A dark outer page with a light nested workspace passed [desktop](../../../tests/visual/stories.spec.mjs-snapshots/workflows-workflowgraph--nested-vault-dark-desktop-linux.png) and [phone](../../../tests/visual/stories.spec.mjs-snapshots/workflows-workflowgraph--nested-vault-dark-mobile-linux.png) visual proof. All four nested light/dark desktop/phone cases passed snapshot creation and a separate no-update replay; the focused workflow unit suite passed 371/371.

The first full visual run passed 1,416 of 1,466 cases and exposed 50 changed snapshots, including the graph defect.
After the graph correction, the full catalog passed 1,466 of 1,466 with 42 intentional snapshot updates.
A separate run of 76 affected stories passed without snapshot updates.
The remaining catalog stories retained their existing snapshots.

The packed 0.118.0 consumer installed UI 11.13.0 and Brand 1.10.0 at the declared peer floors.
It checked exact exports and types, compiled CSS without Tailwind, and host-compiled Tailwind CSS.
Both lanes passed light and dark at 390 and 1280 pixels with zero missing CSS rules or document overflow.
It also checked semantic headings, refs, card padding, painted card depth against the page and across themes, keyboard focus, and table scrolling.
The compiled CSS SHA-256 was `f4301af4333c376eae7926f8ba924c87e1547a8fbe34059b335e41aeca040ec0`.

No application adoption or published 0.118.0 artifact is claimed by this local receipt.
