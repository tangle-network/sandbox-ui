# Sandbox table text contrast

## Execution

- Before source: `a23be8d63dfdaf10aa512d7a22f3ca524f6e55ec`, after the Status width correction and before this contrast fix.
- After source: `095b15cefa146ec8196169046a0dde5ac6e59a61`, including the seven-status story and rendered contrast guard.
- Target: locally served static Storybook at `http://127.0.0.1:6954`, built on GTR from the after source.
- Viewports: desktop `1440×900`, phone `390×844`; both light and dark themes.
- Data: Storybook fixtures, with no authenticated consumer or backend request.

## Before and after images

The matching `LongNamesWithScope` images show the table at each viewport and theme.
The before images live at the before revision; the after images live at the after revision.

| Theme | Desktop | Phone |
| --- | --- | --- |
| Light | [Before](https://github.com/tangle-network/sandbox-ui/blob/a23be8d63dfdaf10aa512d7a22f3ca524f6e55ec/tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-light-desktop-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-light-desktop-linux.png) | [Before](https://github.com/tangle-network/sandbox-ui/blob/a23be8d63dfdaf10aa512d7a22f3ca524f6e55ec/tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-light-mobile-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-light-mobile-linux.png) |
| Dark | [Before](https://github.com/tangle-network/sandbox-ui/blob/a23be8d63dfdaf10aa512d7a22f3ca524f6e55ec/tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-dark-desktop-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-dark-desktop-linux.png) | [Before](https://github.com/tangle-network/sandbox-ui/blob/a23be8d63dfdaf10aa512d7a22f3ca524f6e55ec/tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-dark-mobile-linux.png) · [After](../../../tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--long-names-with-scope-dark-mobile-linux.png) |

[Light seven-status desktop](../../../tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--status-contrast-light-desktop-linux.png) and [dark seven-status desktop](../../../tests/visual/stories.spec.mjs-snapshots/dashboard-sandboxtable--status-contrast-dark-desktop-linux.png) cover Running, Failed, Provisioning, Creating, Stopped, Hibernating, and Archived.
The table scrolls; the guard reaches the seventh row below the screenshot crop.

## Interaction video

[Play the six-second MP4](hover-playback.mp4) or inspect the [uncut Playwright WebM](hover-original.webm).
The browser moved over Running and Failed rows in dark theme, then repeated both hovers in light theme.
The row highlight and name color changed without moving the table or losing the action controls.
Chromium played the full `0–5.96s` MP4; inspected frames at `1.5s` and `4.5s` show both themes.
The MP4 is a format copy of the original at normal speed.

## Observed result and limit

Before: Provisioning, CPU percentage, allocation text, and Resume measured `1.78:1` in dark mode.
After: those text roles measure at least `6.10:1` light and `6.62:1` dark on the rendered surface.
The hovered name measures `5.45:1` light and `6.15:1` dark.
All seven status labels measure at least `4.90:1` light and `5.98:1` dark across rest and hover.
The success and error dots retain their signal colors; their adjacent text uses readable Brand semantic tokens.
The fixture proves the packaged component rendering in Storybook, not a deployed consumer screen.
