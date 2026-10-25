---
"@tangle-network/sandbox-ui": patch
---

DiffView renders on @pierre/diffs 1.6. It built FileDiff with a third argument of `false`, 1.5's `isContainerManaged`; 1.6.0 (2026-10-20) made that argument the `requestOwnerRender` callback and calls it whenever it is not null, so every DiffView threw "e is not a function" and drew an empty pane. The argument is left out, which renders the same on 1.5 and 1.6.
