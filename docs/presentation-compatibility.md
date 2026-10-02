# Canonical presentation compatibility

## Ownership and consumer contract

`@tangle-network/ui/primitives` owns Heading, PageHeader, PageShell, Card parts
and table parts. Sandbox UI forwards those same runtime objects through its
public `/primitives` entry and root entry. Existing relative Heading/PageShell
modules remain forwarding entry points for repository callers, not alternative
renderers. Their old class maps and JSX implementations are deleted.

`SectionTitle` remains a compatibility name that supplies `level={2}` to the
canonical PageHeader. Its title, description, action and className props remain.
The named `HeadingProps` type retains the original required visual `role` and
`children`; importing that type must not make a downstream function's previously
required `role` become optional. This is the only generic type-only shadow.
The Heading binding itself is still UI's object, including its ref forwarding.

Semantic heading defaults, `as`/`titleAs`, HTML/ARIA/data attributes and refs stay
with their maintained owner. CardTitle still defaults to h3 and exposes its
canonical `as` property. A table ref still addresses the table, not its scroll
wrapper. Wrapper keyboard/region configuration is opt-in. PageShell retains its
existing children/className contract; it acquires no app-shell or workspace props.

This adopts canonical PageHeader structure and spacing while retaining the
already forwarded Card anatomy. Legacy CSS selectors tied to the old PageHeader's outer `div` structure
are not a supported DOM-shape contract. Generic consolidation is not an
application adoption, integration migration or new navigation shell.

## Caller inventory

The following repository callers define the compatibility boundary.

| Surface | Existing caller boundary | Treatment |
| --- | --- | --- |
| PageHeader | `src/pages/secrets-page.tsx`, `src/pages/startup-scripts-page.tsx` via `../primitives` | Keep caller props and agent-specific page bodies; forward canonical binding. |
| Heading | `src/stories/primitives/Heading.stories.tsx`, `src/stories/primitives/PageShell.stories.tsx`; original PageHeader/SectionTitle renderers | Preserve relative imports; delete the competing renderers. |
| SectionTitle | Heading stories, `src/primitives/heading.test.tsx`, primitive barrel | Keep the compatibility name and h2 semantics. |
| PageShell | PageShell stories, `src/primitives/heading.test.tsx`, primitive barrel | Direct forwarding; no composition rewrite. |
| Card/table families | Existing named UI re-exports in `src/primitives/index.ts` and root | Already canonical: retain them, expose canonical public prop types and pin identity. |
| Consumers outside this repository | Public package entries/types and the isolated packed consumer | No claim of deployed application rollout. |

The local Sandbox wordmark remains intentional. Domain cards, workspace layouts,
pages and agent compositions are not generic primitive forks merely because they
contain a heading or a card. They are not rewritten by this change.

## CSS choice and alternatives

Import Brand's public `styles/theme.css` alongside the existing public token and
named-theme imports. Delete the duplicate semantic-color and surface-container
registrations. The three compatibility utility names `surface`, `surface-dim`
and `surface-bright` are not registered by Brand 1.10.0, so only those registrations
remain locally, reading Brand-owned values.

A full Brand `styles`/`globals.css` import is deliberately not used in the Sandbox
bundle. That export also brings mesh/noise, status-shadow and prose rules whose
behavior differs from Sandbox's retained flat treatment, corrected prose rhythm
and reduced-motion protections. Importing it and layering a second copy of the
old stylesheet over it would hide duplication rather than remove it. The public
theme export is the supported, coherent subset for this migration. Local motion,
focus, prose and agent-specific CSS is unchanged. Token bytes still come from
Brand through the maintained style build; fonts remain host-owned.

Copying the canonical renderers into new Sandbox files was rejected because it
would preserve the split ownership. A new universal app shell was rejected
because it would change product composition instead of completing the bridge.

Brand 1.10 resolves semantic colors at the element. React Flow adds an internal
`.light` or `.dark` class, so WorkflowGraph reads the host's resolved color
scheme before giving React Flow its mode. This keeps graph tiles and controls in
the host theme when it is selected with `data-theme` or `data-sandbox-theme`.

## Dependency and publication boundary

UI 11.13.0 contains the canonical presentation APIs; Brand 1.10.0 supplies the
supported CSS registrations. Peer ranges move to `^11.13.0` and `^1.10.0`, with
exact development versions at those floors. The style build and packed consumer
both enforce exact floor resolution: a newer source tree may replace class
spellings and is not proof that the older floor's utilities are present.

The lockfile was regenerated with the repository's declared pnpm 12.6.0. The
new bindings and higher peer floors ship together in Sandbox UI 0.118.0. The
release workflow installs Chromium for the packed browser check before publish.
This work does not modify the previous
0.117.0 artifact.
Lines, enrollment, integrations and WorkspaceLayout APIs are outside ownership.

## Required validation

After dependency/lock coordination, use the maintained commands:

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run scripts/validate-built-css.test.mjs src/primitives/heading.test.tsx src/__tests__/ui-export-parity.test.ts
pnpm typecheck
pnpm test:bridge
pnpm test:package
pnpm build-storybook
CI=1 pnpm test:visual
```

`test:bridge` performs the package/CSS build; do not rebuild it again without an
input change. `test:package` packs through the existing maintained path, installs
that artifact into a fresh consumer, and retains the optional-peer omission
checks. The full-peer pass adds strict public compatibility type checking and
runs the same real consumer with two styling lanes: published `globals.css`
without a Tailwind compiler, and host Tailwind compiling installed package
sources with public Brand imports. It checks light/dark at 390px and 1280px,
semantic levels, refs, actual CSSOM utility rules, resolved typography, gutters,
card padding, overflow containment, keyboard action/focus and table scrolling.
It prints installed versions, compiled CSS SHA256 and measured states only after
those checks pass. Missing dependencies, browser, source or utility rules fail;
there is no skip-to-green path.

Static parsing or a dependency-free validator fixture is not a substitute for
these package and browser checks. Record blocked/unexecuted checks separately.
