# Converge Progress

## Target
- **Branch**: chore/release-sandbox-ui-0.17.1
- **PR**: https://github.com/tangle-network/sandbox-ui/pull/51
- **Status**: IN_PROGRESS

## Current State
- **Last commit**: dec53a682b3289edbfcea7c8f8cedb5d77aab3ef
- **Last updated**: 2026-05-23T23:46:25Z
- **Round**: 2

## Workflow Status
| Workflow | Job | Status | Since Round |
|---|---|---|---|
| CI | validate | green on dec53a6 | 1 |
| CI | validate | pending after dropdown interaction fix | 2 |

## Round History
| Round | Commit | Fixed | Remaining | Timestamp |
|---|---|---|---|---|
| 1 | dec53a6 | Updated provisioning wizard test to expect model-family headers. | None; CI passed. | 2026-05-23T23:45:32Z |
| 2 | pending | Made ModelPicker non-modal and added regression coverage for no page lock and direct trigger switching. | Commit, push, wait for CI. | 2026-05-23T23:46:25Z |

## Completed Fixes
- [x] **Round 1**: Update provisioning wizard test to expect model-family labels after ModelPicker grouping changed from provider headers to family headers.
- [x] **Round 2**: Remove modal pointer-event lock from ModelPicker and focus search before paint.

## Remaining Failures
- [ ] Remote CI rerun pending after dropdown interaction fix commit.

## Blocked / Needs Human

## Pre-existing on Base Branch
