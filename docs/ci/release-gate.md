# Release gate

The release gate (`pnpm ci:gate`, `scripts/ci/gate/evaluate.ts`, workflow `.github/workflows/release-gate.yml`) is the only component that turns CI evidence into a merge or deploy decision. It reads evidence published by the local controller (or the hosted fallback), verifies it against `config/ci/policy.json` from protected `main`, and publishes the `Release gate` check plus the compatibility checks that branch protection already requires. It never runs tests itself, and it never checks out the candidate revision.

## The tuple

Every unit of CI work is identified by one tuple:

```json
{
  "repositoryId": 123456789,
  "profile": "pr",
  "prNumber": 42,
  "headSha": "<PR head SHA>",
  "baseSha": "<PR base SHA>",
  "testedSha": "<synthetic merge SHA for PRs, merged SHA for main>",
  "policyVersion": "2026-09-04.1",
  "imageDigest": "sha256:<executor image>",
  "controllerVersion": "0.1.0",
  "attempt": 1
}
```

How it flows:

1. The Mac controller (`pnpm ci:controller`, GitHub App `nabatable-local-ci`) builds the tuple from the PR or push, runs the profile in a disposable VM, and publishes the check `Local CI / <profile>` on `headSha`. The check's `external_id` is the deterministic tuple key (`nabatable-ci/v1:<fields>`), and its `output.text` carries the `nabatable.ci-result/v1` evidence document (suite inventory with per-suite evidence digests, coverage verdict, bundle digest, installation id, timestamps).
2. When the controller is unavailable, the dispatch Worker (GitHub App `nabatable-ci-dispatch`) dispatches `Hosted profile fallback` with the same tuple as workflow inputs. The workflow resolves the profile from `main` (`pnpm ci:profile <name> --json`), executes it against a separate checkout of `testedSha`, and publishes `Hosted profile fallback / <profile>` with the same document shape (`source: hosted-fallback`, `runId`).
3. `Release gate` is dispatched (or triggered by the hosted lanes completing on `main`). It checks out `main` only, then `pnpm ci:gate` verifies, in order, and refuses on the first class of failure it cannot bind:
   - `repositoryId` equals the repository the token belongs to and the policy's `repositoryId`.
   - Merge mode: the PR is open, targets `main`, `head.sha == headSha`, `base.sha == baseSha`, `merge_commit_sha == testedSha`. Main-deploy mode: `testedSha == headSha`, its first parent is `baseSha`, and it is an ancestor of `main`.
   - Exactly one `Local CI / <profile>` check run exists for the tuple, created by the pinned App id, carrying the pinned installation id, with `external_id` equal to the tuple key and a `success` conclusion for the requested attempt.
   - `policyVersion`, `controllerVersion` and `imageDigest` are approved by the policy.
   - The suite inventory is complete: every required suite present and passed; every conditional suite present and not failed (a skip is only legal for suites that `scripts/ci/profiles` marks conditional); every reported suite is in the inventory; coverage passed.
   - Every required hosted workflow (by numeric workflow id, not by name) has a successful run of the expected event on the tested SHA, containing the required job names, with no skipped jobs.
   - The PR head still equals `headSha` (no superseding push during evaluation).
   - Freshness: `merge` has no time bound (a superseding push invalidates evidence instead); `main-deploy` requires evidence and hosted runs newer than 6 hours.
4. On success the gate publishes `Release gate` and the compatibility checks on both `headSha` and `testedSha`. On refusal it publishes failures (fail closed) whenever it could bind the request to this repository; foundational refusals (bad input, wrong repository, broken policy) publish nothing.

Refusal codes are stable strings (`repository-mismatch`, `superseded`, `evidence-app-mismatch`, `evidence-installation-mismatch`, `evidence-attempt-mismatch`, `suite-inventory-incomplete`, `suite-skipped`, `coverage-failed`, `hosted-job-skipped`, `fallback-unapproved`, `fallback-workflow-mismatch`, `stale`, `api-error`, ...). They appear in the check text and in the decision JSON artifact.

### Fallback evidence

`Hosted profile fallback / <profile>` is accepted instead of the local check only when all of the following hold: the check was created by the GitHub Actions app (id 15368); the document names a `runId`; the check's `details_url` points at that run; the run belongs to the fixed `fallbackWorkflow.id`, was a completed successful `workflow_dispatch`; the run has an approved review for the `CI fallback` environment; and a successful `CI fallback` deployment status references the run. Any missing piece refuses.

