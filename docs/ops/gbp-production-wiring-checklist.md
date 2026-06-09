# GBP Production Wiring Checklist

This checklist is for staging-first verification. Do not paste secret values into task artifacts; record only presence, target name, timestamps, command names, and non-sensitive readback.

## Before Any Production Claim

- Confirm the target environment: staging first, production only after staging evidence is complete.
- Confirm the branch/deploy SHA that contains the GBP route, dual-sync, and migration changes.
- Confirm the app host and root host routing split still sends ops settings traffic to the app host.
- Confirm all checks are read-only until a named write test is explicitly approved.

## Environment Variables

Record presence only, not values.

| Variable family                                                                                                                                                                                     | Expected source behavior                                                          | Check                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                                                                                                                               | Required in production schema and used as trusted app-origin fallback.            | Present and points to the deployed app host.                        |
| `NEXT_PUBLIC_ROOT_DOMAIN`                                                                                                                                                                           | Used by proxy/origin hardening and app/root host split.                           | Present and matches the public root domain.                         |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                                                                                            | Required app database access.                                                     | Present for the target Supabase project.                            |
| `CRON_SECRET` or `CRON_SECRETS`                                                                                                                                                                     | Required by cron auth.                                                            | Present; previous secret rotation state recorded if relevant.       |
| `GOOGLE_BUSINESS_CLIENT_ID` or `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`                                                                                                                                  | Required for Google OAuth.                                                        | Present in the target deployment.                                   |
| `GOOGLE_BUSINESS_CLIENT_SECRET` or `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`                                                                                                                          | Required for Google OAuth.                                                        | Present in the target deployment.                                   |
| `GOOGLE_BUSINESS_REDIRECT_URI` or `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`                                                                                                                            | Required for Google OAuth callback.                                               | Present and matches the Google Cloud OAuth client allowlist.        |
| `GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY` or `GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY`                                                                                                            | Required for encrypted credential storage.                                        | Present and rotation plan known.                                    |
| `GOOGLE_CLOUD_QUOTA_PROJECT`                                                                                                                                                                        | Optional quota project for Google requests.                                       | Present if quota/accounting requires it.                            |
| `DUAL_SYNC_FAILURE_WEBHOOK_URL`                                                                                                                                                                     | Optional operational alert webhook; schema requires `https://` when set.          | Present only if alert delivery is configured.                       |
| `GBP_IMPORT_ENABLED`, `GBP_EXPORT_ENABLED`, `GBP_AUTO_CANDIDATES_ENABLED`, `GBP_HIGH_RISK_EXPORTS_ENABLED`, `GBP_MENU_SYNC_ENABLED`, `GBP_ATTRIBUTES_SYNC_ENABLED`, `GBP_SCHEDULED_REFRESH_ENABLED` | Runtime rollback flags default enabled when unset and fail closed when set false. | Record explicit target values or record that defaults are accepted. |

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
- `/api/cron/dual-sync/health` hourly.
- `/api/cron/dual-sync/request-log-retention` daily at 02:30 UTC.

Live target verification must prove:

- The deployed scheduler contains those paths and schedules.
- Each path receives `Authorization: Bearer <cron secret>` from the scheduler.
- `dryRun=1` checks succeed before any non-dry-run invocation.
- Queue drains start with a low `maxJobs` cap after dry-run proof.

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

```text
Environment:
Deploy SHA:
Supabase project:
Google OAuth client:
Read-only checks:
Staging write checks:
Production read-only checks:
Approved production write, if any:
Rollback flags verified:
Open caveats:
```
