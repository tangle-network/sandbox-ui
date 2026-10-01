# Expandable sidebar density

The `Dashboard/SidebarLayout/ExpandableGroups` story renders expanded Apps and
History groups with an active app child and an emphasized History child.
The source component is `RailExpandable` in `src/dashboard/app-sidebar.tsx`.

The previous direct child link used `flex-1` inside a vertical disclosure.
That shorthand set a zero flex basis, so the open grid could compress its
28px declared height to an 18px used height in Hospitality.
History links appeared taller because Hospitality added a path-specific 34px
minimum height to `/chat/` and `/builder/` links.

The built Storybook frame was inspected after a three-second settle:

| Viewport and theme | App child | Plain History child | Emphasized History child | Apps chevron |
| --- | --- | --- | --- | --- |
| 1440px light | 32px, 14px text | 32px, 14px text | 32px, 14px text | 14px, opacity 1 |
| 390px light | 32px, 14px text | 32px, 14px text | 32px, 14px text | 14px, opacity 1 |
| 320px light | 32px, 14px text | 32px, 14px text | 32px, 14px text | 14px, opacity 1 |
| 390px dark | 32px, 14px text | 32px, 14px text | 32px, 14px text | 14px, opacity 1 |

The page had no horizontal overflow at those widths.
At each width, Enter on the Apps disclosure changed `aria-expanded` to `false`.
Space reopened it and changed `aria-expanded` to `true`.
The app child retained its active surface and the parent retained its active ring.

Screenshots: [1440px light](../screenshots/sidebar-expandable-density/1440-light.png),
[390px light](../screenshots/sidebar-expandable-density/390-light.png),
[320px light](../screenshots/sidebar-expandable-density/320-light.png), and
[390px dark](../screenshots/sidebar-expandable-density/390-dark.png).

This is shared-component evidence.
The consuming product must verify the package in its own CSS and navigation.
