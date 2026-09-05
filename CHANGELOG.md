# Changelog

All notable changes are recorded here by Release Please from Conventional Commit history.

## Unreleased

### Added

- Content-bound Gitleaks review records for independently reviewed pre-existing false positives; changed source blobs and malformed scanner reports fail closed. Fixed the introduced synthetic Resend fixture without suppressing its finding.

- Local-first CI/CD: shared CI contracts and profiles (`scripts/ci/contracts`, `scripts/ci/profiles`, `config/ci/*`), the Mac controller (`pnpm ci:controller`), the disposable-VM executor (`pnpm ci:executor`), Lima/Docker/launchd infrastructure under `infra/local-ci/`, and the hosted release-gate bridge (`pnpm ci:gate`, `pnpm ci:contracts:validate`) with `release-gate.yml`, `hosted-profile-fallback.yml`, `fork-profile.yml` and `deploy.yml` (`Protected delivery`).
- `cloudflare/operational-control`: fourth Worker acting as the CI/monitoring control plane (GitHub webhook verification, coalesced gate dispatch, controller heartbeats, readiness probes, incidents, R2 evidence).
- Readiness endpoints (`GET /api/ready`, Worker `GET /ready`) authenticated with `MONITORING_TOKEN`, `config/observability/monitoring.yaml`, hourly `pnpm ops:verify` (`operational-verification.yml`), `pnpm ops:slo-evidence`, and incident deduplication in the error-insight webhook.
- Staging separation and delivery scripts: `env.staging` blocks for every Worker, `pnpm deploy:validate-separation`, `deploy:staging-lock`, `deploy:vercel:prebuilt`, `deploy:vercel:promote`, `deploy:workers`, `pnpm e2e:staging` (staging proof pack), `pnpm release:manifest` and `pnpm release:sbom` (CycloneDX 1.5).
- Database promotion safety: `pnpm db:plan-remote`, `db:sql-regression`, `db:check-migration-immutability` (`config/db/migration-checksums.json`), guarded `db:backup` and `db:restore-verify`, extended drift inventory.
- Backup and recovery: encrypted independent backups (`backup.yml`, every 12h), restore drills with signed evidence (`recovery-drill.yml`, `pnpm recovery:drill`, `pnpm recovery:evidence:check`), Cloudflare D1/KV/queue recovery tooling (`pnpm recovery:d1-backup`, `recovery:kv-rebuild`, `recovery:queue-reconcile`), `config/recovery/*` and `docs/runbooks/recovery.md`.
- Documentation: `docs/ci/local-first-ci.md`, `docs/ci/release-gate.md`, `docs/ci/governance.md`, `docs/runbooks/{local-ci,staging-release,monitoring,recovery}.md`.

### Changed

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
