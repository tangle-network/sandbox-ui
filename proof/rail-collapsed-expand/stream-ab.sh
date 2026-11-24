#!/usr/bin/env bash
# Signoff's last step, the frame-timing test "17 agents stream", run alternately with this
# branch's sidebar and with origin/main's, on one host under the same load, twice each.
# It shows whether the sidebar change moves the stream's frame timing.
set -uo pipefail
run() {
  pnpm build-storybook --quiet > /dev/null 2>&1
  pnpm exec playwright test tests/visual/run-ui.spec.mjs --grep '17 agents stream' --workers=1 --retries=0 \
    --output=test-results-stream --reporter=line 2>&1 | grep -E 'run-frame-metrics|[0-9]+ (passed|failed)'
  echo "== $1 exit ${PIPESTATUS[0]} load $(cut -d' ' -f1 /proc/loadavg)"
}
main_sidebar() { git show origin/main:src/dashboard/app-sidebar.tsx > src/dashboard/app-sidebar.tsx; }
run fix-1
main_sidebar; run main-1
git checkout -- src/dashboard/app-sidebar.tsx; run fix-2
main_sidebar; run main-2
git checkout -- src/dashboard/app-sidebar.tsx
