---
"@tangle-network/sandbox-ui": minor
---

WorkspaceFilesPane is a read-only editor frame: opened files keep tabs in the split layout, `preview.compare` adds a File | Diff toggle (such as against the previous release), and a full-screen toggle returns on Escape (`tabs`, `expandable`, both on by default). TraceWorkspace opens the selected agent's transcript in a right-hand drawer (close button or Escape clears the selection, and `onSelectAgent` receives `undefined`), lifts that agent in the waterfall and dims its peers, and gives the code workspace the full width at no less than 70% of the viewport; the scoreboard renders only when given. WorkspaceFilesPane moves focus to Back only when the reader opened the file from the tree; a preview that arrives from an initial or loaded `selectedPath` leaves focus where it was.
