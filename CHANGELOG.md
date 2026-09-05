# Changelog

All notable changes are recorded here by Release Please from Conventional Commit history.

## Unreleased

### Added

- Disposable Lima instance names now fit macOS socket limits under longer current-user CI paths, retaining deterministic retry identity and the private CI home.

- Private CI source fetches now use repository-scoped, read-only CI App installation tokens from Keychain, with identity checks, per-fetch revocation and credential-free guest bundles.

- Explicit current-user Mac runner setup alongside the dedicated-account default, with UID checks, private CI paths, isolated Lima/Docker state, ambient-environment clearing, and a `--no-start` staging option. This mode shares the existing macOS user security boundary; golden-image provisioning and qualification remain in progress.

- Golden image provisioning now handles Docker's blob CDN, applies daemon isolation before network creation, builds through the restricted job proxy, and removes the loopback build registry on failure as well as success, and exports both Lima disk layouts. A shared root-owned Corepack cache makes pinned pnpm available offline to non-root jobs.
- Mac runner preparation: pinned Ubuntu and Docker inputs, Node 22 service-account PATH, and provisioning checks that distinguish unresolved configuration from intentional rejection patterns.

- Content-bound Gitleaks review records for independently reviewed pre-existing false positives; changed source blobs and malformed scanner reports fail closed. Fixed the introduced synthetic Resend fixture without suppressing its finding.

- Local-first CI/CD: shared CI contracts and profiles (`scripts/ci/contracts`, `scripts/ci/profiles`, `config/ci/*`), the Mac controller (`pnpm ci:controller`), the disposable-VM executor (`pnpm ci:executor`), Lima/Docker/launchd infrastructure under `infra/local-ci/`, and the hosted release-gate bridge (`pnpm ci:gate`, `pnpm ci:contracts:validate`) with `release-gate.yml`, `hosted-profile-fallback.yml`, `fork-profile.yml` and `deploy.yml` (`Protected delivery`).
- `cloudflare/operational-control`: fourth Worker acting as the CI/monitoring control plane (GitHub webhook verification, coalesced gate dispatch, controller heartbeats, readiness probes, incidents, R2 evidence).
- Readiness endpoints (`GET /api/ready`, Worker `GET /ready`) authenticated with `MONITORING_TOKEN`, `config/observability/monitoring.yaml`, hourly `pnpm ops:verify` (`operational-verification.yml`), `pnpm ops:slo-evidence`, and incident deduplication in the error-insight webhook.
- Staging separation and delivery scripts: `env.staging` blocks for every Worker, `pnpm deploy:validate-separation`, `deploy:staging-lock`, `deploy:vercel:prebuilt`, `deploy:vercel:promote`, `deploy:workers`, `pnpm e2e:staging` (staging proof pack), `pnpm release:manifest` and `pnpm release:sbom` (CycloneDX 1.5).
- Database promotion safety: `pnpm db:plan-remote`, `db:sql-regression`, `db:check-migration-immutability` (`config/db/migration-checksums.json`), guarded `db:backup` and `db:restore-verify`, extended drift inventory.
- Backup and recovery: encrypted independent backups (`backup.yml`, every 12h), restore drills with signed evidence (`recovery-drill.yml`, `pnpm recovery:drill`, `pnpm recovery:evidence:check`), Cloudflare D1/KV/queue recovery tooling (`pnpm recovery:d1-backup`, `recovery:kv-rebuild`, `recovery:queue-reconcile`), `config/recovery/*` and `docs/runbooks/recovery.md`.
- Documentation: `docs/ci/local-first-ci.md`, `docs/ci/release-gate.md`, `docs/ci/governance.md`, `docs/runbooks/{local-ci,staging-release,monitoring,recovery}.md`.

### Changed

- Executor jobs now keep home and the pnpm store on a disposable writable volume outside the source checkout, preserving the read-only container root and source-file checks.

- Record verified Nabatable CI repository, App, and workflow identities while retaining the unqualified-image release block. Document the approved bucket-scoped R2 evidence permission exception.

- PR hosted-lane failures now trigger an explicit Release gate refusal, with another gate dispatch after a newer hosted attempt completes.

- Error-insight incident counts and escalation state persist through service-role-only atomic Supabase updates; the new migration must be promoted before deploying the receiver.

- Security guards install checksum-pinned Gitleaks and TruffleHog; the five pre-existing CodeQL baseline alerts now link to review issues.
- Operational incident acknowledgement uses a dedicated bearer token; monitoring no longer requires a legacy execution workflow scheduled for Phase 4 retirement.

- `sms-summary-gateway` honours `DELIVERY_MODE=sink` (staging kill switch); staging Workers never deliver to providers.
- Legacy hosted suites (`test-suite.yml`, `e2e-smoke.yml`, `test-stability.yml`, `shadcn-primitives.yml`) carry removal headers; their required-check names are now mirrored by the release gate.
- `config/observability/monitoring.yaml` names `operational-verification.yml` as the hourly verifier; `RESTORE_VERIFY_DB_URL` is the single name for the drill's scratch DB URL.
- `deploy:workers` and `deploy:validate-separation` enumerate `operational-control`; lowercase `replace-me-*` R2 bucket placeholders are treated as unconfigured.

## 0.1.0

- Establish the Nabatable platform release baseline.
