---
task: auto-complete-past-bookings
timestamp_utc: 2026-01-19T19:44:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auto-complete past bookings and trigger review emails

## Requirements

- Functional:
  - On a schedule, find past bookings that are still `confirmed` or `checked_in`.
  - Transition them to `completed` via standard lifecycle (check-in/check-out where needed).
  - Trigger review-request email for each completed booking.
  - Run daily at midnight per restaurant local time.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: use remote Supabase only; secrets via env.
  - Reliability: bounded batches, idempotent behavior, safe retries.
  - Observability: log counts + errors; artifacts or audit trail.

## Existing Patterns & Reuse

- Review emails scheduled via `enqueueCheckOutSideEffects` when status becomes `completed`.
- Lifecycle transitions via `apply_booking_state_transition` RPC.
- Cron endpoint pattern: `/api/cron/process-emails` + `vercel.json` schedule.

## External Resources

- N/A

## Constraints & Risks

- Must supply valid `changed_by` user ID for booking_state_history FK.
- Per-restaurant timezones require a cron window check (local midnight, 15-minute window).
- Risk of duplicate review emails if already sent while status was not completed.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add a cron endpoint `/api/cron/auto-complete-bookings` and schedule in `vercel.json`.
- Run hourly and target restaurants whose local time is within a midnight window (to satisfy “local midnight”, daily).
- For `confirmed`: set `checked_in_at` to start time then check-out at end time.
- For `checked_in`: check-out at end time.
