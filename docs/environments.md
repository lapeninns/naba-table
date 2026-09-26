# Environment Profiles & Safety

## Profiles

- `APP_ENV`: `development` | `staging` | `production` | `test` (defaults to `development`)
- `NODE_ENV` should mirror `APP_ENV` in production (`NODE_ENV=production`).
- Database scripts require explicit `DB_TARGET_ENV=staging|production`; they do not infer it from
  `APP_ENV`.

## Auth email delivery (Resend + Supabase)

- Magic-link emails from app auth routes are generated server-side via Supabase Admin API and delivered by the app's Resend integration (`server/auth/magic-link-email.ts` + `libs/resend.ts`).
- Supabase dashboard is configured to send remaining built-in auth emails via Resend SMTP.
- Provider setup (per env):
  - Resend API key name: **Supabase Integration** (create under Resend → API Keys; store secret in the hosting secret manager, not git).
  - Sender name: **Lapen Inns**
  - Sender email: **team@resend.adtechgrow.com**
  - SMTP host/port/user: `smtp.resend.com` / `465` / `resend`
  - SMTP password: use the generated secret from Resend; inject only in Supabase dashboard (not committed).
- In Supabase: go to **Settings → Email** and paste the above values; confirm the integration from the Supabase dashboard as prompted.
- App-side Resend usage remains via `RESEND_API_KEY` + `RESEND_FROM` in `.env.example`; keep `RESEND_FROM` aligned with the verified sender domain (`no-reply@notifications.nabatable.com`) for API-based emails, including auth magic links.
- Platform-owned transactional emails use `PLATFORM_REPLY_TO_EMAIL` for Reply-To headers and fall back to `info@lapeninns.com` when unset; restaurant booking emails use the venue contact email when present and otherwise use the same platform fallback.

## Guardrails

- Env validation (`pnpm validate:env`) fails when:
  - `APP_ENV=production` but `NODE_ENV` is not `production`.
  - Non‑prod env uses production Supabase or booking API values matching `PRODUCTION_*` vars.
  - Production targets are missing `NEXT_PUBLIC_POSTHOG_KEY` or `NEXT_PUBLIC_POSTHOG_HOST`.
- Override (not recommended): `ALLOW_PROD_RESOURCES_IN_NONPROD=true`.

### Retired variables

- `GUEST_LOOKUP_PEPPER` and `SESSION_RECOVERY_ACCESS_TOKEN_TTL_SECONDS` are no longer read or
  validated (the contact-scoped recovery token and guest lookup were removed; see
  `docs/security.md`). A leftover value is ignored. Remove them from hosting environments at the
  next secret rotation. `SESSION_RECOVERY_ACCESS_TOKEN_SECRET` is still used.

## Staging quick start

- Local/dev: set `APP_ENV=staging`, `NODE_ENV=development`, `DB_TARGET_ENV=staging`, and point Supabase URL/keys at the shared staging project.
- Deploy previews / CI smoke: set `APP_ENV=staging`, `NODE_ENV=production`, and inject the same staging Supabase URL + keys via the hosting provider.
- Keep `ALLOW_PROD_RESOURCES_IN_NONPROD=false` so validation blocks accidental production URLs/keys.
- Never commit real keys; populate `.env.local` (git ignored) or managed secrets only.

### Production markers (placeholders in `.env.example`)

- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_ANON_KEY`
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`
- `PRODUCTION_BOOKING_API_BASE_URL`

## Database scripts

- `pnpm db:status` lists remote migration status.
- `pnpm db:migrate` and `pnpm db:push` apply pending migrations.
- `pnpm db:pull` pulls the linked remote schema.
- `pnpm db:check-drift` compares the linked remote schema with the repository baseline.
- Every workflow runs through `scripts/db/safe-run.ts` and validates the environment first.
- Set `DB_TARGET_ENV=staging|production`; production migration apply also requires
  `CONFIRM_PRODUCTION=true`.
- Production historical replay with `--include-all` additionally requires
  `CONFIRM_PRODUCTION_INCLUDE_ALL=20260811160000`. This confirmation is narrowly scoped to the
  reviewed GBP lineage migration that predates the latest production migration.
- Append `-- --dry-run` to preview the fixed, redacted command plan without running children.
- Local reset, seed, full-reset, and wipe workflows are intentionally unsupported.

