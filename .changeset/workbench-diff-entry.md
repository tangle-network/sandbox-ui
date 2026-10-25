---
"@tangle-network/sandbox-ui": minor
---

`@tangle-network/sandbox-ui/workbench/diff` exports `DiffView` alone, so an artifact-only consumer loads the diff without the terminal workspace (xterm). The packed-artifact smoke builds a clean consumer of both focused entries and checks for one shared UI directory and no xterm.
