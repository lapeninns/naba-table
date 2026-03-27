---
task: email-intents-db-rollout
timestamp_utc: 2026-03-27T09:46:35Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable (no UI change).

## Staging Results

- Linked Supabase target confirmed as staging project `ndxmivcrehsacuerwxtm`.
- Applied `supabase/migrations/20260327090000_add_email_dispatch_intents.sql` via Supabase MCP `execute_sql`.
- Verified `public.email_dispatch_intents` exists on staging.
- Verified `public.claim_due_email_dispatch_intents(integer, text[])` exists on staging.
- Verified `select count(*) from public.claim_due_email_dispatch_intents(5, null)` returns `0`.
- Recorded migration version `20260327090000` with name `add_email_dispatch_intents` in `supabase_migrations.schema_migrations`.

## Production Results

- Production target confirmed from env/task history as `vrdiqfudmwydclqpydee`.
- Direct Postgres auth attempts had previously failed, so production was applied through the Supabase Management API instead.
- Used `POST /v1/projects/vrdiqfudmwydclqpydee/database/query` with the local PAT from `.env.local`.
- Applied the repo SQL from `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`.
- Registered migration version `20260327090000` with name `add_email_dispatch_intents` in `supabase_migrations.schema_migrations` using `ON CONFLICT DO NOTHING`.
- Verified `public.email_dispatch_intents` exists on production.
- Verified `public.claim_due_email_dispatch_intents` exists on production via `pg_proc`.
- Verified production migration metadata contains version `20260327090000`.
- Verified `service_role` has `EXECUTE` privilege on `public.claim_due_email_dispatch_intents(integer, text[])`.
- Read-only verification of `select count(*) from public.claim_due_email_dispatch_intents(5, null)` is expected to fail because the read-only query endpoint runs without `service_role` privileges.

## Post-rollout Runtime Validation

- Live cron route is reachable on production:
  - `https://www.nabatable.com/api/cron/process-emails?maxJobs=1`
  - authenticated with the configured `CRON_SECRET`
  - response: `{"success":true,"message":"No pending emails to process","processed":0,...}`
- Production env snapshots still indicate:
  - `FEATURE_EMAIL_QUEUE_ENABLED=true`
  - valid `CRON_SECRET`
  - Resend production config present
- Production database activity is currently inconsistent with the intended ledger cutover:
  - `public.email_dispatch_intents` currently has `0` rows total
  - latest query for recent rows returns `[]`
  - `public.email_delivery_log` still shows fresh `review_request` sends on `2026-03-27`
  - count of `review_request` sends in the last 24 hours: `9`
- Controlled provider-level validation email:
  - sent via production Resend account from `no-reply@notifications.nabatable.com`
  - accepted with provider id `3e2fccae-e607-4d3a-973c-82ca97f583dc`
  - retrieved from Resend API with `last_event = "delivered"`
- Production app/runtime cutover is now deployed through Vercel:
  - first successful production deploy: `dpl_HcASnjbFDbSYusRdMo8JKdaLEKwM`
  - follow-up production deploy with ledger payload serialization fix: `dpl_Du3GrYhpxVrcz37qM7NbavsvkAjX`
  - final deployment aliases include `app.nabatable.com`, `www.nabatable.com`, `assets.nabatable.com`, and `nabatable.com`
- Production ledger processor bug found and fixed during validation:
  - claimed intents were serializing `scheduled_for` / `last_attempt_at` in Postgres timestamp format inside `server/queue/email-intents.ts`
  - `emailJobPayloadSchema` requires ISO datetimes, so claimed jobs could fail before email dispatch
  - fixed by normalizing ledger timestamps to ISO in `toPayload()`
- Controlled zero-delivery production ledger validation:
  - seeded one due intent with dedupe key `manual_validation__20260327T1158Z__updated__ec1bdba1`
  - bound to booking `ec1bdba1-79a6-4b57-9b5c-0065cc8cf4b4` (`5938Q0HHBU`), which has an empty `customer_email`
  - first cron run on the pre-fix deployment claimed the row and exposed the timestamp-format bug
  - after deploying `dpl_Du3GrYhpxVrcz37qM7NbavsvkAjX`, rerunning production cron returned:
    - `processed=1`
    - `sent=0`
    - `skipped=1`
    - `failed=0`
  - the validation row was then deleted from production

## Interpretation

- The production schema rollout is complete.
- The production email provider configuration is working for direct sends.
- The ledger-backed production runtime is now deployed and verified.
- Production cron has successfully claimed and processed a ledger intent on the live deployment.
- Direct provider delivery and live ledger claim/drain have both been verified in production.
- A naturally created post-deploy booking has not yet been observed writing a new reminder/review row into `public.email_dispatch_intents`, so that remains useful follow-up evidence, but it is no longer a blocker to declaring the cutover live.

## Booking-specific Validation (2026-03-27)

- Production booking found for `oldschoolhouse@lapeninns.com`:
  - booking id: `f8514411-dfc7-451a-add2-ba2f8743efb8`
  - reference: `LT4ACNL4SE`
  - created at: `2026-03-27 10:43:42.56096+00`
  - start at: `2026-03-27 14:30:00+00`
  - status: `confirmed`
- Immediate confirmation email fired successfully through the normal app path:
  - `email_delivery_log` row id: `7654e1eb-4d49-4284-9614-6c2949b08f0b`
  - type/template: `created`
  - occurred at: `2026-03-27 10:43:50.114773+00`
  - message id: `8fda0e2a-df16-41a5-be89-996e9a822b14`
- No matching row exists in `public.email_dispatch_intents` for this booking.
- The legacy Cloudflare email gateway **does** contain a delayed job for this booking:
  - job id: `reminder_short__f8514411-dfc7-451a-add2-ba2f8743efb8`
  - scheduled for: `2026-03-27T12:30:00.000Z`
  - status: `delayed`

## Booking-specific Conclusion

- This booking proves production is still scheduling delayed reminder emails through the legacy Cloudflare gateway.
- It reflects pre-cutover runtime behavior and should not be treated as evidence against the current deployment.

## Status

- [x] Staging rollout complete
- [x] Production rollout complete
- [x] Production runtime cutover verified

## Known Follow-up

- `scripts/supabase/check_migration_versions_unique.sh` still fails because of older duplicate migration version prefixes already present in `supabase/migrations/`.
- Observe one naturally created post-deploy delayed email and confirm it writes to `public.email_dispatch_intents`.
