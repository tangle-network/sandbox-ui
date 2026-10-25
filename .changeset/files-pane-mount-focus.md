---
"@tangle-network/sandbox-ui": patch
---

`WorkspaceFilesPane` no longer focuses Back when it mounts with a preview already open, so a page that opens on a preselected file keeps its scroll position (on a 390 px phone the run header scrolled off-screen). Opening and closing a preview still move focus, without scrolling.
