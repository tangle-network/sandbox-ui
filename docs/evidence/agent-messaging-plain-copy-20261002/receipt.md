# Agent messaging card copy

## Execution

- Before source: `44304c0636f83633b3d30fee681ce194cbbd0e2c`, with route terminology and the top caption.
- After source: `2feab97cdf8fff362ab178ac8ea5a99a92089f54`, with plain default status copy.
- Target: locally served static Storybook on GTR at `http://127.0.0.1:6954`.
- Viewports: desktop `1440×900`, phone `390×844`; light and dark themes.
- Data: Storybook fixtures without an authenticated host or backend request.

## Matching before and after screenshots

All four pairs show the `RoutePending` fixture at the same viewport and theme.
The after images are checked-in Playwright baselines from the after source.

| Theme | Desktop | Phone |
| --- | --- | --- |
| Dark | [Before](https://github.com/tangle-network/sandbox-ui/blob/44304c0636f83633b3d30fee681ce194cbbd0e2c/tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-dark-desktop-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-dark-desktop-linux.png) | [Before](https://github.com/tangle-network/sandbox-ui/blob/44304c0636f83633b3d30fee681ce194cbbd0e2c/tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-dark-mobile-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-dark-mobile-linux.png) |
| Light | [Before](https://github.com/tangle-network/sandbox-ui/blob/44304c0636f83633b3d30fee681ce194cbbd0e2c/tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-light-desktop-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-light-desktop-linux.png) | [Before](https://github.com/tangle-network/sandbox-ui/blob/44304c0636f83633b3d30fee681ce194cbbd0e2c/tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-light-mobile-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--route-pending-light-mobile-linux.png) |

[Checking dark phone](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--checking-dark-mobile-linux.png), [ready to enroll light phone](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--ready-to-enroll-light-mobile-linux.png), [connected dark desktop](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--connected-dark-desktop-linux.png), and [failed check light phone](../../../tests/visual/stories.spec.mjs-snapshots/connections-agentmessagingconnection--check-failed-light-mobile-linux.png) show the other key states.

## Interaction

[Play the 2.88-second MP4](enrollment-playback.mp4) or inspect the [uncut Playwright WebM](enrollment-original.webm).
The dark phone fixture starts eligible, focuses Connect agent by keyboard, and activates it with Enter.
The card changes to Connecting your agent; the destination and Open messages action remain hidden until host confirmation.
Chromium played the full MP4 from `0–2.88s`; inspected frames at `0.5s` and `2.2s` show both states.
The MP4 is a normal-speed format copy of the uncut original.

## Verification and limit

The 54 connection snapshots and the keyboard flow passed without updates after the baseline refresh.
Six component tests, typecheck, Storybook build, package build, and packed consumers with and without optional peers passed.
Playwright reported no horizontal overflow, page error, or external fixture request in these stories.
This fixture does not prove a live enrollment, a shared member route, or a deployed application.
