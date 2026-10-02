# Canonical presentation compatibility (pursuit7)

## Decision and alternatives

Generic presentation belongs to Brand/UI. Re-export its maintained bindings
instead of copying the upstream files into Sandbox or moving the old renderers
into another local directory. Canonical UI 11.13.0 already accepts Sandbox's
Heading visual roles and PageHeader action/eyebrow/titleAs inputs. An extra
runtime wrapper around those components would lose exact binding identity
without providing useful compatibility. PageShell remains an optional bounded
width/gutter/rhythm composition, not a universal application shell.

SectionTitle is the one prop-only adapter: its existing title, description,
action and className become PageHeader level=2, with mb-0 as its overridable
section spacing. There is no local heading/tag/typography renderer. The named
HeadingProps interface intentionally keeps required children and its required
six-value visual role union; broadening that named type would break code that
uses role as a visual-variant key. Runtime Heading is still the canonical object.

Card and Table were already upstream re-exports. Keep them that way, including
all parts, native ref targets, default CardTitle h3, explicit heading levels,
and opt-in table-wrapper accessibility. Decorative card hover does not create
an interactive role or tab stop. Do not turn agent-specific record tables or
billing/workspace compositions into generic primitives.

## Caller and public-surface inventory

Inventory at base `0c74ba79f06f7368f52f384ae51ef5523b3f0f5b`:

| Surface | Callers / compatibility decision |
| --- | --- |
| PageHeader | `src/pages/secrets-page.tsx` and `startup-scripts-page.tsx` use `/primitives`; existing outer page sizing and agent actions remain unchanged. |
| Heading | Local heading renderer and Heading/PageShell stories/tests; no separate production caller needing a semantic override migration. |
| SectionTitle | Public barrel, Heading story and tests; no production caller. Retain the API as a canonical header composition. |
| PageShell | Public barrel, its story and tests; do not force its padding onto existing page/workspace containers. |
| Card parts | `src/dashboard/billing-dashboard.tsx` and `usage-chart.tsx` retain their canonical imports, props and composition. Their CardTitle defaults remain h3. |
| Generic Table parts | Public bridge/stories; no production generic Table caller. `SandboxTable` and native agent-specific tables retain their record/selection/pagination behavior. |
| Public paths | `/primitives` stays compatible; local `./heading` and `./page-shell` remain tiny import bridges. Root adds the presentation names and CardTitleProps/TableProps without removing aliases or existing exports. |

Recheck with `git grep -n -E '<(Heading|PageHeader|PageShell|SectionTitle|Card|Table)([[:space:]>]|$)' -- src`;
separate production files from stories/tests. The identity test imports built
package entries, and the packed type fixture imports installed declarations,
not repository aliases. Full export parity and its intentional omissions remain
gated; only the obsolete PageHeader shadow is removed, with the narrow legacy
HeadingProps type now documented as intentional.

## CSS ownership and peer floors

UI 11.11.4 does not export Heading/PageShell. UI 11.13.0 is the first maintained
release with this compatibility contract and requires Brand 1.10.0. Both peer
and development ranges move together; the pnpm-generated lock resolves their
minimum versions. The focused consumer refuses a build/install above either
floor so a latest-only result cannot masquerade as floor coverage.

Import Brand's supported tokens, named themes, theme and globals CSS. Delete
Sandbox's copied semantic color map, base/focus rules and prose/table anatomy.
Retain only three old surface aliases missing from Brand's theme, Sandbox
scrollbar/quiet-state differences, scoped prose colors and the paragraph-gap
correction Brand 1.10.0 does not yet include. Motion, reduced-motion protections,
agent states and published timing contracts are untouched. Fixes to Brand's
prose reset or those aliases should be upstreamed before removing these deltas.

The precompiled `styles`/`globals.css` path is unchanged. `tokens.css` remains a
byte-for-byte copy of Brand's export. The new `tailwind.css` source entry keeps
the same composition but scans packed Sandbox JS and the host's installed UI
sources; it requires host Tailwind processing. It contains no repository-source
path, font URL or duplicate renderer. The legacy CommonJS `./tailwind` config is
not replaced by a new app framework.

The existing URL-import/token/text-ramp checks remain. The additional guard
renders every canonical heading variant plus both header levels, all Card
variants/parts and Table parts; it requires their actual classes to have compiled
CSS declarations. Empty rules and comments cannot satisfy it. Scripts are not
Tailwind scan inputs. The packed consumer independently compiles the source CSS,
then removes the peer scan as a negative control and requires the check to fail.

## Validation

From the committed branch, with Node/pnpm matching repository configuration:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:presentation
```

`test:presentation` runs six CSS-gate tests, existing heading and bridge/parity
checks, focused semantic/ref/keyboard checks, and a fresh packed consumer. That
consumer installs exactly UI 11.13.0 / Brand 1.10.0, checks public types, then
builds and renders precompiled-CSS and independent host-Tailwind modes at 390px
light and 1280px dark. It checks heading levels, refs, binding identity, gutters,
page overflow, paragraph spacing, native keyboard actions, visible focus and
keyboard table scrolling. Receipts/screenshots go to `test-results/presentation`.
Fonts are consumer-loaded; the fixture checks the canonical font-family rule,
not a downloaded webfont. Existing package smoke retains all precompiled export
checks; the new source-CSS export is covered by the dedicated host compilation.

Existing CI/optional-peer/embedded-app/visual protections are not waived by this
focused check. Reuse valid focused results when only documentation changes;
record unrelated failures separately instead of modifying unrelated surfaces.

## Release coordination

No package version, release workflow, publication tag or registry is changed.
The native sandbox-ui-lines publisher `run58c939` keeps its frozen 0.117.0 cut.
Do not cherry-pick this dependency migration into that cut. This PR is for a
subsequent coordinated release; merging a package.json change triggers the
existing release workflow, so its owner must schedule the next version/cut.
No application rollout, Lines/enrollment/integrations behavior, new
WorkspaceLayout props, or publication is claimed by this library migration.
