# Changelog

All notable changes are recorded here by Release Please from Conventional Commit history.

## Unreleased

### Fixed

- Confirm unbound table holds atomically while retaining conflict locks and restoring the lease on failure. Show Google Business drift and dual-sync controls only for a linked account and location; preserve consumed OAuth states in regression coverage without rewriting applied migration history.

- Qualify the review scheduler hash function and persist booking-completion scheduling jobs with fenced retries, truthful cron failures and review-email deduplication. Add tenant-scoped historical recovery without automatic backfill.

- Create staff table holds through one atomic RPC and enforce live hold conflicts in database mutation paths. Keep the hold-window projection synchronized and release booking holds during terminal cleanup. Add deployed contention and persisted out-of-order SMS callback proofs.

- Release manual table assignments atomically with their allocation and idempotency state, allowing fresh-key reassignment while preserving partial merge groups, tenant boundaries and service-role-only RPC access. Add rollback SQL coverage for partial, final, repeated and legacy-wrapper releases.
- Recognize authenticated Supabase CLI temporary pooler roles in exact-project database safety validation.

### Added

- Support project-scoped Vercel automation protection credentials for the staging email consumer and exact-origin operational probes, without following redirects or weakening application authentication.

- Exercise synthetic guest recovery and cancellation, cross-tenant recovery denial and authenticated membership isolation, email queue persistence and deduplication, and exact SMS preview contracts in staging. Keep protection credentials scoped to staging web origins and disable credential-bearing traces.

- Apply Vercel `--skip-domain` only to production; custom staging deployments use their isolated environment aliases.

- Verify Resend webhook signatures locally without requiring an email-sending API key at build time. Preserve raw-body and timestamp verification for isolated staging.

- Record the isolated Vercel staging project and custom environment, enabling full environment-separation validation. Document the owner's choice to use provider health checks without an external alert service.

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

- Preserve the Supabase RPC client receiver when atomically removing table assignments, fixing operator unassignment failures before database access. Verify reassignment and terminal booking transitions with a genuine synthetic operator session.

- Route the ops app through an exact configured HTTPS origin, keep Supabase and CSRF cookies host-only on Vercel aliases, and bootstrap staging browser protection with separately scoped secure cookies. Preserve complete Vercel hostnames instead of inventing a `www` canonical alias.

- Route operational readiness probes through Cloudflare public Worker endpoints with `global_fetch_strictly_public`, covering same-account Worker destinations.

- Bind the public source SHA explicitly into the Vercel deployment runtime so readiness can verify prebuilt artifacts; retain exact-revision rejection. Sanitize Playwright transport errors before authenticated staging requests reach reports.

- Return per-job outcomes from the authenticated email-processing callback so the Cloudflare consumer can complete successful jobs. Call monitoring fetch without an object receiver so native Cloudflare requests reach their targets.

- Record verified staging short-link D1 and dedicated KV resources and the Cloudflare Worker subdomain. Placeholder-rejection tests now use explicit fixtures so provisioning cannot remove their coverage.

- CI evidence collection now records unsupported object names before upload and includes operational-control Worker reports, preserving the strict R2 key policy and complete Worker results.

- Executor jobs now keep home and the pnpm store on a disposable writable volume outside the source checkout, preserving the read-only container root and source-file checks.
- Job images include Python for admission-hook tests; executable temporary fixtures use job-home storage while `/tmp` remains `noexec`. CI test fixtures now handle Linux home paths and offline package-manager isolation.

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

- Validate Worker-only releases independently of Vercel provisioning, retain environment storage isolation, and configure verified operational-control resource identities and endpoints.
