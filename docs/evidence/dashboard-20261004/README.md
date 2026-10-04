# Dashboard package check — 2026-10-04

Source base: `57de49a`. Package candidate: `@tangle-network/sandbox-ui@0.122.0`.

## Verified

- Beelink1 WSL, Node 24.21.0, pnpm 12.6.0: frozen install and `pnpm typecheck` passed.
- Affected tests: SandboxTable 51, SandboxCard + SecretsPage + StartupScriptsPage 67; all passed. Covers missing/invalid telemetry, measured zero, expired status, callback propagation, permission-gated Delete, and existing form operations.
- `pnpm build` passed. Existing rolldown bundler timing warning is informational.
- Final packed candidate `/tmp/sandbox-dashboard-final0122/tangle-network-sandbox-ui-0.122.0.tgz`; SHA256 `adae4c2e24376458b8b3d99318be90c99303cb1502f630941971dd20be0883c8`.
- `SANDBOX_UI_TARBALL=<candidate> pnpm test:package` passed: fresh consumer build across 25 JS and 3 CSS exports, with normal and omitted optional peers.
- Chrome Storybook: desktop 1488×906 and phone 390×844. Actual table rows measured 72px. Open/Wake and overflow controls remain visible without clipping. Menu → Stop updates the row and hides Resources when no valid running telemetry remains. Light and dark captures included. Browser viewport reset afterward.
- Secrets and Startup Scripts desktop before/after capture uses the same viewport. Phone script header/actions wrap cleanly. No API workload was launched.

## Evidence

| Surface | Before | After |
| --- | --- | --- |
| Table | [Dark desktop](table-before-dark.png) | [Dark desktop](table-after-dark.png), [light desktop](table-after-light.png), [dark phone](table-phone-dark.png), [light phone](table-phone-light.png) |
| Secrets | [Dark desktop](secrets-before-dark.png) | [Dark desktop](secrets-after-dark.png) |
| Scripts | [Dark desktop](scripts-before-dark.png) | [Dark desktop](scripts-after-dark.png), [light desktop](scripts-after-light.png), [dark phone](scripts-phone-dark.png) |

[Menu click sequence](menu-click-sequence.gif) combines actual browser captures before opening the menu, after opening it, and after choosing Stop. It is a screenshot sequence, not a continuous screen recording.

## Limits

These are maintained Storybook components with fixture data and in-memory callbacks, not a production sandbox lifecycle recording. The consumer application must adopt the published package and prove its actual routes. Billing tab source was checked and compiled; no paid billing action was performed. Before captures are desktop/dark only; phone and light captures show the changed state. Whole-repository tests and hosted CI were not watched or expanded for this change.
