# Changelog

## 0.9.0

> Versions 0.5.0–0.8.4 were published without changelog entries.

### Breaking Changes

- **Themes removed**: `ocean`, `ember`, `forest`, `dawn`, `operator`, `builder`, and `consumer` themes have been removed. Only the default dark theme and `vault` (light) remain. The `theme` prop on `WorkspaceLayout` now accepts `"vault"` only.
- **`ProvisioningConfig.startupScriptIds`**: New optional field added to the exported interface. Existing code is unaffected since the field is optional.

### New Components

| Component | Subpath | Purpose |
|---|---|---|
| `StartupScriptsPage` | `/pages` | Full CRUD page for managing sandbox startup scripts |
| `PromoBanner` | `/dashboard` | Themed promotional banner with CTA button |
| `InfoPanel` | `/dashboard` | Themed info card for stats rows |



### Improvements

- **Pricing page**: Added eyebrow prop, FAQ section, billing period toggle.
- **Provisioning wizard**: Startup scripts integration, deploy error feedback, load error surfacing, `maxLength` on name/prompt inputs, runtime driver validation.
- **Secrets page**: Redesigned with stats row, `InfoPanel` integration, race-safe data loading via generation counter, `showSpinner` parameter to avoid flash on mutation refresh.
- **Design tokens**: Added `--btn-primary-text`, `--brand-strong-text`, `--brand-strong-text-muted`, `--brand-strong-text-dim` tokens for WCAG-compliant text on themed backgrounds.
- **Card variants**: Restored visual distinctions for `elevated`, `glass`, and `sandbox` card variants.
- **Accessibility**: `aria-label` on script action buttons, `aria-hidden` on decorative SVGs, touch-visible action buttons on mobile.
- **Consistent styling**: All primary buttons use `--btn-primary-bg`/`--btn-primary-hover`/`--btn-primary-text` tokens. `font-display` Tailwind utility used consistently instead of `font-[var(--font-display)]`.
- **Test coverage**: Added test suites for `StartupScriptsPage`, `SecretsPage`, `PromoBanner`, `InfoPanel`, `ProvisioningWizard`, and `WorkspaceLayout` (59 tests total).

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
