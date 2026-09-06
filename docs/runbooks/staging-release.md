# Staging release runbook

Operating guide for the separated staging environment and the promotion path to
production. Code lives under `scripts/deploy/**` and `scripts/release/**`; the
staging browser proofs live under `tests/e2e/staging/**` and run through
`playwright.staging.config.ts`. Every step writes JSON evidence under
`test-results/deploy/` or `test-results/release/` (git-ignored) and the next
step refuses to run unless the previous evidence is present, fresh and for the
same target.

## Topology

| Surface             | Production                                                   | Staging                                                           |
| ------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Public web          | `https://nabatable.com`                                      | `https://nabatable-staging.vercel.app`                            |
| Ops web             | `https://app.nabatable.com`                                  | `https://nabatable-staging-ops.vercel.app`                        |
| Vercel target       | `--prod`                                                     | `--target=staging` (Vercel custom environment named `staging`)    |
| Supabase project    | `vrdiqfudmwydclqpydee`                                       | `ndxmivcrehsacuerwxtm`                                            |
| Booking short links | `nabatable-booking-short-links` (top-level `wrangler.jsonc`) | `nabatable-booking-short-links-staging` (`env.staging`)           |
| Email queue gateway | `nabatable-email-queue-gateway`                              | `nabatable-email-queue-gateway-staging`                           |
| SMS summary gateway | `nabatable-sms-summary-gateway`                              | `nabatable-sms-summary-gateway-staging` with `DELIVERY_MODE=sink` |
| GitHub environment  | `Production`                                                 | `Staging`                                                         |

Wrangler does not inherit bindings or `vars` into named environments, so every
staging value is restated under `env.staging` in each `cloudflare/*/wrangler.jsonc`.
Values that are still `REPLACE_ME_*` are placeholders: `pnpm deploy:validate-separation --env staging`
rejects them, and `pnpm deploy:workers --env staging` refuses to run without a
passing separation report.

### Guest delivery and publication in staging

- SMS summary gateway: `DELIVERY_MODE=sink` in `env.staging.vars` makes
  `sendDailySummaryViaTwilio` / `sendDailySummaryViaWhatsApp`
  (`cloudflare/sms-summary-gateway/src/job.ts`) return `messageSid: null` without
  calling Twilio, even if Twilio secrets are present.
- Email queue gateway: the Worker never sends mail itself; it POSTs to
  `APP_PROCESS_EMAILS_URL` on the staging ops host. The staging Next.js project
  must run with `RESEND_USE_MOCK=true` so no guest email leaves staging.
- Booking short links: `ALLOWED_DESTINATION_HOSTS` in staging lists only the two
  staging Vercel aliases, so a link to a production host is rejected with 400.
- Google Business Profile publication is governed by the app's own GBP write
  guard (not part of this workstream); staging must keep the GBP publish flag off.

## Provisioning checklist (one-time, outside the repository)

Record the real values in the places below; the validator fails closed until then.

1. Cloudflare: create the staging D1 database and KV namespace (+ preview) for
   short links and record `database_id`, `id`, `preview_id` in
   `cloudflare/booking-short-links/wrangler.jsonc` `env.staging`. Replace
   `REPLACE_ME_STAGING_WORKERS_SUBDOMAIN` in both Worker public URLs.
2. Cloudflare queues: `nabatable-sms-daily-summary-staging` and
   `nabatable-sms-daily-summary-staging-dlq` (names are already in the config).
3. Worker secrets per environment with `wrangler secret put <NAME> --env staging`
   from `cloudflare/<worker>`: `MONITORING_TOKEN`, `INTERNAL_LINKS_TOKEN`,
   `GATEWAY_TOKEN`, `APP_PROCESS_EMAILS_URL`, `APP_PROCESS_EMAILS_TOKEN`,
   `INTERNAL_TRIGGER_TOKEN`, staging Supabase URL/service key, Twilio **test**
   credentials. Never paste production secrets into a staging environment.
4. Vercel: a custom environment named `staging` with its own env vars
   (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, staging Supabase keys,
   `MONITORING_TOKEN`, `RESEND_USE_MOCK=true`) and the two staging aliases.
   The verified project ids are recorded in `scripts/deploy/environments.ts`.
