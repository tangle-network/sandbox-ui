# Workspace header density, 0.116.1

The baseline is Sandbox UI `cab92a32e1a645cd59ff6535ef8ecb5490f2bb15` (`0.116.0`).
The candidate is the `fix/workspace-header-density-20261001` branch based on that commit.
Both screenshots use the SandboxWorkbench Default Storybook fixture in Chromium on `drew-gtr-pro`.
The mobile baseline screenshot closes both drawers before capture.

| View | Before | After |
| --- | --- | --- |
| 1440 × 900 | [Two center header rows](../screenshots/workspace-header-density/before-desktop.png) | [One aligned pane header](../screenshots/workspace-header-density/after-desktop.png) |
| 390 × 844 | [Two center header rows](../screenshots/workspace-header-density/before-mobile.png) | [One pane header with edge controls](../screenshots/workspace-header-density/after-mobile.png) |

The baseline rendered a 56px shell header above a 64.5px transcript pane header.
The candidate renders no shell header and one 56px transcript header.
The desktop left, center, and right header borders all ended at viewport y=64px.
The 390px view had no document overflow, and both 32px edge controls stayed outside the transcript content.
The [long title fixture](../screenshots/workspace-header-density/long-title-mobile.png) kept its status visible and truncated the title and subtitle.

The [mobile drawer](../screenshots/workspace-header-density/drawer-mobile.png) received focus on open and retained focus during Tab navigation.
Escape and backdrop activation closed it and returned focus to the matching edge control.
The [closed drawer view](../screenshots/workspace-header-density/edge-controls-mobile.png) kept both reopen controls keyboard accessible.
Desktop Enter reopened the left pane; Control+B collapsed it again.
Resizing an open mobile drawer to 1200px removed the modal, displayed the desktop pane, and focused its collapse control.

The browser reported no page errors or horizontal overflow in these fixtures.
This is Storybook proof of the shared component, not a served GTM or Agent App deployment check.
