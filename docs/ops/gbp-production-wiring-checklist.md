# GBP Production Wiring Checklist

This checklist is for staging-first verification. Do not paste secret values into task artifacts; record only presence, target name, timestamps, command names, and non-sensitive readback.

## Before Any Production Claim

- Confirm the target environment: staging first, production only after staging evidence is complete.
- Confirm the branch/deploy SHA that contains the GBP route, dual-sync, and migration changes.
- Confirm the app host and root host routing split still sends ops settings traffic to the app host.
- Confirm all checks are read-only until a named write test is explicitly approved.

## Environment Variables

Record presence only, not values.

| Variable family                                                                                                                                                                                   | Expected source behavior                                                               | Check                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                                                                                                                             | Required in production schema and used as trusted app-origin fallback.                 | Present and points to the deployed app host.                                                    |
| `NEXT_PUBLIC_ROOT_DOMAIN`                                                                                                                                                                         | Used by proxy/origin hardening and app/root host split.                                | Present and matches the public root domain.                                                     |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                                                                                          | Required app database access.                                                          | Present for the target Supabase project.                                                        |
| `CRON_SECRET` or `CRON_SECRETS`                                                                                                                                                                   | Required by cron auth.                                                                 | Present; previous secret rotation state recorded if relevant.                                   |
| `GOOGLE_BUSINESS_CLIENT_ID` or `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`                                                                                                                                | Required for Google OAuth.                                                             | Present in the target deployment.                                                               |
| `GOOGLE_BUSINESS_CLIENT_SECRET` or `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`                                                                                                                        | Required for Google OAuth.                                                             | Present in the target deployment.                                                               |
| `GOOGLE_BUSINESS_REDIRECT_URI` or `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`                                                                                                                          | Required for Google OAuth callback.                                                    | Present and matches the Google Cloud OAuth client allowlist.                                    |
| `GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY` or `GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY`                                                                                                          | Required for encrypted credential storage.                                             | Present and rotation plan known.                                                                |
| `GOOGLE_CLOUD_QUOTA_PROJECT`                                                                                                                                                                      | Optional quota project for Google requests.                                            | Present if quota/accounting requires it.                                                        |
| `DUAL_SYNC_FAILURE_WEBHOOK_URL`                                                                                                                                                                   | Optional operational alert webhook; schema requires `https://` when set.               | Present only if alert delivery is configured.                                                   |
| `GBP_IMPORT_ENABLED`, `GBP_EXPORT_ENABLED`, `GBP_HIGH_RISK_EXPORTS_ENABLED`, `GBP_MENU_SYNC_ENABLED`, `GBP_ATTRIBUTES_SYNC_ENABLED`, `GBP_SCHEDULED_REFRESH_ENABLED`, `GBP_PUBSUB_INGEST_ENABLED` | Defaults are false and must be explicitly enabled only after their release gates pass. | Record presence and explicit boolean target value.                                              |
| `GBP_AUTO_CANDIDATES_ENABLED`                                                                                                                                                                     | Defaults true; it must be explicitly set false for a full rollback.                    | Record explicit target value; omission is not rollback evidence.                                |
| `GBP_WRITE_ROLLOUT_MODE`, `GBP_CANARY_RESTAURANT_ID`                                                                                                                                              | Write rollout defaults to `off`; `canary` requires a restaurant UUID.                  | Record mode and UUID presence only, plus external readback of the two database rollout records. |
| `GBP_PUBSUB_EXPECTED_AUDIENCE`, `GBP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL`, `GBP_PUBSUB_SUBSCRIPTION`, `GBP_PUBSUB_TOPIC`                                                                            | All are required when Pub/Sub ingestion is enabled.                                    | Record resource names/presence, never values that could be credentials.                         |

## Google Cloud Console

- OAuth app has the `business.manage` scope.
- Authorized redirect URI matches the deployed callback URI for `/api/ops/google-business-profile/callback`.
- Legacy per-restaurant callback URI is retained only if compatibility traffic requires it.
- OAuth consent screen is in the correct publication state for the target environment.
- Venue/operator Google account access is confirmed before staging connect tests.

## Supabase Remote Readback

Staging readback must happen before production.

- `restaurant_external_profiles` includes GBP connection columns for provider/account/location state.
- GBP credential storage and OAuth state tables exist and have expected indexes/policies.
- GBP workflow, draft, publish job, FoodMenus snapshot, dual-sync snapshot, lock, queue, operation, request-log, archive, control, and observability tables exist.
- RLS policies and service-role usage match the route/service boundaries.
- No destructive migration or data cleanup is run without a separate approved rollout note.

## Vercel Cron And Scheduler

Source `vercel.json` lists:

