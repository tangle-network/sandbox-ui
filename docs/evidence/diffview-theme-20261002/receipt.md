# DiffView app theme proof

The baseline is the public Storybook `Workbench/DiffView/ChangedLine` story on October 1, 2026.
Its served revision is not exposed; the matching source at `0d8afb3` hard-codes `themeType: "dark"`.
The after images use this branch's `LightTheme` and `DarkTheme` stories from a local Storybook server.
Playwright used Chromium with matching OS color schemes at 1440 × 900 and 390 × 844.

| View | Before | After |
| --- | --- | --- |
| Light desktop | [PNG](before-desktop-light.png) | [PNG](after-desktop-light.png) |
| Light mobile | [PNG](before-mobile-light.png) | [PNG](after-mobile-light.png) |
| Dark desktop | [PNG](before-desktop-dark.png) | [PNG](after-desktop-dark.png) |
| Dark mobile | [PNG](before-mobile-dark.png) | [PNG](after-mobile-dark.png) |

The light Storybook shell stayed `rgb(244, 243, 251)` in both runs.
Its diff shadow surface changed from `rgb(36, 41, 46)` with `color-scheme: dark` to `rgb(255, 255, 255)` with `color-scheme: light`.
The dark diff remained `rgb(36, 41, 46)` with `color-scheme: dark`.
All eight captures had zero page-level horizontal overflow and zero page errors.
[Browser readings](browser-proof.json) retain the URL, size, theme, and computed colors for each capture.

Checks: targeted Vitest, typecheck, package build, packed-consumer smoke, Storybook build, four renderer theme checks, and twelve catalog snapshot checks on the built Storybook.
