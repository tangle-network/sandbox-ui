# Storybook visual checks

`pnpm test:visual` builds Storybook and compares its stories on phones and desktops. Critical surfaces also run on tablets. Workflow graph screenshots wait for every canvas to finish layout and render nodes. Single-graph stories compare the graph viewport. Galleries and editors capture the whole composition.

To reproduce the release check on Linux, install Chromium first, then run the suite on an isolated loopback network:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
bwrap --dev-bind / / --unshare-net pnpm test:visual
```

To accept an intentional visual change, run `pnpm exec playwright test -g '<story-or-flow>' --update-snapshots=changed` after `pnpm build-storybook`.
Review changed PNGs before committing them.
Check both themes, mobile controls, long content, and the end of each pane.
Run the complete gate without snapshot updates before pushing.
New stories fail comparison until their screenshots are reviewed and added.
The regular test command never updates snapshots.

Every rendered story and flow fails on runtime errors, console errors, external requests, or document overflow above 1 CSS pixel.
The shared guard runs before capture and again after screenshots while the browser remains open.
Context request events detect redirects and service workers that bypass request routing.
Scrolling inside a component remains valid.
Storybook bundles fonts so visual checks do not depend on remote font services.
Integration fixtures also bundle their original provider marks.
Their source URLs and hashes are recorded in `src/stories/integrations/fixtures/logos/sources.json`.

These checks exercise Storybook fixtures and component interactions.
They do not verify authenticated Sandbox actions or hosted consumer routes.
