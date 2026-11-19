# Sidebar navigation and motion

The original screenshots and recordings were retired because they displayed identifying account details. The following results describe those runs.

At revision `b860006f`, all 21 navigation tests passed. A snapshot update rendered 28 images. The 14 dark-theme images changed and the 14 light-theme images retained their previous hashes. The update run measured which baselines changed.

At revision `ff197828`, all 21 navigation tests and all 28 comparisons against the saved images passed without retries. The phone checks covered opening and dismissing the menu, restoring focus, and changing the reduced-motion preference. The desktop checks covered expanding and collapsing navigation groups and the rail. The attempted check of the preceding header implementation at `97911207` ended before a browser ran.

To check the current sidebar, build Storybook and run the navigation and SidebarLayout visual tests on Linux. The stories use a fictional account.

```sh
pnpm build-storybook
pnpm exec playwright test tests/visual/sidebar-navigation.spec.mjs
pnpm exec playwright test tests/visual/stories.spec.mjs --grep dashboard-sidebarlayout
```
