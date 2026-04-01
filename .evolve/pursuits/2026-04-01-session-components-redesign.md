# Pursuit: Session sidebar + activity monitor redesign
Generation: 1
Date: 2026-04-01
Status: building

## System Audit

### What exists and works
- SessionSidebar: functional search, filters, sort, status dots, badges
- SessionActivityMonitor: tracks active sessions per project via nanostores
- Token system: all vars resolve in both dark and vault themes
- Storybook stories for both components

### User feedback
- "session sidebar and activity monitor are still weak"
- "look neglected, I don't like the design it looks worse than everything else"
- "don't have light theme" (fixed: bg-card works, but gradient effects were dark-only)
- "storybook toolbar for switching themes disappeared"

### What's wrong (root cause)
1. Components were built utility-first without visual design intent
2. No light theme QA — decorator wasn't setting data-sandbox-ui
3. Activity monitor uses nested cards-in-cards — visually heavy
4. Session items lack visual hierarchy — status dot is tiny, no clear active/running distinction
5. Stories hardcode data-sandbox-theme="operator", bypassing the toolbar decorator

## Diagnosis
The session components are structurally sound but visually unfinished. They need:
- A coherent visual language matching the rest of the library
- Proper light theme support tested via storybook
- Stories that respect the global theme toolbar (not hardcode operator)

## Generation 1 Design

### Thesis
Session components should feel like a natural extension of the sidebar rail —
same depth system, same accent treatment, same compact density.

### Changes
1. Fix storybook theme toolbar (Storybook 8 API change) — done
2. Fix decorator to set data-sandbox-ui on documentElement — done
3. Update all session stories to NOT hardcode theme (let toolbar control it)
4. SessionSidebar: visual polish with accent treatment on active item
5. SessionActivityMonitor: flatten nested cards, tighter layout
6. Add light theme story variants
