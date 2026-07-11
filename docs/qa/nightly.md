# Nightly QA (release-candidate run)

`MS-foundation-nightly-rc` adds a scheduled workflow, `.github/workflows/nightly-qa.yml`,
so drift on `main` is caught within a day even when nobody opens a PR. Before this,
the release-candidate pack only ran when a human remembered to run it locally and no
RC ledger was persisted anywhere.

## When it runs

- Daily at **03:17 UTC** (odd minute per GitHub's guidance to avoid the top-of-hour
  thundering herd).
- On demand via **workflow_dispatch** (Actions tab, "Nightly QA", Run workflow).

A red night shows up as a failed scheduled run on `main`. There is no
failure-masking on the job or any step: if any RC phase fails, the run is red.

## What it runs

A single ubuntu-latest job (90-minute timeout) installs dependencies, installs the
chromium Playwright browser (`pnpm exec playwright install chromium --with-deps`),
and executes:

```sh
pnpm run qa:rc
```

That is the full release-candidate pack — 13 commands across the build, static,
P0/P1 API/security, P0/P1 browser, worker, a11y/visual, privacy, performance, and
artifact-safety phases. See [release-candidate.md](./release-candidate.md) for the
command list and phase details.

### Safety: local/mock mode only

The workflow exports only sanitized offline values (mirroring `test-suite.yml`:
`APP_ENV=test`, `QA_TARGET_ENV=ci-ephemeral`, example Supabase URL, dummy keys).
No real secrets reach the job. `scripts/qa/rc-pack.ts` then layers its own safe
defaults on top of anything unset — `QA_USE_MOCKS=1`, `QA_DRY_RUN=1`,
`QA_EXTERNAL_MUTATION_MODE=dry-run`, `QA_ALLOW_DESTRUCTIVE=local` — and the QA
environment guard refuses production-like targets outright. Nothing remote is
targeted.

## Reading a run

Artifacts upload on success **and** failure (`if: always()`, 14-day retention) as
the `nightly-rc-artifacts` artifact, because the persisted RC ledger is the point
of the nightly. Download it from the run's Summary page and start at:

```text
test-results/qa/<QA_RUN_ID>/rc-summary.json
```

The redacted summary contains:

- `commands[]` — one entry per RC command with `phase`, `status`
  (`passed`/`failed`/`skipped`), `statusCode`, redacted stdout/stderr previews,
  and a `failureClass` triage hint: `product-failure`, `missing-setup`, or
  `baseline-debt`.
- `qaRunId`, `generatedAt`, `safeEnvironment` (the guard's resolved target class
  and URLs — confirm it never says anything production-like).
- `knownGaps` and `quarantinedTests` (quarantined tests are not counted as
  coverage).

Browser traces/screenshots live next to the summary under
`test-results/qa/<QA_RUN_ID>/browser/`, and `cleanup-registry.json` in the same
run directory must contain no pending records (the RC runner fails the run
otherwise).

## Known caveat: authenticated app-host browser phases

The authenticated ops app-host proof (`qa:ops-authenticated:browser`, inside the
`p0p1-browser` phase) depends on the local-only QA auth fixture
(`QA_ENABLE_AUTH_FIXTURES=1`). That fixture has a known pre-existing limitation:
the edge proxy does not inline the dynamic `QA_ENABLE_AUTH_FIXTURES` read into the
middleware bundle, so fixture auth can be rejected in CI-like environments (and the
fixture additionally requires `QA_TARGET_ENV=local`, which the nightly does not
set). A red `p0p1_browser` entry whose browser artifacts show auth-fixture
rejection on app-host routes is therefore the known-red set to burn down, not
necessarily new product drift — check `rc-summary.json` and the browser artifacts
before treating it as a regression. The nightly still reports these failures
truthfully rather than masking them; if a phase proves structurally impossible in
CI, the fix is to scope the pack invocation deliberately, never to suppress
failures on the whole run.

## Self-test

`tests/qa/nightly-qa-command.test.ts` (`@contract @local-only`, runs in the
default Vitest suite and `qa:foundation`) fails if the schedule trigger, the
`qa:rc` invocation, the chromium install, the always-on artifact upload, the
90-minute timeout, or the sanitized env block is removed or weakened.
