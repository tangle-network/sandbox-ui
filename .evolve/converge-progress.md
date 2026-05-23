# Converge Progress

## Target
- **Branch**: chore/release-sandbox-ui-0.17.1
- **PR**: https://github.com/tangle-network/sandbox-ui/pull/51
- **Status**: CONVERGED

## Current State
- **Last commit**: 4aa9cb75b59a52f365efab0b7952825badd197ce
- **Last updated**: 2026-05-23T23:47:45Z
- **Round**: 2

## Workflow Status
| Workflow | Job | Status | Since Round |
|---|---|---|---|
| CI | validate | green on 4aa9cb7 | 2 |

## Round History
| Round | Commit | Fixed | Remaining | Timestamp |
|---|---|---|---|---|
| 1 | dec53a6 | Updated provisioning wizard test to expect model-family headers. | None; CI passed. | 2026-05-23T23:45:32Z |
| 2 | 4aa9cb7 | Made ModelPicker non-modal and added regression coverage for no page lock and direct trigger switching. | None; CI passed. | 2026-05-23T23:47:45Z |

## Completed Fixes
- [x] **Round 1**: Update provisioning wizard test to expect model-family labels after ModelPicker grouping changed from provider headers to family headers.
- [x] **Round 2**: Remove modal pointer-event lock from ModelPicker and focus search before paint.

## Remaining Failures

## Blocked / Needs Human

## Pre-existing on Base Branch
