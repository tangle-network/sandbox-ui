---
"@tangle-network/sandbox-ui": minor
---

`./primitives` and the root entry forward every `@tangle-network/ui/primitives` export with `export *` instead of hand-typed lists, so a primitive ui adds is reachable here without a sandbox-ui change. No name is removed. Newly reachable: `MetricChart`, `SeriesSparkline` and the series helpers on `./primitives` and the root; `Breadcrumb*`, `HoverCard*`, `TerminalInput` and `TerminalCursor` on the root. The root `TerminalLine` type stays the workspace terminal line.

`@tangle-network/sandbox-ui/primitives` is deprecated as a compatibility re-export: new code imports `@tangle-network/ui/primitives`. Sandbox-ui keeps serving its own `Logo`, `TangleKnot` and `SectionTitle` there.
