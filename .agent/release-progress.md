# Release Progress

## Target
- Artifact: `@tangle-network/sandbox-ui`
- Registry: npm and GitHub Packages
- Current live version: `0.99.0`
- Expected version: `0.99.1`
- Rollback: keep consumers on `0.99.0`

## Local State
- Worktree: `/home/drew/code/sandbox-ui-interface-0461-20260809`
- Branch: `fix/interface-0461-20260809`
- Base: `a0c18ba1eba3094fd49c00f7f9016d259b0ef5fc`
- Required runtime: Node 22.23.1
- Required checks: typecheck, build, packed consumers at both Interface endpoints, tests, Storybook build

## Decision
- Keep Agent Interface as the only owner of harness and reasoning types.
- Test the oldest supported `0.36.0` and current `0.46.1` before declaring the widened peer range.
- Publish through `.github/workflows/release.yml`; do not hand-publish or create a second release path.

## Timeline
- 2026-08-09T22:23:16Z — npm `0.99.0` and source main both declare Interface `>=0.36.0 <0.44.0` with development version `0.43.0`.
- 2026-08-09T22:23:16Z — 0 open SandboxUI pull requests; prior Interface 0.34/0.35/0.42/0.43 branches are merged ancestors of main.
- 2026-08-09T22:23:16Z — fresh worktree created from current `origin/main`; no active shared worktree modified.
- 2026-08-09T22:26:37Z — local Node 22 proof passed: typecheck, build, 971/971 tests, Storybook, and packed consumers across 23 JavaScript plus 3 CSS exports with Interface 0.36.0 and 0.46.1.
- 2026-08-09T22:26:37Z — public-contract audit approved 6 changed files with 0 findings; Interface 0.46.1 required 0 source shims or casts.
- 2026-08-09T22:30:43Z — PR #237 merged at `62d0b1a190bc250f330860fef51722d350d58276` after CI run 31339442382 passed and review approved.
- 2026-08-09T22:33:37Z — release run 31339578126 passed every step and published npm, GitHub Packages, tag `v0.99.1`, and the GitHub release from the exact merge commit.
- 2026-08-09T22:35:01Z — npm latest returned 0.99.1 with Interface peer `>=0.36.0 <0.47.0`; clean consumers built all 23 JavaScript and 3 CSS exports from the registry tarball with Interface 0.46.1 and 0.36.0.
