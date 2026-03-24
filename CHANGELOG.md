# Changelog

## 0.4.0

### Breaking Changes

- **Sidebar rewrite**: `AppSidebar` and its types (`SidebarNavItem`, `SidebarSandbox`) are removed. Replaced with composable Rail + Panel primitives (see [docs/sidebar.md](./docs/sidebar.md)).
- **DashboardLayout**: Props `sandboxName`, `sandboxLabel` removed. New props: `modeItems`, `panels`, `defaultPanelOpen`, `defaultMode`, `railFooter`, `profileMenuItems`.
- **User avatar** moved from top nav bar to the sidebar rail footer.

### New Components

| Component | Subpath | Purpose |
|---|---|---|
| `Sidebar` | `/dashboard` | Root sidebar container (width animation, hide support) |
| `SidebarRail` | `/dashboard` | 64px always-visible icon strip |
| `SidebarRailHeader` | `/dashboard` | Top of rail (logo slot) |
| `SidebarRailNav` | `/dashboard` | Middle of rail (flex-1 nav area) |
| `SidebarRailFooter` | `/dashboard` | Bottom of rail (settings, theme, profile) |
| `SidebarPanel` | `/dashboard` | 260px slide-out content panel |
| `SidebarPanelHeader` | `/dashboard` | Panel title bar |
| `SidebarPanelContent` | `/dashboard` | Scrollable panel body |
| `SidebarContent` | `/dashboard` | Main content area with auto margin-left |
| `RailButton` | `/dashboard` | Icon button with badge and tooltip |
| `RailModeButton` | `/dashboard` | RailButton wired to `switchMode()` |
| `RailSeparator` | `/dashboard` | Horizontal divider in the rail |
| `ProfileAvatar` | `/dashboard` | Avatar button + dropdown menu |
| `SidebarProvider` | `/dashboard` | Context provider for sidebar state |
| `useSidebar` | `/dashboard` | Hook: `panelOpen`, `mode`, `switchMode`, `hidden`, `contentMargin` |

### New Constants

- `SIDEBAR_RAIL_WIDTH` (64px)
- `SIDEBAR_PANEL_WIDTH` (260px)
- `SIDEBAR_TOTAL_WIDTH` (324px)

### Migration

Replace `<AppSidebar navItems={...} />` with composable primitives:

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarRail>
      <SidebarRailHeader>{/* logo */}</SidebarRailHeader>
      <SidebarRailNav>{/* RailButton / RailModeButton */}</SidebarRailNav>
      <SidebarRailFooter>{/* settings, profile */}</SidebarRailFooter>
    </SidebarRail>
    <SidebarPanel>{/* panel content */}</SidebarPanel>
  </Sidebar>
  <SidebarContent>{/* page content */}</SidebarContent>
</SidebarProvider>
```

Or use `DashboardLayout` as a convenience wrapper with the new `modeItems` and `panels` props.
