# Changelog


## 0.10.7

### Fixes

- **Provisioning wizard sliders — labelled max is now reachable (#738)**: HTML range inputs snap the thumb to `min + k*step`, so the labelled `max` is only selectable when `(max − min)` is a whole multiple of `step`. When team/plan limits trimmed the max off the step grid (e.g. `STORAGE_MIN=20`, plan `storageMaxGB=50`, `STORAGE_STEP=8` → thumb capped at 44 instead of 50), users could not select the exact limit the UI advertised. Added `alignSliderStep(min, max, desiredStep)` that shrinks the step to the largest divisor of `(max − min)` not exceeding `desiredStep`, preserving the caller's granularity — integer steps stay integer (RAM, storage), and CPU's 0.5 step stays on one-decimal values via a ×10 scaling pass to avoid float-modulo quirks. CPU, RAM, and storage sliders now route their min/max through the helper, so the thumb can reach both endpoints. The min side was never blocked (HTML anchors the grid to `min`); this fix closes the max side.
- **Seeded values now land on the new step grid**: When a saved `defaultConfig`, a preset, or the template-reset button seeds the sliders with a number that was on-grid under a different plan's step (e.g. `storageGB=28` on the old step-8 grid, loaded under a tighter plan whose aligned step is 6), React state held the off-grid value while the browser painted the thumb at the nearest stop — the on-screen reading and the state disagreed until the user dragged. Added `snapSliderValue(value, min, max, step)` and ran every seed site through it (initial `useState`, the limit-change effect, `applyPreset`, reset button), so state and paint stay in lock-step.
- **Regression coverage**: Added unit tests for `alignSliderStep` (identity when already aligned, divisor search, equal-bounds, zero/negative guards) and for `snapSliderValue` (on-grid pass-through, nearest-stop rounding, clamp-before-snap, 0.5-step float stability, non-finite/zero-step fallbacks), plus an integration test that mounts the wizard with the original #738 plan limits and asserts the rendered `step` attribute divides `(max − min)`.

## 0.10.6

### Fixes

- **`dist/globals.css` CSS spec compliance**: moved the Google Fonts `@import url("https://fonts.googleapis.com/...")` to the top of `src/styles/globals.css`, ahead of `@import "./tokens.css"` and `@import "tailwindcss"`. PostCSS inlines both of those during build, which previously pushed the Google Fonts `@import` to ~line 406 of the built CSS — after real rules — and the CSS spec mandates `@import` must precede all statements except `@charset`/empty `@layer`. Downstream bundlers (Vite, webpack) were emitting a warning and dropping the `@import`, so Geist/Geist Mono/Outfit/Manrope/Inter were not actually being fetched in consumers that relied on this library to load them.
- **Build-time regression guard**: `scripts/copy-styles.mjs` now fails the build if the built `globals.css` doesn't have the Google Fonts `@import` at the top, preventing the ordering from silently regressing in future edits.

> Versions 0.10.0–0.10.5 were published without changelog entries.

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
