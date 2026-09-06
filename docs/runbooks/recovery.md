# Recovery runbook

> **This page describes the intended design, not what is running.** Verified 2026-09-06: production
> is deployed automatically and **ungated** by Vercel's Git integration on every push to `main`;
> `Protected delivery` has never run successfully, and the release gate, CodeQL, backups, the restore
> drill and the hourly verifier have never run at all. See [current state](../ci/current-state.md) for what is
> actually operating and what it would take to commission the rest.

Owner: platform-engineering. Policy: `config/recovery/policy.yaml` (validated by `scripts/db/backup/policy.ts`). Scope: `config/recovery/restore-manifest.yaml`. Commands: `pnpm db:backup`, `pnpm db:restore-verify`, `pnpm recovery:drill`, `pnpm recovery:evidence:check`, plus the Cloudflare tools under `scripts/cloudflare/recovery/`.

## Objectives

| Objective                  | Value                                | Enforced by                                                           |
| -------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| RPO                        | 24 h                                 | `independentBackup.maxAgeHours` (block) and `warnAtHours` 18 h (warn) |
| RTO                        | 4 h                                  | drill step `measure_readiness`; evidence `withinRto` must be true     |
| Independent backup cadence | every 12 h, retained 7 days          | `backup.yml` schedule (`23 */12 * * *`), bucket lifecycle rule (7 d)  |
| Native backup              | `supabase-daily-physical`, 7 days    | Supabase project setting; one copy, never the plan                    |
| Restore drill cadence      | every 14 days; warn 21 d, block 30 d | `recovery-drill.yml` schedule; `recovery:evidence:check` thresholds   |
| PITR                       | `disabled_optional`                  | policy rule: never rendered as enabled                                |

Backups and drills are **evidence-producing**: a backup that did not write a validated manifest, or a drill that did not clean up, does not count. `recovery:evidence:check` fails closed on missing, unsigned, stale, or misrepresented evidence and returns exit 10 (warn) or 20 (block) for the deploy workflow.

## Identities

Two GitHub environments hold the recovery identities and never share a credential: `Backup` (`backup.yml`) holds the production read identity and the bucket **write** credentials; `Recovery` (`recovery-drill.yml`) holds the disposable-project credentials and the bucket **read** credentials. The lists match `docs/ci/governance.md`.

### `Backup` environment (`backup.yml`, every 12 h)