- `/api/cron/dual-sync/auto-export` every 30 minutes.
- `/api/cron/dual-sync/queue` every 5 minutes.
- `/api/cron/dual-sync/core-outbox` every 5 minutes.
- `/api/cron/dual-sync/health` hourly.
- `/api/cron/dual-sync/refresh` every 15 minutes.
- `/api/cron/dual-sync/notifications` every 15 minutes.
- `/api/cron/dual-sync/request-log-retention` daily at 02:30 UTC.

Live target verification must prove:

- The deployed scheduler contains all seven paths and schedules above.
- Each path receives `Authorization: Bearer <cron secret>` from the scheduler.
- `dryRun=1` checks succeed before any non-dry-run invocation.
- Queue drains start with a low `maxJobs` cap after dry-run proof.

## Pub/Sub Setup and Readback

Do not enable ingress based only on an environment-variable presence check. Capture one
metadata-only external artifact for each of these setup/readback gates:

- The GBP notification topic exists and its project/topic resource name matches
  `GBP_PUBSUB_TOPIC`.
- The subscription exists and reports its push endpoint, OIDC audience, and configured push
  service account; the endpoint must be
  `/api/webhooks/google-business-profile/pubsub` on the intended deployed host.
- A dead-letter topic and subscription exist, with a bounded max delivery attempt policy and a
  named operator owner for review/replay.
- IAM readback proves the provider publisher can publish to the primary topic, the Pub/Sub
  service agent can publish to the dead-letter topic, and the configured push identity has the
  minimal token-creation permission needed by the subscription. Do not export service-account
  keys.
- A staging signed push is accepted exactly once and an invalid signer/audience is rejected;
  retain only receipt/queue counts and artifact digest.

## Canary and Exact-Grant Readback

Before a production canary, retain four separate artifacts: deployment configuration,
`gbp_write_rollout_config_v1` readback, `gbp_write_canary_restaurants_v1` readback, and a
count-only `gbp_write_grants_v1`/terminal-state census. Canary has two exact remote grants:
one global rollout-mode record set to `canary`, and one enabled record for the named canary
restaurant. The deployment `GBP_WRITE_ROLLOUT_MODE=canary` plus matching
`GBP_CANARY_RESTAURANT_ID` are a separate configuration gate.

At restoration, set the deployment mode to `off`, disable or remove the canary row, and record
the readback showing mode `off` and zero enabled canary rows. For an emergency binary rollback,
deploy the last permit-aware binary (the newest release compatible with exact-consent grant
records), then set all write-related flags explicitly off. Never select a pre-permit binary
without a compatibility assessment.

## Credential Rotation and Retention Gates

- Key rotation starts with a staging dry-run using a keyring containing both old and new key
  IDs. The artifact contains only active key id, `examined`, `oldKeyCount`, `rewrapped=0`,
  `conflicts=0`, timestamp, and digest. It must contain no tokens, envelopes, or key material.
- Retention proof records counts from the classified-store readiness census and a request-log
  retention dry run; do not attach payload samples.
- Backup/PITR proof is an external Supabase artifact recording project identity, backup/PITR
  availability and window, latest backup, latest restore-test timestamp, and digest. It is not
  satisfied by a source migration or a local test.

## Staging Acceptance

- Connect Google from the shipped settings route using a staging venue/operator account.
- Verify callback returns to `/app/settings/restaurant/google-business-profile?gbp=connected`.
- Verify linked-location selection and a read-only sync snapshot.
- Verify publish preview builds a plan without executing publish.
- Verify disabled flags reject the expected write families before provider/Core writes.
- Verify restaurant pause blocks preview/publish/refresh/queue write paths while preserving state reads.
- Verify request-log rows are redacted and retention dry-run reports expected counts.
- Verify queue, health, auto-export, refresh, and retention cron dry-runs.

## Production Acceptance

- Link this checklist to staging evidence before production work starts.
- Keep production smoke read-only first: state, locations, preview, health dry-run, queue dry-run.
- First approved write must specify venue, operator, field decisions, expected masks, rollback flags, and observation window.
- Record publish batch id, operation ids, request-log ids, and final recompute outcome.
- Keep rollback controls ready: disable export/high-risk/menu/attributes/scheduled refresh/auto candidates as needed.

## Evidence Template

Copy `scripts/verify/gbp-release-readiness.template.json` to a secure, non-repository
evidence location and replace placeholders with metadata only. Each entry needs a verified
status, timestamp, source, opaque artifact reference, and SHA-256 digest; it must not contain
secrets, raw provider responses, guest data, or request payloads.

Validate it locally without any network call or external write:

```sh
node scripts/verify/gbp-release-readiness.mjs --input /secure/evidence/gbp-release-readiness.json
```

The checker fails closed if any required external release artifact is missing, duplicated,
malformed, not verified, or contains an unexpected field. Its JSON result returns only artifact
identifiers and counts, never supplied metadata values.
