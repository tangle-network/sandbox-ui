# Startup Scripts load state patch

Base: merged dashboard release `5dac7a3c9cbec7b5e8035f93c8c2ca753f49f13c`. Candidate: `0.122.1`.

An initial scripts failure previously rendered an error together with “No startup scripts yet” and a zero count. A failed optional environment/secret request also discarded a successful scripts response through `Promise.all`.

The page now accepts each response independently, renders a verified empty state only after a successful scripts read, retains last-good rows on refresh errors, and offers Retry. Read failures use short user-facing messages rather than raw parser errors.

Beelink frozen install, typecheck, all 17 StartupScriptsPage tests, package build, and packed-consumer builds with normal/omitted optional peers passed. Tests exercise initial SyntaxError → Retry → verified empty; successful list → mutation refresh failure → retained rows; successful scripts with failed optional environments.

Candidate: `/tmp/sandbox-scripts-01221/tangle-network-sandbox-ui-0.122.1.tgz`; SHA256 `af51d90becebf5e4db44b5e4f178f896ac5662360332c3f76e7b6c53ba3cf6cd`.

The maintained Storybook `Pages/StartupScriptsPage/LoadFailure` reproduces the error condition. Automated component state checks passed. A new manual screenshot was unavailable because the browser control connection timed out during new-tab setup and recovery; previous layout screenshots remain valid. The integrating ADC owner performs the consumer check.