`Fork profile` produces the same document for fork PRs but with hosted sentinel image and controller identifiers, so the gate always rejects it (`evidence-version-rejected`). Fork evidence is for reviewers; a maintainer dispatches a real request to merge.

## Why the gate only checks out `main`

If the policy or the gate code came from the candidate, a PR could edit `config/ci/policy.json` (or the gate) to approve itself. `release-gate.yml` therefore checks out `ref: main`, fetch depth 1, with `persist-credentials: false`, and `pnpm ci:contracts:validate` fails any change that points the checkout elsewhere, adds permissions, or raises the 3-minute timeout. The workspace is not installed in the gate job: the gate imports Node built-ins only, so `pnpm dlx tsx@<lockfile version>` runs the entrypoint directly; the version pin is validated against `pnpm-lock.yaml`.

## Required checks to configure

Branch protection (or a ruleset) on `main` must require:

| Check                               | Publisher                                    |
| ----------------------------------- | -------------------------------------------- |
| `Release gate`                      | Release gate workflow (GitHub Actions token) |
| `Local CI / pr`                     | GitHub App `nabatable-local-ci`              |
| `Service-role route authorization`  | Security guards workflow                     |
| `CodeQL JavaScript and TypeScript`  | CodeQL security review workflow              |
| `Full Vitest suite`                 | Release gate (mirrors `full-vitest-suite`)   |
| `Fast static gates`                 | Release gate (mirrors `fast-static-gates`)   |
| `Coverage and performance evidence` | Release gate (mirrors coverage suite)        |
| `Browser smoke packs`               | Release gate (mirrors `browser-smoke-packs`) |
| `Primitive coverage`                | Release gate (mirrors `fast-static-gates`)   |
| `Shuffle seed 20260715`             | Release gate (mirrors shuffle suite)         |
| `Shuffle seed 20260716`             | Release gate (mirrors shuffle suite)         |
| `Shuffle seed 20260717`             | Release gate (mirrors shuffle suite)         |

The compatibility rows keep the historical required-check list unchanged during the transition; the legacy hosted workflows that used to publish them (`test-suite.yml`, `e2e-smoke.yml`, `test-stability.yml`, `shadcn-primitives.yml`) are scheduled for removal after Phase 4 evidence. `pnpm ops:verify` audits the configured contexts hourly (`config/observability/monitoring.yaml` `requiredChecks`).

## Configuring the policy

`config/ci/policy.json` ships with `REPLACE_ME_*` placeholders for identifiers that only exist once the GitHub Apps and workflows have been created. The gate refuses (`policy-unconfigured`) until every placeholder is replaced; `pnpm ci:contracts:validate` warns while they remain. Fill in:

- `repositoryId`: `gh api repos/<owner>/<repo> --jq .id`
- `localCi.appId` / `localCi.installationId`: from the App settings page and `gh api /repos/<owner>/<repo>/installation`
- `dispatch.appId`
- `allowedImageDigests`: the executor job image digest(s) from `scripts/ci/profiles` once built
- `requiredHostedWorkflows.*.id` and `fallbackWorkflow.id`: `gh api repos/<owner>/<repo>/actions/workflows --jq '.workflows[] | {name, id}'`

Bumping `policyVersion` (format `YYYY-MM-DD.N`) must happen together with `scripts/ci/profiles/catalog.ts` `POLICY_VERSION`; the contract validator fails on drift.

## Rollback

Rollback is a routing change, never a disabled check:

- Web: `pnpm deploy:vercel:promote` to a previously verified immutable deployment (its evidence must carry the expected revision).
- Workers: `wrangler versions deploy <previous version>@100%` through `pnpm deploy:workers`.
- Database: forward-only migrations; recovery is a restore drill, not a rollback.

Never remove a required check, lower `freshnessHours.main-deploy`, or add a digest to `allowedImageDigests` to unblock a release. If the gate refuses, fix the evidence.

## Hosted lane failures

- **Main.** `release-gate.yml` runs for every completed push-triggered hosted lane on `main` regardless of conclusion, so a failed `Security guards` or `CodeQL security review` run is recorded as a failing `Release gate` check on the merged SHA rather than a missing one. Protected delivery therefore sees an explicit refusal.
- **Pull requests.** The operational Worker coalesces local and hosted completion and only dispatches the gate once every required run succeeded. A failed hosted lane leaves the candidate `rejected` without a dispatch: the failing hosted check is already visible on the PR and the required `Release gate` context stays missing, which blocks merging. Publishing an explicit failing gate for PR candidates is a follow-up that requires the coordinator to dispatch on hosted failure and re-dispatch on a successful re-run.