| Identity                                                      | Rules                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB_BACKUP_ROLE_URL`                                          | Dedicated read-only Postgres role whose name contains `backup`. `scripts/db/backup/identity.ts` refuses `postgres`, `service_role`, any `*admin*`/`*service*` role, any URL equal to or sharing a secret with `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and any host that is not the expected project ref. |
| `BACKUP_ENCRYPTION_KEY`                                       | 32 bytes (hex or base64). AES-256-GCM, streamed; the header stores IV and an 8-byte key id (`sha256(key)[0..8]`) and is authenticated as GCM AAD. Plaintext dumps never touch disk. Also present in `Recovery` (the drill decrypts).                                                                                                                     |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_WRITE_*` | Endpoint, region, write-only access key and secret for the **encrypted backup bucket** (exposed to `db:backup` as `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY`). Implemented in `scripts/db/backup/s3.ts` (SigV4, node built-ins); deliberately not shared with `scripts/ci/**`.                                                            |
| `STORAGE_BACKUP_API_URL`, `STORAGE_BACKUP_TOKEN`              | Read-only Supabase Storage access for the object backup leg.                                                                                                                                                                                                                                                                                             |
| variable `DB_BACKUP_BUCKET`                                   | The encrypted backup bucket name; a placeholder refuses.                                                                                                                                                                                                                                                                                                 |

### `Recovery` environment (`recovery-drill.yml`, 1st and 15th monthly)

| Identity                                                                               | Rules                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RECOVERY_DRILL_PROJECT_REF`, `RESTORE_VERIFY_DB_URL`                                  | The disposable project (`scripts/db/restore/drill.ts` reads `RECOVERY_DRILL_PROJECT_REF`). `vrdiqfudmwydclqpydee` (production) and `ndxmivcrehsacuerwxtm` (staging) are refused unconditionally, as is anything in the `RESTORE_PROJECT_REF_DENYLIST` variable. `RESTORE_VERIFY_PROJECT_REF` is only the alias `pnpm db:restore-verify` (safe-run) uses for the same value. |
| `RECOVERY_SUPABASE_MANAGEMENT_TOKEN`                                                   | Exposed to the drill as `SUPABASE_MANAGEMENT_TOKEN`; only used to destroy the disposable drill project. The destroyer refuses any ref other than the drill target.                                                                                                                                                                                                          |
| `RECOVERY_EVIDENCE_HMAC_KEY`                                                           | Signs drill evidence (HMAC-SHA256 over canonical JSON). Also in `Production`, where the deploy gate verifies with the same key.                                                                                                                                                                                                                                             |
| `BACKUP_ENCRYPTION_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_DRILL_*` | Decryption key and read-only bucket credentials for the drill (exposed as `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY`). The `Production` environment holds a separate read-only pair, `BACKUP_S3_READ_*`, for `recovery:evidence:check`.                                                                                                                      |

## Buckets

- Encrypted backup bucket: `policy.bucket` (placeholder `REPLACE_ME_ENCRYPTED_BACKUP_BUCKET` until provisioned; the CLI treats a placeholder as unconfigured and refuses). Lifecycle rule: expire objects under `backups/` after `independentBackup.retentionDays` (7) days; `evidence/recovery/` is kept.
- CI evidence bucket: `policy.ciEvidenceBucket`, a different bucket by construction (`parseRecoveryPolicy` rejects equality). Backup credentials are never granted on it.
- Layout: `backups/<backupId>/manifest.json`, `backups/<backupId>/<part>.dump.enc`, `backups/<backupId>/exports/<id>.csv.enc`, `backups/<backupId>/storage-manifest.json`, `backups/<backupId>/storage/<bucket>/<path>.enc`, `evidence/recovery/<drillId>.json`, `evidence/recovery/latest.json`, `evidence/recovery/latest.gate.json`.

## Backup (every 12 h)

`pnpm db:backup --target production` → `scripts/db/safe-run.ts backup` → `tsx scripts/db/backup/run.ts --target production --identity-env DB_BACKUP_ROLE_URL --bucket <bucket>`.

1. Load and validate policy and restore manifest; refuse a placeholder bucket or a bucket equal to the CI evidence bucket.
2. Validate the backup identity (see above) and that `pg_dump`, `psql` are **major 17**.
3. SQL exports (encrypted): migration ledger, grants, extensions, cron job definitions (optional), row counts.
4. `pg_dump --format=custom` for `public` and `supabase_migrations` (schema+data), then `auth.users` / `auth.identities` data-only, each streamed through the encryptor to disk and uploaded. Provider-managed schemas (`storage`, `realtime`, `vault`, `pgsodium`, `supabase_functions`, `graphql*`, `pgbouncer`, `extensions`, `net`) are listed as "restore via supported procedure" and are not dumped.
5. Supabase Storage objects (`restaurant-branding`, `profile-avatars`, `menus`): listed, downloaded, validated against provider size/etag metadata, hashed, encrypted, uploaded with their own manifest (`--skip-storage` to omit).
6. Manifest: `{ backupId, createdAt, sourceRef, target, identity (redacted), sizeBytes, sha256, artifacts, schemaVersions, migrationLedgerHead, pitrState, effectiveRecoveryWindowDays, encryption.keyId, pgDumpVersion, policyVersion, storageObjects }`.

`--dry-run` prints the plan without connecting. Local work files are removed in `finally`.

## Restore drill (every 14 days)

`pnpm recovery:drill` → `scripts/db/restore/drill.ts` picks the newest backup and runs `scripts/db/restore/verify.ts` against the disposable project; `pnpm db:restore-verify` runs the same drill through `safe-run.ts` with `RESTORE_VERIFY_PROJECT_REF`. Steps, in fixed order (`DRILL_STEP_ORDER`):

1. `verify_backup` – manifest exists, backupId/sourceRef match, age ≤ 24 h, key id matches, every artifact present with the recorded size.
2. `disable_outbound` – **before any data load**: `cron.unschedule` every job, set `app.recovery_drill`/`app.outbound_disabled` GUCs, record the application kill switches (`GBP_*_ENABLED=false`, `GBP_WRITE_ROLLOUT_MODE=off`, `RECOVERY_DRILL=true`) that any app pointed at the copy must run with.
3. `restore_data` – `pg_restore --exit-on-error --no-owner` from decrypted, digest-verified archives fed over stdin.
4. `verify_schema` – migration ledger head equals the manifest, core tables have RLS, grants match the export, no invalid constraints/indexes, functions and extensions present, **zero active cron jobs**.
5. `verify_data` – row counts per table equal the export; every foreign key has no orphans.
6. `verify_storage` – encrypted-data recovery check (header parse + decrypt) and every storage object decrypts to its recorded digest.
7. `isolation_proofs` – `tests/db/fixtures/*.sql` inside `BEGIN … ROLLBACK`, plus embedded tenant/booking/idempotency proofs.
8. `measure_readiness` – seconds from start to verified-ready vs the 4 h RTO.
9. `destroy` – **always runs** (`finally`): delete the temp project via the Management API (refuses any other ref), revoke the temp credentials.
10. `emit_evidence` – redacted, HMAC-signed `RecoveryEvidence` with `cleanup.succeeded`, `schedulesDisabledBeforeLoad`, `withinRto`, the PITR rendering and `activeRuntime: node22` / `candidateRuntime: node24`.

The drill also publishes a gate-shaped copy (`latest.gate.json`) that matches the trusted CI `RecoveryEvidenceSchema` so `ci:gate` can consume it without importing recovery code.

### Evidence check (deploy gate)

`pnpm recovery:evidence:check [--evidence <file> --backup-manifest <file>] [--json]`

| Condition                                                                                                    | Result     |
| ------------------------------------------------------------------------------------------------------------ | ---------- |
| No evidence / invalid signature / not passed / cleanup failed / loaded before disabling schedules / over RTO | block (20) |
| Latest successful drill older than 30 days                                                                   | block (20) |
| Latest successful drill older than 21 days                                                                   | warn (10)  |
| Latest backup older than 24 h                                                                                | block (20) |
| Latest backup older than 18 h                                                                                | warn (10)  |
| PITR misrepresented (see below)                                                                              | block (20) |
| Bucket / keys unconfigured                                                                                   | 2 (blocks) |

## PITR statement

PITR is `disabled_optional`: a paid Supabase add-on that is **not enabled**. Every renderer goes through `renderPitrState`, which prints "PITR: not enabled (disabled, optional add-on)". A state of `enabled` is only rendered as enabled when `pitr.inspectedAt` is a real inspection timestamp (not `REPLACE_ME_PITR_INSPECTED_AT`); `unknown` is never rendered as either. Evidence that disagrees with the policy blocks the deploy.

## Effective recovery window and GBP retention

`computeEffectiveRecoveryWindowDays({ nativeRetentionDays: 7, independentRetentionDays: 7, intervalHours: 12, overhangDays: 1 })` = `ceil(max(7, 7 + 0.5) + 1)` = **9 days**: the longest any copy of provider (GBP) content can exist, rounded up. The GBP retention policy in `server/dual-sync/retention/policy.ts` derives the live content TTL from the backup window (`computeContentTtlDays`), so the same window governs live rows, native backups, independent backups and storage copies. The recovery tooling only **reads** that policy (`impliedContentTtlDays`); it never changes content-expiry enforcement. If retention or cadence changes, the manifest field `effectiveRecoveryWindowDays` changes with it and the CI gate rejects a backup older than that window.

## Cloudflare recovery

Cloudflare state is outside the Supabase backup. See `scripts/cloudflare/recovery/`:

- **D1** (`d1-backup.ts`): `wrangler d1 export` of `booking_short_links` per environment, integrity-checked against live counts and `d1_migrations`, encrypted with `BACKUP_ENCRYPTION_KEY`. Restore: `wrangler d1 execute <db> --remote --file <decrypted export>` into a fresh database, then `wrangler d1 migrations apply`.
- **KV** (`kv-rebuild.md`, `kv-rebuild.ts`): rebuildable cache; invalidate, then rewarm from D1. `--confirm` required to mutate.
- **Durable Objects** (`do-state.md`): every class classified. `DailyBookingSummaryState` is authoritative (idempotency); loss is reconciled, never restored.
- **Queues** (`queue-reconcile.ts`): compare backlog/DLQ with the application ledger (gateway dry-run dispatch, never enqueues) and the Twilio message log; write a report; replay is refused without a fresh report for the same environment and `--confirm-replay`, and is always `dryRun` in drills or staging.
- **Secrets** are re-set per environment with `wrangler secret put`; they are never in backups.

## A Supabase-only drill does not establish platform recovery

Passing `recovery:drill` proves the **database and storage objects** can be restored within the RTO. It does not prove the platform recovers: Vercel deployment, Worker deployments and secrets, D1/KV/DO state, DNS, Twilio/Resend/GBP integrations and their kill switches are separate. A full platform recovery exercise chains: database drill → D1 restore → KV rebuild → Worker redeploy (`deploy:workers`) → queue reconciliation → web deploy (`deploy:vercel:prebuilt`) → readiness (`ops:verify`). Record each leg's evidence; the deploy gate consumes only the database leg today.

## Incident procedure (summary)

1. Declare, freeze deploys (`deploy:staging-lock` where applicable), set kill switches.
2. `recovery:evidence:check --json` to see the newest usable backup and drill.
3. Provision a fresh Supabase project; run `db:restore-verify` against it (this is the real restore, on a ref that is neither production nor staging until cutover is decided).
4. Re-point secrets, redeploy Workers and web, rebuild KV, reconcile queues before re-enabling cron triggers.
5. `ops:verify`; close with a post-incident record and a follow-up drill within 14 days.