5. GitHub: environments `Staging` and `Production`; the repository variable
   `STAGING_DEPLOY_LOCK` is created on first `deploy:staging-lock acquire`.
   Readiness origins for the two Workers without a public base URL `var` in
   `wrangler.jsonc` are repository variables that `deploy.yml` maps onto the
   `WORKER_URL_<WORKER>` inputs of `deploy:workers`:

   | Repository variable                  | Job        | Mapped to                        |
   | ------------------------------------ | ---------- | -------------------------------- |
   | `STAGING_OPERATIONAL_CONTROL_URL`    | staging    | `WORKER_URL_OPERATIONAL_CONTROL` |
   | `STAGING_EMAIL_QUEUE_GATEWAY_URL`    | staging    | `WORKER_URL_EMAIL_QUEUE_GATEWAY` |
   | `PRODUCTION_OPERATIONAL_CONTROL_URL` | production | `WORKER_URL_OPERATIONAL_CONTROL` |
   | `PRODUCTION_EMAIL_QUEUE_GATEWAY_URL` | production | `WORKER_URL_EMAIL_QUEUE_GATEWAY` |

   Each value is the Worker origin (`https://<name>.<subdomain>.workers.dev`,
   no path). `deploy:workers` refuses that Worker when the variable is unset
   or still `REPLACE_ME_*`; `booking-short-links` and `sms-summary-gateway`
   read their origin from `SHORT_LINKS_PUBLIC_BASE_URL` /
   `SMS_SUMMARY_GATEWAY_PUBLIC_URL` in the wrangler config instead.

6. Synthetic tenants in the staging Supabase project: two restaurants owned by
   the platform team, with guest contacts on reserved test domains only.

## Provisioning record (2026-09-05)

Verified in Cloudflare account `9b153af11227b03e23dea343d5fc232f`:

| Staging resource                                | Provider identifier                    |
| ----------------------------------------------- | -------------------------------------- |
| `nabatable-booking-short-links-staging` D1      | `1d6fbc04-eb7f-48f5-a673-bb3420d39347` |
| `BOOKING_SHORT_LINKS_CACHE_staging` KV          | `a4a50885b0fc47bc928fe602c53e4287`     |
| `BOOKING_SHORT_LINKS_CACHE_staging_preview` KV  | `5d3db9428e7d4a7ebad8557ae3de184b`     |
| `nabatable-sms-daily-summary-staging` queue     | `35972083eaaf4ab892d0a7d6f9010190`     |
| `nabatable-sms-daily-summary-staging-dlq` queue | `f8a2935814ab43b58a943fa281d4e38e`     |
| Worker account subdomain                        | `amanshresthaaaaa.workers.dev`         |

All four staging and production Workers were deployed and their authenticated readiness
verified on 2026-09-05. The D1 migration and queue bindings are applied.

Vercel staging uses project `prj_Tcr3HKMSJLo66DXNh5nUc8ggIUrl`, separate from
production `prj_nz9GF5uWIsfmilFeIuyMIYzfPx3s`. Its custom environment is
`env_wFNfYzdHzzgxeKNHnxXGv8LtdRNn` (`staging`); both documented staging domains
are verified and attached to it. The project setting is Node 22; the existing
`engines.node >=22.0.0` range makes Vercel select Node 24 for deployment, as it does
in production. No engine or hosted CI runtime policy was changed. Its environment contains
only staging Supabase credentials and Worker tokens, with `RESEND_USE_MOCK=true`
and `GBP_WRITE_ROLLOUT_MODE=off`. Provisioned configuration alone does not prove
a deployed web journey; retain the deployment and browser evidence separately.

The three production customer Workers are connected to `lapeninns/nabatable`
through Cloudflare Workers Builds. Each build command runs its package-specific
`verify` script, for example `pnpm --filter @nabatable/email-queue-gateway verify`.
Each deploy command runs `deploy:validate-separation --env production --workers-only` before
`deploy:workers --env production --worker <name>`, passing the checked-out Git
revision and the corresponding Worker origin. Non-production branch builds are disabled.
The provider stores its deployment token. This connection does not establish
release readiness: monitoring secrets, runtime provisioning and staging evidence
must be supplied before deployment can pass.

## Commands

All commands are `pnpm` scripts registered in the root `package.json`. Nothing
here reads `.env*` files; pass configuration through the environment of the job.

