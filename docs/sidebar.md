# Sidebar

VS Code Activity Bar-style sidebar with a 64px icon rail and a 260px slide-out panel. Extracted from [blueprint-agent](https://github.com/tangle-network/blueprint-agent) for reuse across all Tangle sandbox apps.

## Quick Start

### Option A: DashboardLayout (convenience wrapper)

```tsx
import { DashboardLayout } from "@tangle-network/sandbox-ui/dashboard"
import { Home, Folder, Layers } from "lucide-react"

function App() {
  return (
    <DashboardLayout
      navItems={[
        { id: "home", label: "Home", icon: Home, href: "/" },
        { id: "projects", label: "Projects", icon: Folder },
        { id: "batches", label: "Batches", icon: Layers, badge: 3 },
      ]}
      modeItems={["projects", "batches"]}
      panels={[
        { mode: "projects", title: "Projects", content: <ProjectList /> },
        { mode: "batches", title: "Batches", content: <BatchList /> },
      ]}
      activeNavId="home"
      user={{ email: "drew@tangle.tools", name: "Drew", tier: "pro" }}
      onLogout={() => signOut()}
    >
      <h1>Dashboard</h1>
    </DashboardLayout>
  )
}
```

### Option B: Full composition (custom layout)

```tsx
import {
  SidebarProvider,
  Sidebar,
  SidebarRail,
  SidebarRailHeader,
  SidebarRailNav,
  SidebarRailFooter,
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
  SidebarContent,
  RailButton,
  RailModeButton,
  RailSeparator,
  ProfileAvatar,
  useSidebar,
} from "@tangle-network/sandbox-ui/dashboard"
import { Logo } from "@tangle-network/sandbox-ui/primitives"
import { Home, Folder, Layers, Settings, Sun } from "lucide-react"

function App() {
  return (
    <SidebarProvider defaultMode="projects" defaultPanelOpen={true}>
      <Sidebar>
        <SidebarRail>
          <SidebarRailHeader>
            <a href="/">
              <Logo variant="sandbox" size="sm" iconOnly />
            </a>
          </SidebarRailHeader>

          <SidebarRailNav>
            <RailButton icon={Home} label="Home" onClick={() => navigate("/")} />
            <RailSeparator />
            <RailModeButton mode="projects" icon={Folder} label="Projects" />
            <RailModeButton mode="batches" icon={Layers} label="Batches" badge={3} />
          </SidebarRailNav>

          <SidebarRailFooter>
            <RailButton icon={Settings} label="Settings" onClick={openSettings} />
            <RailButton icon={Sun} label="Theme" onClick={toggleTheme} />
            <RailSeparator />
            <ProfileAvatar
              user={{ email: "drew@tangle.tools", name: "Drew", tier: "pro" }}
              onLogout={signOut}
            />
          </SidebarRailFooter>
        </SidebarRail>

        <SidebarPanel>
          <PanelRouter />
        </SidebarPanel>
      </Sidebar>

      <SidebarContent className="pt-14 px-8 pb-12">
        <Outlet />
      </SidebarContent>
    </SidebarProvider>
  )
}

function PanelRouter() {
  const { mode } = useSidebar()
  return (
    <>
      <SidebarPanelHeader title={mode === "projects" ? "Projects" : "Batches"} />
      <SidebarPanelContent>
        {mode === "projects" ? <ProjectList /> : <BatchList />}
      </SidebarPanelContent>
    </>
  )
}
```

## Architecture

```
+--------+------------+-------------------------------+
| Rail   | Panel      | SidebarContent                |
| 64px   | 260px      | (auto margin-left)            |
|        | (optional) |                               |
| [Logo] | [Header]   |                               |
| [Nav ] | [Content]  |                               |
| [Nav ] | [       ]  |                               |
| [    ] | [       ]  |                               |
| [Sett] |            |                               |
| [Prof] |            |                               |
+--------+------------+-------------------------------+
```

- **Rail** is always visible (64px). Contains icon buttons.
- **Panel** slides in/out (260px). Content switches by mode.
- **SidebarContent** adjusts its `margin-left` automatically via `useSidebar().contentMargin`.

## Components

### `SidebarProvider`

Wrap your app. Manages all sidebar state, persisted to `localStorage`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultPanelOpen` | `boolean` | `true` | Initial panel state |
| `defaultMode` | `string` | `"projects"` | Initial mode |

### `useSidebar()` hook

Returns:

| Field | Type | Description |
|---|---|---|
| `panelOpen` | `boolean` | Whether the panel is open |
| `setPanelOpen` | `(open: boolean) => void` | Set panel open/closed |
| `togglePanel` | `() => void` | Toggle panel |
| `mode` | `string` | Current panel mode |
| `setMode` | `(mode: string) => void` | Set mode directly |
| `switchMode` | `(mode: string) => void` | Toggle-aware mode switch (same mode = close, different = open + switch) |
| `hidden` | `boolean` | Whether entire sidebar is hidden (focus mode) |
| `setHidden` | `(hidden: boolean) => void` | Hide/show sidebar |
| `contentMargin` | `number` | Computed margin in px for main content |

### `Sidebar`

Root container. Handles width animation and hide/show.

### `SidebarRail` / `SidebarRailHeader` / `SidebarRailNav` / `SidebarRailFooter`

Layout slots for the 64px icon strip. `SidebarRailNav` takes `flex-1` to fill remaining space.

### `RailButton`

Icon button for the rail. Shows a badge count and uses `title` for tooltip.

| Prop | Type | Description |
|---|---|---|
| `icon` | `ComponentType<{ className?: string }>` | Icon component |
| `label` | `string` | Tooltip text |
| `isActive` | `boolean` | Active highlight |
| `badge` | `number` | Badge count (hidden if 0/undefined) |
| `onClick` | `() => void` | Click handler |

### `RailModeButton`

Like `RailButton` but wired to `switchMode()` — auto-highlights when its mode is active.

| Prop | Type | Description |
|---|---|---|
| `mode` | `string` | Mode this button toggles |
| `icon` / `label` / `badge` | same as `RailButton` | |

### `RailSeparator`

Horizontal divider line in the rail.

### `SidebarPanel` / `SidebarPanelHeader` / `SidebarPanelContent`

The 260px slide-out panel. `SidebarPanelHeader` accepts a `title` string or custom `children`. `SidebarPanelContent` is scrollable.

### `SidebarContent`

Main content wrapper. Sets `margin-left` based on sidebar state. Use this instead of a plain `<main>` to get automatic layout response.

### `ProfileAvatar`

Avatar button in the rail that opens a dropdown with user info, settings, and logout. Accepts `children` for extra dropdown items.

| Prop | Type | Description |
|---|---|---|
| `user` | `SidebarUser` | `{ email, name?, tier?, avatarUrl? }` |
| `isLoading` | `boolean` | Show skeleton |
| `onLogout` | `() => void` | Sign out handler |
| `onSettingsClick` | `() => void` | Settings handler |
| `children` | `ReactNode` | Extra `DropdownMenuItem` elements |

## Motion

The rail speaks the same motion vocabulary as `@tangle-network/agent-app` — same token names, same values, declared in `src/styles/globals.css` and shipped in `dist/globals.css`.
A product that loads both stylesheets gets one answer, not two.

| Token | Value | What it times |
|---|---|---|
| `--duration-instant` | 90ms | a control acknowledging a pointer |
| `--duration-fast` | 150ms | a control already on screen changing state |
| `--duration-base` | 240ms | a surface arriving or leaving |
| `--duration-slow` | 360ms | a full-height surface travelling |
| `--duration-arrive` | 600ms | a row or card that was not there a moment ago |
| `--stagger-step` | 50ms | delay per item in a staggered group (capped at 8 items) |

What the rail does with them:

- **Nav items arrive staggered.** Each item carries `.agent-arrive` and `style={{ "--stagger-index": i }}`, so the rail unfolds top-down instead of appearing all at once. Both shells (`SidebarLayout`, `DashboardLayout`) render it the same way, and `SessionSidebar` rows use the identical entrance.
- **The disclosure animates its real height.** `RailExpandable`'s inline accordion is a `.agent-disclose` grid whose row travels `0fr → 1fr` — no `max-height` guess, so a list of 3 sessions and a list of 30 both open correctly. Its sub-items mount on first open and stay mounted (a list that unmounts has no height to collapse); while closed the region is `inert`, so clipped links are neither tabbable nor announced.
- **Hover and active states read a token.** Every transition in the rail is `duration-[var(--duration-fast)] ease-[var(--ease-standard)]` (the `MOTION_CONTROL` constant in `src/lib/motion.ts`). The rail's own collapse and the content margin that follows it share `--duration-slow`, because two tiers there means the page visibly lags the edge it is attached to.
- **Reduced motion collapses every duration to 1ms** — 1ms, not 0, because a zero-duration transition fires no `transitionend` and anything sequencing on one hangs. Motion that carries meaning (a sub-item whose agent is still responding, a live status dot, a spinner) declares `data-motion="essential"` and keeps moving; decorative motion must not.

Adding a timing to this area? Use a token. `scripts/motion-tokens.test.mjs` fails the build on a literal `ms`, a `duration-<number>`, or a duration that has no reduced-motion collapse.

## Constants

```ts
SIDEBAR_RAIL_WIDTH   = 64   // px
SIDEBAR_PANEL_WIDTH  = 260  // px
SIDEBAR_TOTAL_WIDTH  = 324  // px
```

Import from `@tangle-network/sandbox-ui/dashboard`.
