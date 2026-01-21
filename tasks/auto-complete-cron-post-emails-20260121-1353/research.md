---
task: auto-complete-cron-post-emails
timestamp_utc: 2026-01-21T13:53:09Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auto-complete cron verification + post-booking email trigger

## Requirements

- Functional:
  - Verify whether the auto-complete cron ran for bookings that should have completed **yesterday (2026-01-20)** and earlier.
  - Change auto-complete timing: run **5 minutes after each restaurant’s closing time** (local time).
  - Fix the review-email smart-schedule bug that pushes post-event emails two days later.
  - Provide an easy, safe way to trigger **post-booking review emails** on demand.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Authenticated/guarded access for any trigger endpoint or script.
  - Idempotent / deduped to avoid double-sending.
  - Minimal blast radius (limit batches, dry-run option).

## Existing Patterns & Reuse

- Cron endpoint: `src/app/api/cron/auto-complete-bookings/route.ts`.
- Job logic: `server/jobs/auto-complete-bookings.ts`.
- Schedule: `vercel.json` runs cron every 15 minutes; logic only applies within local-midnight window (default 15 minutes).
- Email queue: `server/queue/email.ts` with job type `review_request`.
- Side-effects helper: `enqueueCheckOutSideEffects` (invoked on check-out).
- Debug endpoint: `src/app/api/admin/queue-status/route.ts`.
- Test endpoint: `src/app/api/test/queue-emails/route.ts` (guarded; not ops-facing).

## External Resources

- None.

## Constraints & Risks

- Supabase is remote-only (no local DB).
- Cron window logic must move from “local midnight” to “closing + 5 minutes” per restaurant/date.
- Review emails must still respect optimal hours (9am–8pm); auto-complete timing is independent of send timing.
- Triggering review emails without guards risks spam / duplicate sends.
- Need to dedupe by job ID or booking metadata (unknown current markers).

## Findings

- Production (project `vrdiqfudmwydclqpydee`): **2026-01-20** bookings = 8 total (7 completed, 1 cancelled), 0 still confirmed/checked_in.
- Production: 4 review_request jobs in queue (delayed), 0 in DLQ, scheduled for 2026-01-22 due to smart-schedule bug.
- Using `.env.local` Supabase project `rrpeokmfbtbrirqjprpe`, there is a backlog of **49** bookings with `status IN (confirmed, checked_in)` and `end_at < now` as of **2026-01-21T13:54:27Z**.

## Open Questions (owner, due)

- Scope for post-email trigger: single booking ID, date range, restaurant filter, or all? (owner: user)
- Should we prevent sending if a review email was already sent? If yes, where is that tracked? (owner: maintainer)

## Recommended Direction (with rationale)

- Update auto-complete cron window to fire **5 minutes after closing** (local time) using operating hours for the booking date.
- Fix post-event scheduling bug in `adjustToOptimalSendTime` for review emails (avoid double-adding days).
- Trigger: add a guarded ops/admin endpoint (or script) that queues `review_request` jobs by booking ID or by date range, with dry-run, batch limit, and dedupe via stable job IDs.
