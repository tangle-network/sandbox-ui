# Storybook visual checks

Build Storybook before running `pnpm test:visual`.
The suite compares every built story in dark and light themes at desktop and mobile sizes.
Five critical modules also run at tablet size.
Five component interactions have separate screenshots.

Run the checks on Linux with the project's Playwright Chromium version:

```sh
pnpm install --frozen-lockfile
pnpm build-storybook
pnpm exec playwright install chromium
CI=1 pnpm test:visual
```

To accept an intentional visual change, run `CI=1 pnpm exec playwright test --update-snapshots` after the Storybook build.
Review changed PNGs before committing them.
Check both themes, mobile controls, long content, and the end of each pane.
New stories fail comparison until their screenshots are reviewed and added.
The regular test command never updates snapshots.

These checks exercise Storybook fixtures and component interactions.
They do not verify authenticated Sandbox actions or hosted consumer routes.
