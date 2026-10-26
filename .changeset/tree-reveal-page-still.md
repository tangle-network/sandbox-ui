---
"@tangle-network/sandbox-ui": patch
---

The file tree and `CodeSurface` reveal their selection inside their own scrolling pane only. `Element.scrollIntoView` moved the window too, so a `WorkspaceFilesPane` below the fold scrolled the host page to its open file a few seconds after load.
