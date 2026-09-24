# Critical component visual gate

This is a browser comparison gate over the built, maintained components. It is
not a product activation test or a claim of WCAG conformance.

## Run

```sh
pnpm install --frozen-lockfile
pnpm build-storybook
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test --config playwright.ui.config.ts
```

The installed `playwright` package already supplies `playwright/test`; this does
not introduce a second browser-test dependency or change the lockfile. Vitest's
owned `src/**/*.test.*` suite remains separate.

Six projects cover desktop, tablet and phone in both supported sandbox themes.
The test discovers actual states from the built index for inventory, changes,
diff, preview and terminal modules. A missing module or zero selected states
fails discovery. Runtime exceptions, empty roots, unexpected external requests,
and page-level horizontal overflow fail before a screenshot can be accepted.
The clock, locale, timezone, reduced motion and screenshot behavior are fixed.
There are no broad masks and no retry that silently discards a differing render.

## Initial baseline and updates

No expected PNGs are fabricated in this change. The first comparison run must
fail on absent expected images and retain actual images in the workflow artifact.
A build or capture is **not** approval. Missing expected images remain a release
blocker until reviewed.

Review the actual images and interactions in the same Linux runner/browser/font
environment. Record the source commit, lockfile, runner image and browser version.
Inspect long lines, the end of each pane, mobile actions, focus, busy/error text,
and light/dark contrast. Never approve an empty story, a broken resource, or an
unexplained clipped surface just to make the gate green.

A deliberate baseline update is:

```sh
pnpm exec playwright test --config playwright.ui.config.ts --update-snapshots
```

Run that command only in the review environment after confirming the candidate
state. Commit the resulting `tests/visual/__screenshots__` PNGs in the reviewed
PR. Normal CI sets `updateSnapshots: "none"` and passes no update flag. Review
must identify why each changed image is intentional. Keep browser or font upgrades
in a dedicated change; do not mix mass baseline regeneration with product work.

When adding a critical story module, add its exact source path to the selection
in `critical-stories.spec.ts`. State names come from Storybook's compiled index,
not a guessed slug. On each product integration, also run the product's task and
failure-state tests; the catalog cannot verify authentication, billing, sandbox
execution, or approval enforcement.

Required status after baseline approval: `Critical UI visuals / compare`.
Repository branch protection must require that status; this source change alone
does not configure repository settings. The release owner must activate it.
