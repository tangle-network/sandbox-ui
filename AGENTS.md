# Sandbox UI

This package bridges generic components from `@tangle-network/ui` and owns Sandbox-specific UI.
Keep generic components in `ui`; keep Sandbox workspace, dashboard, integration, workflow, page, and terminal behavior here.
For session controls and component ownership, read [UI direction](UI-DIRECTION.md).
For consumption and theming, read [README](README.md).

## Export contracts

Bridged subpaths must forward the exact upstream bindings.
Run `pnpm test:bridge` when changing a bridge; it builds before checking identity through package imports.
Source-only tests cannot prove the packaged re-export contract.
Preserve intentional named exports and aliases in `src/index.ts` to avoid collisions between editor, hook, and terminal types.

A subpath change must align the `package.json` export map, `tsdown.config.ts` entry, and source barrel.
Test the packed artifact in a fresh consumer with `pnpm test:package`.
Keep optional-peer omissions covered so an unrelated import does not force optional feature dependencies.

## Styles and state

Brand owns design tokens.
The style build copies its exported token stylesheet; change tokens in the brand package.
Keep authored Sandbox styles in `src/styles/globals.css` and retain source scanning for bridged components.
The compiled styles must contain no unresolved URL imports.
Consumers load fonts; do not add remote font imports to the package stylesheet.
Use semantic tokens, theme/density properties, and wrapper configuration for customization.

Use the maintained `useSdkSession` adapter from `ui` for SDK events and the message/part state consumed by chat and workbench components.
Keep generic event adaptation in that owner instead of duplicating it here.

## Checks and releases

Read [package scripts](package.json) and [CI](.github/workflows/ci.yml) for current checks.
For code or export changes, run affected tests plus typecheck, build, packed-consumer checks, and the relevant UI or Storybook proof.

Read [the release workflow](.github/workflows/release.yml) before releasing.
A version change triggers the release; update the changelog with the consumer-visible behavior.
Pack once, test that tarball, and verify the same artifact at each registry before claiming publication.
Use the workflow's supported resume path for a partial release.

## Deliver the consumer change

Choose checks for the changed surface; instruction-only changes need diff and link checks.
Reuse passing checks while their inputs remain unchanged.
Honor explicit hosted-CI waivers while preserving hooks and enforced branch protections.
Fix change-caused failures; record unrelated or infrastructure failures as owned follow-ups.
Own authorized push, PR, conflict resolution, review, merge, and release.
When the task includes application adoption, finish the dependency update and verify the served consumer.