| Command                                                                                                     | Purpose                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm deploy:validate-separation --env X`                                                                   | Compares every id/name/url between `env.staging` and top-level production in all three `wrangler.jsonc`, `vercel.json` and the environment descriptors; fails on equality, `REPLACE_ME`, or a production host in staging. Writes `test-results/deploy/separation-<env>.json`.                |
| `pnpm deploy:staging-lock acquire\|release\|status --owner <name> --tuple-file <path> [--ttl-seconds 1800]` | Lock held by (owner, CI tuple) in the `STAGING_DEPLOY_LOCK` repository variable; a different tuple cannot acquire or release while the lock is live. Needs `GITHUB_REPOSITORY` and `GITHUB_TOKEN`.                                                                                           |
| `pnpm deploy:vercel:prebuilt --env X`                                                                       | `vercel pull` + `vercel build` + `vercel deploy --prebuilt --skip-domain`, then verifies `GET <deployment>/api/ready` with `MONITORING_TOKEN` reports `NABATABLE_SOURCE_REVISION`. Writes `test-results/deploy/vercel-<env>.json`. `--dry-run` prints the plan.                              |
| `pnpm deploy:vercel:promote`                                                                                | `vercel promote <deploymentId> --yes` only when `vercel-production.json` says `target: production`, `verified: true` and the readiness revision matches. Staging evidence is refused.                                                                                                        |
| `pnpm deploy:workers --env X --worker <name>`                                                               | `wrangler versions upload` + `wrangler versions deploy <id>@100%` (falls back to `wrangler deploy`), bakes `DEPLOY_SHA`/`NABATABLE_SOURCE_REVISION`, verifies `/ready`, records the previous version id and the rollback command. Refuses without fresh separation evidence for that target. |
| `pnpm e2e:staging`                                                                                          | Staging proof pack (`playwright.staging.config.ts`): no webServer, no mocks, retries 0, workers 1.                                                                                                                                                                                           |
| `pnpm release:manifest`                                                                                     | Content-addressed manifest `{sourceSha, lockfileSha256, migrationsTreeSha256, buildManifest, providerVersions, nodeVersion, pnpmVersion, policyVersion}` to `test-results/release/manifest.json`.                                                                                            |
| `pnpm release:sbom`                                                                                         | CycloneDX 1.5 SBOM from `pnpm-lock.yaml` (root + Cloudflare workspaces, no network) to `test-results/release/sbom.cdx.json`.                                                                                                                                                                 |

### Provider CLIs

`vercel` and `supabase` are not workspace dependencies (`wrangler` is). The
exact versions the delivery workflow installs live in
`scripts/deploy/provider-clis.json`; `deploy.yml` reads them, installs the
Supabase CLI through `supabase/setup-cli` (pinned by commit SHA) and the Vercel
CLI through `npm install -g vercel@<version>`, then runs
`pnpm exec tsx scripts/deploy/provider-clis.ts vercel supabase`, which fails
unless `<cli> --version` reports the pinned version. `deploy:vercel:prebuilt`
and `deploy:vercel:promote` run the same check before their first `vercel`
call, and a CLI that is missing from `PATH` is reported as
`<cli>: command not found on PATH` instead of a misleading provider failure.
Bump a pin and the `setup-cli` SHA together in one reviewed change.

The shell wrappers under `scripts/cloudflare/deploy-*.sh` accept
`--env staging|production`; `--hosted` delegates to `deploy:workers` and
`--interactive` wraps wrangler in a pseudo-terminal on macOS and Linux.

## Staging release flow

```
NABATABLE_SOURCE_REVISION=$(git rev-parse HEAD)      # the immutable source SHA under test
pnpm deploy:validate-separation --env staging       # must exit 0
pnpm deploy:staging-lock acquire --owner "release-gate" --tuple-file ci-request.json
pnpm deploy:vercel:prebuilt --env staging           # evidence: test-results/deploy/vercel-staging.json
for w in booking-short-links email-queue-gateway sms-summary-gateway; do
  pnpm deploy:workers --env staging --worker "$w" --url "<staging worker origin>"