## Checklist for new env files

- Copy `.env.example` → `.env.local`.
- Fill **non-production** Supabase URL/keys and booking API URLs (staging by default).
- Set `APP_ENV=development|staging` for local/staging; `NODE_ENV` should remain `development` for local runs (deploy previews may use `NODE_ENV=production`).

## Secret rotation & history cleanup

> Run these steps inside a scheduled maintenance window. Never paste secrets into task artifacts or git history.

1. **Inventory secrets**
   - Supabase: anon key, service role key, DB password, JWT secret, connection string.
   - Resend: API key(s) per environment.
   - Any other third-party keys referenced in `.env.example`.
2. **Rotate in staging first**
   - Generate new values via provider dashboards.
   - Update staging hosting/CI secrets and `.env.staging`.
   - Run `pnpm validate:env`, smoke tests, and staging health checks.
3. **Promote to production**
   - Set `APP_ENV=production`, `NODE_ENV=production` in hosting provider.
   - Update production secrets and verify health.
4. **Update repository configuration**
   - Refresh `.env.example` placeholders (never real secrets).
   - Record non-secret rotation metadata in the provider or incident-management system.
5. **Purge leaked secrets from git history**
   - `brew install git-filter-repo` (or use BFG).
   - `git filter-repo --path .env.local --invert-paths` or target individual files containing leaked values.
   - Force-push and notify collaborators to `git fetch --all --prune` + `git reset --hard origin/<branch>`.
6. **Re-run validation**
   - `pnpm validate:env`
   - `pnpm db:status`

If any provider restricts immediate rotation, record the exception in the provider or incident-management system and schedule a follow-up.

## Staging (separate deployment target)

Full runbook: `docs/runbooks/staging-release.md`. Staging is a distinct target that must never share an identity with production; `pnpm deploy:validate-separation --env staging` proves it before every staging deploy and fails closed on any inherited id, production host or `REPLACE_ME_*` placeholder.

