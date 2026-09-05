# CI/CD governance

This document records the GitHub-side configuration that the workflows under `.github/workflows/` assume, and the checklist to run when the repository, its GitHub Apps, or its environments change. `pnpm ci:contracts:validate` enforces the parts that can be checked from the repository; the rest must be verified by an administrator.

## Workflows and identities

| Workflow (display name)    | File                                | Trigger                                                                                                               | Identity / environment                         |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Release gate`             | `release-gate.yml`                  | `workflow_dispatch`, hosted lanes completing on main                                                                  | `GITHUB_TOKEN` (`checks: write`), no env       |
| `Hosted profile fallback`  | `hosted-profile-fallback.yml`       | `workflow_dispatch` (tuple inputs)                                                                                    | environment `CI fallback` (required reviewers) |
| `Fork profile`             | `fork-profile.yml`                  | `pull_request` from forks only                                                                                        | none: no secrets, no caches                    |
| `Protected delivery`       | `deploy.yml`                        | `workflow_dispatch`; `Release gate` on main only when variable `PROTECTED_DELIVERY_AUTOMATION` is `enabled` (Phase 5) | environments `Staging`, `Production`           |
| `Operational verification` | `operational-verification.yml`      | hourly, after `Protected delivery`                                                                                    | environment `Monitoring`                       |
| `Database backup`          | `backup.yml`                        | every 12h                                                                                                             | environment `Backup`                           |
| `Recovery drill`           | `recovery-drill.yml`                | 1st and 15th monthly                                                                                                  | environment `Recovery`                         |
| `Security guards`          | `security-guards.yml`               | every PR and push to main                                                                                             | `GITHUB_TOKEN` read                            |
| `CodeQL security review`   | `codeql.yml`                        | every PR, push to main, weekly                                                                                        | `GITHUB_TOKEN` (`security-events: write`)      |
| `Readiness quality gates`  | `quality-gates.yml`                 | every PR and push to main                                                                                             | `GITHUB_TOKEN` read                            |
| Legacy suites              | `test-suite.yml` and three siblings | every PR                                                                                                              | scheduled for removal after Phase 4 evidence   |

GitHub Apps:

- `nabatable-local-ci` (Mac controller): `checks: write`; `metadata`, `contents`, `pull_requests`, `actions`: read. Publishes `Local CI / <profile>`.
- `nabatable-ci-dispatch` (Cloudflare Worker): `actions: write`; everything else read. Dispatches `Hosted profile fallback` and `Release gate`.

### Environments

The reviewed plan named five environments: `Staging`, `Production`, `CI fallback`, `Monitoring`, `Recovery`. **Plan amendment (recorded here):** the contract is six environments; the sixth, **`Backup`**, holds only the dedicated production read-only backup role URL, the client-side encryption key, and the write-only credentials of the encrypted backup bucket. It is separate from `Recovery` so that a drill identity (which can create and destroy disposable projects) never holds the production read identity, and from `Monitoring` so that the hourly verifier holds no database credential at all. The amended list is the single source of truth in `scripts/ci/contracts/names.ts` (`GITHUB_ENVIRONMENTS`), mirrored by the validator's `KNOWN_ENVIRONMENTS`, `docs/environments.md` and the Phase 2 checklist in `docs/ci/local-first-ci.md`.

Required reviewers and wait timers:

| Environment   | Required reviewers        | Notes                                                        |
| ------------- | ------------------------- | ------------------------------------------------------------ |
| `Production`  | 2 (platform-engineering)  | Approval recorded by the `Production approval` job           |
| `Staging`     | none                      | Serialized by `deploy:staging-lock`                          |
| `CI fallback` | 1 (platform-engineering)  | The gate requires the approval record for the exact run      |
| `Monitoring`  | none                      | Read-only tokens only                                        |
| `Backup`      | none (scheduled)          | Dispatch restricted to administrators                        |
| `Recovery`    | 1 for `workflow_dispatch` | Temporary credentials; the workflow always destroys the temp |

### Native protected environments

Environment protection rules (required reviewers, deployment branch policies) are available for public repositories on every plan, but for **private repositories they require GitHub Enterprise**. The release gate's fallback verification and `Protected delivery` depend on those rules being enforced natively. Until the repository is public or on an Enterprise plan, do not treat `Hosted profile fallback` evidence as trustworthy and do not enable the automated `workflow_run` path of `Protected delivery`; run it by dispatch with the approval enforced by repository administrators. The automated path is guarded in `deploy.yml` by the repository variable `PROTECTED_DELIVERY_AUTOMATION` (`resolve-candidate` only starts from a `Release gate` run when it equals `enabled`; unset means dispatch-only), and `pnpm ci:contracts:validate` fails if the guard is removed while the `workflow_run` trigger remains. Set the variable only in the Phase 5 change that records the plan status here.

## Secrets and variables per environment

Values are never committed. Names only:

- `Staging`: `STAGING_LOCK_GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `STAGING_SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MONITORING_TOKEN`, `STAGING_SYNTHETIC_*`; variables `STAGING_PUBLIC_URL`, `STAGING_OPS_URL`.
- `Production`: the production equivalents of the above plus `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, read-only `BACKUP_S3_READ_ACCESS_KEY_ID` / `BACKUP_S3_READ_SECRET_ACCESS_KEY`, `RECOVERY_EVIDENCE_HMAC_KEY` (verification only).
- `Monitoring`: `MONITORING_TOKEN`, `MONITORING_GITHUB_TOKEN`, `MONITORING_HEARTBEAT_URL`; variables `MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL`, `MONITORING_OPERATIONAL_CONTROL_BASE_URL` (both Workers have no committed hostname; `ops:verify` fails closed as `unconfigured` until set).
- `Backup`: `DB_BACKUP_ROLE_URL`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_WRITE_ACCESS_KEY_ID`, `BACKUP_S3_WRITE_SECRET_ACCESS_KEY`, `STORAGE_BACKUP_API_URL`, `STORAGE_BACKUP_TOKEN`; variable `DB_BACKUP_BUCKET`.
- `Recovery`: `RECOVERY_DRILL_PROJECT_REF`, `RESTORE_VERIFY_DB_URL`, `RECOVERY_SUPABASE_MANAGEMENT_TOKEN`, `RECOVERY_EVIDENCE_HMAC_KEY`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_S3_*` (drill read credentials); variable `RESTORE_PROJECT_REF_DENYLIST`.

Every script fails closed when its inputs are missing or still `REPLACE_ME_*`.

## Runtime policy

Hosted workflows pin Node 22 (`activeRuntime`). Production Vercel builds already run Node 24 (`candidateRuntime`). Node 24 becomes active only after a full nightly profile and a staging release pass on a node24 executor image whose digest is listed in `config/ci/policy.json`, with package `engines` and every workflow `node-version` bumped in the same reviewed change. `pnpm ci:contracts:validate` fails a workflow that pins any other version, and the policy parser rejects `activeRuntime` other than `node22` until that change lands.

## Contract validation

`pnpm ci:contracts:validate` (`scripts/ci/gate/validate-contracts.ts`) runs in `Security guards` on every PR and asserts:

- the required workflow display names and job display names exist (including `Full Vitest suite`, `Fast static gates`, `Coverage and performance evidence`, `Browser smoke packs`, `Primitive coverage`, `Shuffle seed 20260715|16|17`, `Service-role route authorization`, `CodeQL JavaScript and TypeScript`);
- required hosted lanes have no `paths`/`paths-ignore`/`branches` filters on `pull_request` and run on every push to main;
- no `pull_request_target` workflow checks out the PR head;
- every `uses:` is pinned to a 40-character commit SHA (a `TODO-PIN` comment downgrades to a warning, except in `Release gate`, `Protected delivery` and any job under the `Production` or `Staging` environment, where a tag pin is always a violation);
- the `Security guards` step that runs `pnpm secret:scan` is preceded by gitleaks and trufflehog install steps, or explicitly sets `SECRET_SCAN_ALLOW_BUILT_IN_ONLY: 'true'` (reported as a warning until the scanners are provisioned);
- every checkout sets `persist-credentials: false`; every `setup-node` pins Node 22;
- `release-gate.yml` checks out `main` only, has `timeout-minutes: 3`, exactly the contract permissions, a concurrency group, and a `tsx` pin equal to the lockfile;
- `Protected delivery` jobs are guarded by `github.ref == 'refs/heads/main'` and Production jobs never cancel in progress; while it carries a `workflow_run` trigger, its root job is additionally guarded by `vars.PROTECTED_DELIVERY_AUTOMATION == 'enabled'`; every job that runs `pnpm db:migrate` first runs `pnpm deploy:validate-separation --env <DB_TARGET_ENV>`, `pnpm db:link` and `pnpm db:plan-remote`, in that order;
- `Hosted profile fallback` triggers only on `workflow_dispatch` under the `CI fallback` environment; `Fork profile` references no secrets and no caches;
- only the six known environments are used;
- `config/ci/policy.json` agrees with `scripts/ci/profiles` (policy version, suite ids, conditional flags, display names, compatibility mapping) and with the workflow tree (hosted workflow names, required jobs, compatibility check names).

## Transfer / revalidation checklist

Run after a repository transfer, rename, App reinstall, or environment recreation:

1. Update `config/ci/policy.json`: `repositoryId`, `localCi.appId`, `localCi.installationId`, `dispatch.appId`, workflow ids for `Security guards`, `CodeQL security review`, `Hosted profile fallback`. Bump `policyVersion` together with `scripts/ci/profiles/catalog.ts`.
2. Update `config/ci/trust-policy.json` `trustedRepositoryId` and the controller's `controller.env` (see `docs/runbooks/local-ci.md`).
3. Reinstall both GitHub Apps on the new repository; confirm permissions match the table above; rotate private keys.
4. Recreate the six environments with reviewers, branch policies (`main` only for `Production`, `Staging`, `Backup`, `Recovery`), and the secret names above. Confirm the plan supports environment protection for the repository's visibility.
5. Configure branch protection / rulesets with the required checks listed in `docs/ci/release-gate.md`, require linear history, and forbid force pushes and deletions.
6. Run `pnpm ci:contracts:validate` locally; it must pass with zero violations, and its placeholder warnings must be gone.
7. Dispatch `Release gate` for the latest main commit in `main-deploy` mode and confirm a `Release gate` check appears with `evidenceSource: local`.
8. Dispatch `Hosted profile fallback` for a PR tuple, approve the `CI fallback` deployment, then dispatch `Release gate`; confirm the gate accepts `hosted-fallback` evidence.
9. Run `Operational verification` by dispatch; confirm `requiredChecks.status == "ok"` and a heartbeat was sent.
10. Run `Database backup` and `Recovery drill` by dispatch; confirm `pnpm recovery:evidence:check` reports `ok`.

## Rollback and incident posture

- A refused gate is never overridden by editing the policy, disabling a required check, or bypassing branch protection. Fix the evidence or route around the failure.
- Rollback is a routing change: promote a previously verified deployment (`deploy:vercel:promote`), redeploy a previous Worker version, or restore from an independent backup through the drill tooling.
- Migrations run under non-cancelling concurrency groups. Do not cancel a `Protected delivery` run that has started `Apply migrations to production`.
- Evidence artifacts (`candidate-evidence`, `staging-release-evidence`, `production-release-evidence`, `recovery-drill-evidence-*`) are retained for at least 90 days (400 for production and drills) and are redacted: manifests, digests, decisions; never dumps, tokens or guest data.
