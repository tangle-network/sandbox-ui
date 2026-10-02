# Retained right panes

`WorkspaceLayout` normally unmounts its right content when the pane closes.
Set `keepRightMounted` to retain a visited terminal, editor, or preview until the layout unmounts.
The content first mounts when opened.
Closing parks its DOM in a hidden container.
Desktop and mobile relocation retain the same portal target.
This does not open a PTY or provision a resource; the supplied component owns those effects.

Set `collapsedControlsPlacement="overlay"` to float reopen buttons over the center instead of reserving edge columns.
The default remains `"edge"`.
Omit `centerHeader` and retain the default `centerHeaderVisibility="auto"` for a full-height conversation.

Story: `workspace-workspacelayout--retained-companion`.
The editable terminal field is a fixture that demonstrates retained state without a live runtime.
Server rendering does not mount the portal content; its host is created only in the browser.
