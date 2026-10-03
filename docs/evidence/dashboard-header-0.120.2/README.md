# Responsive dashboard header

Candidate: `1bced0cf52a611cd5ac3141ba1e6106a6bda51e6` plus the 0.120.2 header patch.
Target: the actual built DashboardLayout Storybook story, at 1440×900 and 390×844.
The old mobile header reserved 248 pixels for a hidden desktop rail.
The new header fills the phone viewport and follows the visible rail on desktop.

| View | Before | After |
| --- | --- | --- |
| Phone, light | [Before](before-mobile.png) | [After](light-mobile.png) |
| Desktop, light | [Before](before-desktop.png) | [After](light-desktop.png) |
| Phone, dark | — | [After](dark-mobile.png) |
| Desktop, dark | — | [After](dark-desktop.png) |

Original, unaccelerated interaction recordings: [desktop collapse](desktop.webm), [mobile navigation](mobile.webm).
The browser geometry cases assert the real theme, header edges, desktop collapse and mobile menu.
[Measured bounds](geometry.json) accompany the captures.

The existing catalog theme global does not toggle the root dark class.
These captures and the new geometry cases explicitly set and assert actual dark/light state.
Correcting the global catalog theme labels is separate work.
Only four affected mobile pixel baselines were updated; desktop baselines are unchanged.
The previous dark-labelled catalog baseline was actually light, so no dark before comparison is claimed.

Native qualification: frozen install, typecheck, build, 91 affected tests and the packed artifact in fresh consumers pass.
The packed checks cover 25 JavaScript exports, three stylesheet exports and omitted optional editor peers.
These are package and catalog results; Admin adoption and its served deployment are separate consumer proof.