- Hosts: `https://nabatable-staging.vercel.app` (public) and `https://nabatable-staging-ops.vercel.app` (ops); only `staging*.nabatable.com` subdomains are tolerated on the apex domain, everything else is production.
- Supabase project: `ndxmivcrehsacuerwxtm` (staging); `vrdiqfudmwydclqpydee` is production and is refused by every staging tool.
- Workers: `nabatable-booking-short-links-staging`, `nabatable-email-queue-gateway-staging`, `nabatable-sms-summary-gateway-staging`, `nabatable-operational-control-staging` (the `env.staging` blocks in each `wrangler.jsonc`; D1/KV ids are `REPLACE_ME_STAGING_*` until provisioned).
- Delivery kill switches: `DELIVERY_MODE=sink` on the staging SMS gateway (no Twilio/WhatsApp sends), `RESEND_USE_MOCK=true` on the staging Vercel project, GBP publishing flag off.
- Inputs for `pnpm e2e:staging`: `STAGING_PUBLIC_URL`, `STAGING_OPS_URL`, `MONITORING_TOKEN`, `NABATABLE_SOURCE_REVISION`, `STAGING_SYNTHETIC_TENANT_ID`, `STAGING_SYNTHETIC_TENANT_SLUG`, `STAGING_SYNTHETIC_TENANT_B_ID`, `STAGING_SYNTHETIC_TENANT_B_SLUG`, `STAGING_SYNTHETIC_GUEST_EMAIL` (reserved test domain only), `STAGING_SYNTHETIC_GUEST_PHONE`. The config throws at load time on any production host.
- Deploy inputs: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, optional `VERCEL_AUTOMATION_BYPASS_SECRET` (readiness header only), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STAGING_LOCK_GITHUB_TOKEN` (writes the `STAGING_DEPLOY_LOCK` repository variable), `WORKER_URL_<WORKER>` overrides for Workers without a public base URL var (`WORKER_URL_EMAIL_QUEUE_GATEWAY`, `WORKER_URL_OPERATIONAL_CONTROL`).

## Runtime identity and readiness

- `NABATABLE_SOURCE_REVISION` — immutable source SHA (7–64 hex) baked at build; `/api/ready` and Worker `/ready` report it and deploy scripts compare it with the candidate SHA. Web falls back to `VERCEL_GIT_COMMIT_SHA`, Workers to `DEPLOY_SHA` / `CF_VERSION_METADATA.id` until it is baked.
- `NABATABLE_BUILD_ID` — provider deployment id baked at build (Vercel `dpl_*`, Worker version id).
- `MONITORING_TOKEN` — bearer token (>= 32 chars) for the read-only readiness endpoints. Set on Vercel (`/api/ready`), as a Wrangler **secret** (never a var) on all four Workers (`/ready`), in the GitHub `Monitoring` environment, and in the UptimeRobot custom headers. Endpoints answer a generic `401` until it is configured.
- Monitoring-environment-only inputs for `pnpm ops:verify`: `MONITORING_GITHUB_TOKEN` (fine-grained, this repository only, `actions:read` + `administration:read`), `MONITORING_HEARTBEAT_URL` (UptimeRobot heartbeat; sent only after a fully valid cycle), `MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL` (required https origin; the email gateway has no committed hostname), optional `MONITORING_WEB_BASE_URL`, `MONITORING_BOOKING_SHORT_LINKS_BASE_URL`, `MONITORING_SMS_SUMMARY_GATEWAY_BASE_URL`.

## Operational control Worker (`cloudflare/operational-control`)

Runbook: `cloudflare/operational-control/README.md`. Secrets, set per environment with `wrangler secret put <NAME> --env <env>`: `GITHUB_WEBHOOK_SECRET` (16+ chars), `GITHUB_DISPATCH_APP_ID`, `GITHUB_DISPATCH_APP_PRIVATE_KEY` (PKCS#8), `GITHUB_DISPATCH_INSTALLATION_ID`, `HEARTBEAT_TOKEN` (shared only with the Mac controller), `MONITORING_TOKEN`, `INCIDENT_ACKNOWLEDGEMENT_TOKEN` (dedicated incident-operator bearer; never shared with readiness monitors), `UPTIME_HEARTBEAT_URL`. Vars in `wrangler.jsonc`: `REPOSITORY_ID`, `LOCAL_CI_APP_ID`, `GATE_WORKFLOW_ID`, `FALLBACK_WORKFLOW_ID`, `SCHEDULED_VALIDATION_WORKFLOW_ID`, `PROTECTED_REF`, `TARGETS_JSON`. Any `REPLACE_ME_*` / `replace-me-*` value is rejected as unconfigured (the Worker answers `503` and never dispatches).

## Local CI (Mac controller and executor)

Runbooks: `docs/runbooks/local-ci.md`, `scripts/ci/controller/README.md`. Non-secret configuration lives in `~/nabatable-ci/config/controller.env` on the CI Mac; secrets live only in the `nabatable-ci` login Keychain (App private key `nabatable-ci/github-app/nabatable-local-ci/private-key`, heartbeat token `nabatable-ci/monitoring/heartbeat-token`, R2 evidence key pair `nabatable-ci/r2/evidence/*`). No production or staging credential ever exists on that machine.

Controller: `NABATABLE_CI_GITHUB_APP_ID`, `NABATABLE_CI_GITHUB_APP_INSTALLATION_ID`, `NABATABLE_CI_GITHUB_REPOSITORY_ID`, `NABATABLE_CI_GITHUB_REPOSITORY`, `NABATABLE_CI_HEARTBEAT_URL`, `NABATABLE_CI_JOB_IMAGE` (digest-pinned), `NABATABLE_CI_JOB_IMAGE_DIGEST`, optional `NABATABLE_CI_POLICY_VERSION` (must equal `scripts/ci/profiles/catalog.ts`), `NABATABLE_CI_KEYCHAIN_ACCOUNT`; the aliases accepted by `scripts/ci/controller/main.ts` must agree when both are set.

Executor: `NABATABLE_CI_REPOSITORY_ID`, `NABATABLE_CI_SOURCE_REMOTE_URL` (https, no credentials), `NABATABLE_CI_SPOOL_ROOT`, `NABATABLE_CI_JOB_ROOT`, `NABATABLE_CI_BASE_IMAGE_PATH` + `NABATABLE_CI_BASE_IMAGE_DIGEST` (pre-provisioned Lima golden image, sha256), `NABATABLE_CI_JOB_IMAGE` or `NABATABLE_CI_JOB_IMAGE_NAME` + `NABATABLE_CI_JOB_IMAGE_DIGEST` (the tuple `imageDigest` must equal it), `NABATABLE_CI_R2_ENDPOINT`, `NABATABLE_CI_R2_BUCKET`, `NABATABLE_CI_R2_KEY_PREFIX` (default `ci-evidence/ttl-14d`), `NABATABLE_CI_R2_ACCESS_KEY_ID` / `NABATABLE_CI_R2_SECRET_ACCESS_KEY` (or the Keychain items named in `infra/local-ci/operating.json`), optional `NABATABLE_CI_EXECUTOR_CONFIG`, `NABATABLE_CI_OPERATING_FACTS` (default `infra/local-ci/operating.json`), `NABATABLE_CI_EGRESS_PROXY_URL`, `NABATABLE_CI_LIMA_*` sizing. The controller passes `NABATABLE_CI_CONTROL_FILE` and `NABATABLE_CI_ALLOCATION_FILE` as side-channel files. Placeholders (`REPLACE_ME_*`, `<...>`, zero digests) are reported as unconfigured and refuse a real run; `--dry-run` still prints the plan.

Jobs themselves see only a sanitized environment (`APP_ENV=test`, `CI=true`, `TZ=UTC`, `QA_TARGET_ENV=ci-ephemeral`, `test-*` dummies for every credential-shaped key).

## Database promotion safety

Reference: `docs/DATABASE_MIGRATIONS.md` (Promotion safety workflows). Inputs: `DB_BACKUP_ROLE_URL` (dedicated read-only backup role whose name contains `backup`; `postgres`, `service_role` and pooler users are refused; must not reuse `SUPABASE_DB_PASSWORD`), `DB_BACKUP_BUCKET` (lowercase bucket name), `RESTORE_VERIFY_PROJECT_REF` (scratch project only; `ndxmivcrehsacuerwxtm` and `vrdiqfudmwydclqpydee` are refused), `RESTORE_VERIFY_BACKUP_ID`, `RESTORE_VERIFY_DB_URL` (must address the scratch ref), `DB_DRIFT_SCOPE` (`public|extended`; `extended` is the safe-run default and needs `SUPABASE_DB_URL` plus the committed `config/db/schema-inventory.json`), `DB_DRIFT_RECORD_INVENTORY=true` (staging only, records the baseline), `DB_MIGRATION_CHECKSUMS_PATH` (test override). `DB_TARGET_ENV=staging|production` names the backup source for `pnpm db:restore-verify`; the destination can never be staging or production.

## Backup and recovery environments

Runbook: `docs/runbooks/recovery.md`. GitHub environment `Backup` (`backup.yml`): `DB_BACKUP_ROLE_URL`, `BACKUP_ENCRYPTION_KEY` (32 bytes hex; escrow offline), `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_WRITE_ACCESS_KEY_ID` / `BACKUP_S3_WRITE_SECRET_ACCESS_KEY`, `STORAGE_BACKUP_API_URL` / `STORAGE_BACKUP_TOKEN`; variable `DB_BACKUP_BUCKET`. Environment `Recovery` (`recovery-drill.yml`): `RECOVERY_DRILL_PROJECT_REF`, `RESTORE_VERIFY_DB_URL`, `RECOVERY_SUPABASE_MANAGEMENT_TOKEN` (exposed to the drill as `SUPABASE_MANAGEMENT_TOKEN`), `RECOVERY_EVIDENCE_HMAC_KEY`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_S3_DRILL_*` read credentials; variable `RESTORE_PROJECT_REF_DENYLIST`. `Production` additionally holds `RECOVERY_EVIDENCE_HMAC_KEY` and read-only `BACKUP_S3_READ_*` so `pnpm recovery:evidence:check` can verify drill evidence before delivery. Queue reconciliation uses `QUEUE_RECONCILE_SUPABASE_URL/KEY`, `QUEUE_RECONCILE_TWILIO_*` (read scope) and `QUEUE_RECONCILE_GATEWAY_URL/TOKEN`. The backup bucket is separate from the CI evidence bucket.

## GitHub environments

`Staging`, `Production` (2 required reviewers), `CI fallback` (1 required reviewer), `Monitoring`, `Backup`, `Recovery`. Names and per-environment secret lists are in `docs/ci/governance.md`; environment protection for a private repository requires GitHub Enterprise, so fallback evidence and automated delivery are untrusted until that is in place.
