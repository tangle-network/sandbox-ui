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
  RailHeader,
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
          <RailHeader
            brand={
              <a href="/">
                <Logo variant="sandbox" size="sm" iconOnly />
              </a>
            }
          />

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

### `SidebarRail` / `RailHeader` / `SidebarRailNav` / `SidebarRailFooter`

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

Brand owns the [motion character and interaction rules](https://github.com/tangle-network/brand/blob/main/docs/design-bible.md) and the roles served by its token stylesheet. Read that owner for durations, easing, interaction budgets and reduced-motion behavior; this guide does not copy their values.

SidebarLayout uses UI's Sheet for phone navigation. UI owns interruptible presence and retirement; Radix owns containment, Escape/outside dismissal and return focus. The controlled drawer stays mounted so closing and immediate reopening reach that shared owner. Stateful header content stays in one live slot across rail, bar and drawer.

Navigation actions appear together without entrance staggering in both SidebarLayout and DashboardLayout. Desktop rail width, content margin and inline disclosure layout update immediately. Control feedback consumes the complete `--motion-control` role; technical floating opacity/transform consumes `--motion-surface`. No local layout-animation trace or timing constant is required because the Sidebar does not animate layout.

Reduced motion removes the responding-label sweep. Its existing status semantics remain, and a static Responding label appears for reduced-motion users. State, focus, cancellation and cleanup do not wait for CSS animation-end/transition-end delivery. Other technical components retain their existing owner and proof scope; this Sidebar guide makes no package-wide measured-motion claim.

Existing Chromium coverage lives in `tests/visual/sidebar-navigation.spec.mjs`. Static screenshots and uncut normal, reversed and reduced-motion recordings are distinct evidence. Storybook proves the library fixture; hosted Sandbox/Dapp proof is still a consumer responsibility. Latency is UNCHECKED until calibrated against the live Brand budgets.

## Constants

```ts
SIDEBAR_RAIL_WIDTH   = 64   // px
SIDEBAR_PANEL_WIDTH  = 260  // px
SIDEBAR_TOTAL_WIDTH  = 324  // px
```

Import from `@tangle-network/sandbox-ui/dashboard`.
