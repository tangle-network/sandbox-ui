# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this package is

`@tangle-network/sandbox-ui` is a React component library for [Tangle Sandbox](https://sandbox.tangle.tools). It is published to npm (and GitHub Packages), ESM-only, fully typed, with one tree-shakeable entry point per subpath (`/primitives`, `/chat`, `/workspace`, `/dashboard`, etc.).

The single most important architectural fact: **this package is a thin bridge over `@tangle-network/ui`.** Generic, sandbox-agnostic surfaces (primitives, chat, run, openui, files, editor, markdown, auth, utils, hooks, sdk-hooks, stores, tool-previews) now *live in* `@tangle-network/ui` and are **re-exported** from here through shim subpaths. Only sandbox-coupled surfaces are authored in this repo:

- `src/workspace` — `SandboxWorkbench`, `WorkspaceLayout`, directory/runtime/terminal panes, status bar, task board, approval queue
- `src/dashboard` — `DashboardLayout`, sidebar rail, billing, usage charts, harness picker, git/info panels. **The legacy model pickers are deleted** (removed in 0.98.0) — the canonical model/effort/harness pickers are `ModelPicker` / `EffortPicker` / `AgentSessionControls` from `@tangle-network/agent-app/web-react`. See UI-DIRECTION.md › UI Chrome Ownership.
- `src/integrations` — provider connection tiles + hooks
- `src/workflows` — `WorkflowGraph` (xyflow-based, lazy-loaded)
- `src/pages` — pre-built billing/pricing/profiles/secrets/provisioning pages
- `src/terminal` — xterm.js view
- sandbox-specific `src/hooks`, `src/stores`, `src/types`, plus the sandbox-branded `Logo`

When deciding where code belongs: if it's generic UI, it goes in `@tangle-network/ui`; if it knows about sandboxes/sessions/the Tangle product, it stays here.

### The re-export identity contract

`src/__tests__/re-export-identity.test.ts` asserts (via `toBe`, i.e. referential identity) that every bridged subpath forwards the *exact same* binding as `@tangle-network/ui`. If you change what a bridge subpath re-exports, or add a new bridged symbol, this test must still pass. Because it imports by package name (`@tangle-network/sandbox-ui/...`), it resolves against `dist/` — so it requires a build first. Run it with `pnpm test:bridge` (which builds, then runs only that test), **not** plain `pnpm test`.

Some root re-exports are deliberately curated as *named* (not `export *`) to avoid type-name clashes — e.g. `ConnectionState` is intentionally omitted from `./hooks` so the editor's collaboration type stays canonical, and `TerminalLine`/`TerminalInput`/`TerminalCursor` are aliased to `TerminalDisplay*`. Preserve these curations when editing `src/index.ts`.

## Commands

Package manager is **pnpm** (the version is pinned in `package.json`; CI uses `pnpm install --frozen-lockfile`).

```bash
pnpm build           # tsup — bundle all entry points + .d.ts, then copy/compile styles
pnpm dev             # tsup --watch
pnpm typecheck       # tsc --noEmit (strict)
pnpm test            # vitest run (jsdom)
pnpm test:package    # install the packed artifact in a blank Vite consumer
pnpm test:watch      # vitest
pnpm test:bridge     # build, then run ONLY the re-export identity test (needs dist)
pnpm storybook       # storybook dev -p 6006
```

Run a single test file or pattern:

```bash
pnpm vitest run src/workflows/model.test.ts
pnpm vitest run -t "forwards to @tangle-network/ui"
```

CI (`.github/workflows/ci.yml`) runs, in order: `typecheck`, `build`, `test:package`, `test`, `build-storybook`. Match that locally before pushing.

## Adding or changing a subpath export

A subpath (e.g. `./integrations`) is wired in **three** places that must stay in sync:

1. `package.json` → `exports` map (the `import`/`types` pair pointing at `dist/<name>.js`)
2. `tsup.config.ts` → `entry` (`<name>: "src/<name>/index.ts"`)
3. `src/<name>/index.ts` — the actual barrel

Forgetting any one yields a build that "works" locally but fails to resolve for consumers.

## Styling / theming model

- **Tokens are owned by `@tangle-network/brand`, not this repo.** `scripts/copy-styles.mjs` (run via tsup `onSuccess`) resolves `@tangle-network/brand/styles/tokens.css` via Node package-exports and copies it byte-for-byte to `dist/tokens.css`. To change a token, change it in `brand` — sandbox-ui only re-ships it.
- `src/styles/globals.css` is the only authored stylesheet. It `@import`s brand tokens + Tailwind v4, declares `@source` globs (including `node_modules/@tangle-network/ui/src`) so utilities used by bridged components are scanned, and defines sandbox utility classes (`.glass-*`, `.status-dot-*`, animations). The build compiles it through PostCSS (`postcss-import` then Tailwind) into `dist/globals.css` + `dist/styles.css`, and `validate-built-css.mjs` fails the build if a URL `@import` leaks in.
- **Do not add `@import url(...)` for fonts.** Fonts are intentionally *not* bundled — a URL import breaks downstream apps that chain-import the CSS (see CHANGELOG 0.10.9 and the comment at the top of `globals.css`). Consumers load fonts themselves.
- Theming is token-driven: `data-sandbox-theme="vault"` (light) vs default dark, plus `data-density="comfortable" | "compact"`. `WorkspaceLayout`/`SandboxWorkbench` accept `theme`/`density` props; otherwise set the `data-*` attributes on a wrapper. Prefer overriding semantic tokens or wrapping higher-level surfaces over fighting internal classes (see README "Theming And Retheming").

## Key runtime models

- **Session model**: `useSdkSession` (in `@tangle-network/ui`, bridged via `/sdk-hooks` and `/hooks`) turns raw SDK / session-gateway events into the `{ messages, partMap }` shape that `ChatContainer` and `SandboxWorkbench` consume. This is the canonical adapter — see README usage example.

## Testing conventions

- Vitest + jsdom + `@testing-library/react`; globals enabled; setup in `src/test-setup.ts`. Tests are co-located as `*.test.ts(x)` next to source. `src/__tests__/` and `scripts/*.test.mjs` are also collected.
- Most tests run against source. The one exception is the bridge identity test, which runs against `dist/` — use `pnpm test:bridge`.

## Release flow

Releases are automated by `.github/workflows/release.yml`: a push to `main` that changes `package.json` (the version field) runs the full validation suite, packs once, tests that exact tarball, publishes and verifies the same bytes on npm and GitHub Packages, then creates a GitHub Release. **Bumping the version is the normal release trigger; manual dispatch safely resumes a partial release.** `CHANGELOG.md` is hand-maintained — add an entry when bumping the version.

Commit messages follow Conventional Commits with a scope matching the area: `feat(integrations): ...`, `fix(dashboard): ...`, `chore(release): ...`. PRs are referenced as `(#NNN)`.

## Authorship

Do not add `Co-Authored-By:` trailers (or any other AI-attribution lines) to commits, PR descriptions, or other artifacts in this repo. Author = the human running the session. This applies even when the default Claude Code template suggests it.