done
STAGING_PUBLIC_URL=https://nabatable-staging.vercel.app \
STAGING_OPS_URL=https://nabatable-staging-ops.vercel.app \
MONITORING_TOKEN=... STAGING_SYNTHETIC_TENANT_ID=... STAGING_SYNTHETIC_TENANT_SLUG=... \
STAGING_SYNTHETIC_TENANT_B_ID=... STAGING_SYNTHETIC_TENANT_B_SLUG=... \
STAGING_SYNTHETIC_GUEST_EMAIL=guest@example.com STAGING_SYNTHETIC_GUEST_PHONE=+447700900000 \
pnpm e2e:staging
pnpm release:manifest --policy-version <policyVersion>
pnpm release:sbom
pnpm deploy:staging-lock release --owner "release-gate" --tuple-file ci-request.json
```

`playwright.staging.config.ts` throws at load when `STAGING_PUBLIC_URL` or
`STAGING_OPS_URL` names a production host (`nabatable.com`, `www.`, `app.`,
`go.`, any non-`staging*` subdomain, `nabatable.vercel.app`) or when any
required `MONITORING_TOKEN` / `STAGING_SYNTHETIC_*` input is missing. Optional
inputs (`STAGING_SHORT_LINKS_URL`, `STAGING_EMAIL_GATEWAY_URL`,
`STAGING_SMS_GATEWAY_URL`, internal tokens, `STAGING_SUPABASE_URL` +
`STAGING_SUPABASE_ANON_KEY`, `STAGING_TWILIO_AUTH_TOKEN`) unlock the Worker,
RPC and signature proofs; specs skip with the missing name when absent.

### Proofs and their status

| Proof                                                       | Spec                       | Status                                             |
| ----------------------------------------------------------- | -------------------------- | -------------------------------------------------- |
| Guest booking creation + idempotent duplicate handling      | `guest-booking.spec.ts`    | live                                               |
| Malformed body / unknown tenant safe errors, no PII echo    | `guest-booking.spec.ts`    | live                                               |
| Holds / capacity contention / assignment / terminal states  | `guest-booking.spec.ts`    | `test.fixme` (needs hold fixture + ops auth relay) |
| Cross-tenant denial, recovery-token lookup, anon RPC denial | `tenant-isolation.spec.ts` | live (RPC part needs `STAGING_SUPABASE_*`)         |
| Authenticated tenant B denied tenant A data                 | `tenant-isolation.spec.ts` | `test.fixme` (needs staging ops session)           |
| Invalid Twilio / Resend signatures rejected                 | `webhooks.spec.ts`         | live                                               |
| Valid Twilio signature accepted, replay idempotent          | `webhooks.spec.ts`         | live with `STAGING_TWILIO_AUTH_TOKEN`              |
| Terminal delivery-state monotonicity                        | `webhooks.spec.ts`         | `test.fixme` (needs delivery-log read access)      |
| Email/SMS/WhatsApp retry, idempotency, DLQ via sinks        | `delivery-sinks.spec.ts`   | auth proofs live; sink observation `test.fixme`    |
| Short-link persistence and staging-only destinations        | `short-links.spec.ts`      | live with `STAGING_SHORT_LINKS_*`                  |
| Public/ops host separation                                  | `host-separation.spec.ts`  | live                                               |
| Exact revision + authenticated readiness (web and Workers)  | `readiness.spec.ts`        | live                                               |

## Production promotion flow

```
pnpm deploy:validate-separation --env production
pnpm deploy:vercel:prebuilt --env production        # --skip-domain: deployed but not aliased
# gate: release-gate.yml must be green for NABATABLE_SOURCE_REVISION
pnpm deploy:vercel:promote                           # refuses unless evidence.target === "production"
for w in booking-short-links email-queue-gateway sms-summary-gateway; do
  pnpm deploy:workers --env production --worker "$w"
done
```

## Rollback

- Vercel: `npx vercel rollback` (or `vercel promote <previous dpl_id> --yes`);
  the previous deployment id is in the prior `vercel-promotion.json`.
- Workers: the `rollbackCommand` recorded in
  `test-results/deploy/worker-<name>-<env>.json`, e.g.
  `wrangler rollback <previousVersionId> --config cloudflare/<worker>/wrangler.jsonc --env staging --yes`,
  or `bash scripts/cloudflare/rollback-email-gateway.sh <version-id> --env staging`.
- Staging lock: `pnpm deploy:staging-lock release` with the same owner and tuple;
  an expired lock is treated as free.

## Runtime note

Hosted workflows run Node 22 (`activeRuntime: node22`); production Vercel runs
Node 24 (`candidateRuntime: node24`). Deployment and release evidence records
both until the CI profiles are qualified on Node 24.

### Worker-only releases

Use `pnpm deploy:validate-separation --env staging --workers-only` (or `--env production`) when releasing only Cloudflare Workers. This checks every Worker, including operational control, and rejects shared storage, production hosts in staging, placeholders, and production process identities. It does not require a Vercel project. Full-stack releases must continue using the default validation command, which also checks Vercel configuration and project separation.

GitHub repository, CI App and workflow numeric IDs may be shared between environments only in operational-control. They identify the common source repository and trusted workflows; R2 buckets, Worker names, readiness targets and storage remain separate. The scheduled validation ID is the registered `operational-verification.yml` workflow. Operational control is configured to expose its signed-webhook and bearer-authenticated endpoints through its workers.dev hostname; it carries no guest traffic.

Worker version deployments apply routes and cron schedules with `wrangler triggers deploy` before readiness verification. Rollback evidence records the version from the latest active deployment, including when production was rolled back to an older upload.

For the owner-authorized 2026-09-05 Worker release, the existing developer-machine Cloudflare login may run provisioning and deployment scripts, staging first and then production after verification. This is a one-time exception; credentials remain outside source files, logs and the CI runtime. Production operational evidence uses `nabatable-operational-evidence`, separate from the local CI credential scope (`nabatable-ci-evidence`); staging uses `nabatable-ci-evidence-staging`.

For a Worker that does not yet exist, the helper recognizes Wrangler’s explicit first-deploy response and initializes it with `wrangler deploy`, retaining the same separation, secret handling, source-revision and readiness requirements. Other upload failures remain fatal.
