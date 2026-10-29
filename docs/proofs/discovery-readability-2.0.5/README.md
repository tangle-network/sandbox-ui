# Discovery graph readability proof

Source: `831fb24391220f82ade92b5e8d31bd1c485e6648`; Beelink2 gate `beelink2-209ac60e16c489aa6c6e3b4e4fc1d399`, 2026-10-29 UTC. Storybook fixture `workflows-agentgraph--hundred-workers` has 101 agents and 40 recorded tool metrics. These are package fixture recordings, not a production claim.

- [Desktop light, 1512×982](desktop-light.webm): uncut 7.44-second Playwright recording of initial readable layout, root collapse, selecting the last worker, pointer metrics and wheel scrolling, keyboard focus/End/Escape, and an opposite document theme around the scoped graph.
- [Phone dark, 390×982](phone-dark.webm): uncut 3.92-second recording of bounded pages, Next, selecting the last worker, keyboard metrics and dismissal, and scoped-theme verification.
- [Light initial](initial-light-1512.png), [dark initial](initial-dark-1512.png), [last phone page](101-agents-dark-390.png), [full metrics scrolled to tool 40](full-metrics-light-1512.png), [dark graph metrics inside light document](scoped-dark-1512.png).

The integration asserts pointer retention, complete recorded facts, keyboard scrolling, Escape, scoped ink/surface/elevation, bounded DOM and absence of document overflow. Six additional cases retain every node in a small selected-worker graph at 1×. All ten cases passed. All 41 intentional canonical PNG changes were reviewed before baseline commit `7a0404dc2a620c638e470dcafa6f8833c2d1dc05`.
