# Agent messaging connection review

The prior catalog had no `AgentMessagingConnection` story.
Its [immutable manifest](https://223ffae3.sandbox-ui-storybook.pages.dev/catalog-manifest.json) lists 320 stories and no connection component.
The new component was reviewed at source merge `9f44d88658fdc315ccdf3fc7f3d9a889a5ddaab0`.
The [immutable Storybook fixture](https://fbb0433c.sandbox-ui-storybook.pages.dev/?path=/story/connections-agentmessagingconnection--ready-to-enroll) lists nine states and 329 stories.
That catalog's source identifier is `a7813bb644c1258e8be6d531e05ccddf68a37755`, the tested pull request merge revision.

The matching state screenshots show the same component before enrollment and after the host reports an authorized connection.
The captures use dark phone at 390 × 844 and light desktop at 1440 × 900.
The phone capture also shows the intermediate enrolling state.
The full visual gate passed 1,447 cases across light and dark themes and desktop, tablet, and phone viewports.

The [normal-speed MP4](./enrollment-interaction-playback.mp4) and [uncut Playwright WebM](./enrollment-interaction-original.webm) show the phone fixture's Connect agent action.
The recording starts in the eligible state, clicks Connect agent, and ends in the enrolling state.
The shared conversation destination and Open messages action stay hidden while the host result is unconfirmed.
The recording lasts 4.44 seconds at 390 × 844 and contains no account data.
The video frames were inspected at 0.7, 2.2, and 3.8 seconds.

These are self-contained Storybook fixtures, not a live Builder enrollment or Hub route.
The host integration, grant recheck, canonical target, and application/member routing require separate consumer proof.
