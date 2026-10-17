# Sidebar motion proof — #10197 / #429

Capture source: `b860006f27b155bf4018ef0b5d4f54b2c7335a01`.
Normal maintained Beelink gate `beelink1-2a58111e4a9fbff6e801a7de0b4fe81a` exited0: frozen install, typecheck, build,88 built-export identity checks and Storybook passed. Managed Node22.23.3; admission wait69s, run177s, no starvation/timeout/override.

The uninstrumented navigation suite passed21/21, workers2, retries0, no flakes/skips. The static update run completed28/28 captures and proposed exactly14 dark PNG changes; all14 light hashes stayed unchanged. Both reviewers opened all14 before/after pairs. **The update run is not a frozen-baseline comparison.** The final commit adds only reviewed goldens and these proof files; the final binary/proof head and its normal non-update comparison receipt are recorded in [PR#429](https://github.com/tangle-network/sandbox-ui/pull/429).

These eight original, uncut recordings cover light/dark × normal/reduced × phone/desktop. Phone stories exercise open, repeated Escape/Enter dismissal reversals, changing reduced-motion preference, close, reopen, focus restoration and unlocked page. Desktop stories exercise inert group collapse/expand, rail collapse/expand without layout transitions, and a static Responding status under reduced motion. `manifest.json` records exact dimensions, durations, encoded metadata and hashes. Frame sampling at6fps and the passed DOM assertions informed coding-agent review; this is not a real-time playback, physical frame cadence, latency percentile, manual screen-reader/touch, human craft or production proof. The recordings retain initial fixture loading.

| Case | Uncut video | Full still |
| --- | --- | --- |
| phone dismissal reversal and preference changes light no-preference | [phone-light-normal.webm](phone-light-normal.webm) | [phone-light-normal.png](phone-light-normal.png) |
| desktop layout stays quiet and disclosure stays inert light no-preference | [desktop-light-normal.webm](desktop-light-normal.webm) | [desktop-light-normal.png](desktop-light-normal.png) |
| phone dismissal reversal and preference changes light reduce | [phone-light-reduced.webm](phone-light-reduced.webm) | [phone-light-reduced.png](phone-light-reduced.png) |
| desktop layout stays quiet and disclosure stays inert light reduce | [desktop-light-reduced.webm](desktop-light-reduced.webm) | [desktop-light-reduced.png](desktop-light-reduced.png) |
| phone dismissal reversal and preference changes dark no-preference | [phone-dark-normal.webm](phone-dark-normal.webm) | [phone-dark-normal.png](phone-dark-normal.png) |
| desktop layout stays quiet and disclosure stays inert dark no-preference | [desktop-dark-normal.webm](desktop-dark-normal.webm) | [desktop-dark-normal.png](desktop-dark-normal.png) |
| phone dismissal reversal and preference changes dark reduce | [phone-dark-reduced.webm](phone-dark-reduced.webm) | [phone-dark-reduced.png](phone-dark-reduced.png) |
| desktop layout stays quiet and disclosure stays inert dark reduce | [desktop-dark-reduced.webm](desktop-dark-reduced.webm) | [desktop-dark-reduced.png](desktop-dark-reduced.png) |

The ten Brand principle evidence rows and remaining acceptance limits are maintained in the PR description; no token values or policy are duplicated here.

## Header retirement fix qualification

The preceding section retains the original feature proof at `b860006`; those eight recordings remain unchanged. The additional header-presence fix is qualified at `ff19782804abb199f5377bdb4421761e98ad9c8a` by normal gate `beelink1-f36ef98df229eba2067a405ff36eee48`: frozen install, typecheck, build and Storybook passed, followed by **21/21 navigation cases and 28/28 frozen static comparisons**, workers2/retries0, with no failures, flakes, skips or snapshot updates. The tracked tree stayed clean.

Both normal-motion phone themes recorded the actual closed-but-mounted drawer with **one ReCenter header inside, one globally, and two running animations**. The original regression head `9791120` did not execute: its single development gate was canceled unadmitted after300s of CPU/checkout capacity waits. RED remains UNCHECKED; no before-failure observation is claimed.

- Light: [uncut video](header-retirement/light.webm), [open controlled menu still](header-retirement/open-menu-light.png).
- Dark: [uncut video](header-retirement/dark.webm), [open controlled menu still](header-retirement/open-menu-dark.png).
- [Actual closed-DOM samples](header-retirement/samples.json) and [source, gate, dimensions, durations and hashes](header-retirement/manifest.json).

Both unmodified original recordings retain fixture loading and were inspected through6fps filmstrips with the passed browser outcomes. This is package fixture qualification; no real-time playback, physical cadence, latency percentile, manual accessibility, human craft or production claim is made. A later proof-only commit can reuse this gate because executable inputs remain unchanged.
