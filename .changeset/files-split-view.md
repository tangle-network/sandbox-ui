---
"@tangle-network/sandbox-ui": minor
---

`WorkspaceFilesPane` keeps the tree and the open file side by side by default (`layout="split"`) from 640 px of the pane's width, with a resizable sidebar: an ARIA separator you drag or move with the arrow keys (Shift for larger steps, Home/End), double-click resets it to 280 px, it stays between 200 px and half the pane, and it is remembered per viewer under `expansionKey`. The viewer fills the rest with its own scroll and a sticky path header. Narrower, or with `layout="stack"`, the preview replaces the tree until Back.
