# Review scheduling recovery

Booking completion persists a `review_scheduling_jobs` row in the same database transaction. The existing `/api/cron/auto-complete-bookings` worker drains due jobs every 15 minutes, including jobs for bookings already marked completed. It reloads the booking in its tenant and uses current venue preferences, WhatsApp consent, send-time rules, the 90-day guest cooldown and the existing review journey.

A scheduling job is complete only after eligible delivery intents are persisted, or the current booking/preferences/journey make it ineligible. Database and queue failures retain the job with a bounded error code and a 5–60 minute backoff. A crashed worker's lease expires after 15 minutes; claim tokens prevent stale acknowledgements. `reviewScheduling.failed` makes the cron return HTTP 500 instead of reporting success. Read pending job age, `attempt_count` and `last_error_code` to investigate persistent failures. No guest contact details are copied into this ledger.

Review-email retries insert with conflict-ignore semantics: they never reset an existing pending, claimed, sent or terminal delivery intent. WhatsApp uses its existing idempotent ledger. Delivery failures remain the responsibility of the delivery workers; this job recovers scheduling failures only.

## Deployment order

1. Run the database migration plan, apply `20260906140000_review_scheduling_recovery.sql` to staging, and execute the registered SQL regressions with synthetic fixtures and verified rollback.
2. Apply the same immutable migration to production through `pnpm db:plan-remote` and `pnpm db:migrate` with the exact production target guards.
3. Deploy the application containing the retry worker. The additive schema is compatible with the previous app; jobs accumulate until the new worker runs.
4. Verify the scheduler definition uses `extensions.digest`, the cron's scheduling summary and the durable ledger. Readiness alone does not prove review scheduling or delivery.

The migration qualifies pgcrypto explicitly while retaining `search_path=public`. Never edit the previously applied review-growth migration.

## Historical recovery

The migration does not enroll historical completed bookings or send historical requests automatically. Before recovery, review an explicit list of affected completed booking IDs for each restaurant, their existing journeys and delivery intents, current venue preference and channel eligibility. Confirm the recovery scope with the operator; historical recovery can result in real guest messages when the normal delivery workers drain.

Use the service-role-only `recover_review_scheduling_jobs_v1(p_restaurant_id, p_booking_ids)` RPC with one tenant and at most 200 explicit IDs. It rejects a mixed-tenant or non-completed list and does not duplicate existing jobs. It schedules recovery work; it does not bypass cooldown, consent or delivery deduplication. Do not call provider APIs directly or reset sent/claimed delivery intents. After the next cron run, read job completion/failure, journey suppression reasons and both delivery ledgers separately. A scheduling success is not evidence of provider delivery.

A failed scheduling job retries automatically. An already finished scheduling job is not reset by the recovery RPC; investigate downstream delivery state instead. A completion transition after reopening re-enrolls the job, but the existing journey and delivery keys still prevent an additional ask.

## Rollback

Roll back the application if necessary and retain the additive table, trigger and migration. This preserves unscheduled obligations for the repaired worker. Do not drop the retry ledger or revert the qualified hash call. Review an explicit corrective migration if the schema itself needs repair.
