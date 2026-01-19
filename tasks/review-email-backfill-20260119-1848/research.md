---
task: review-email-backfill
timestamp_utc: 2026-01-19T18:49:59Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Backfill review emails for past bookings

## Requirements

- Functional:
  - Identify past bookings before the cutoff and send review-request emails.
  - Cutoff uses per-restaurant local time: January 19, 2026 6:00 PM in each restaurant timezone.
  - Mark bookings as completed via the standard check-in/check-out flow so review emails are scheduled.
  - Eligible bookings: status `confirmed` only.
  - Booking must be past: booking end time is before the cutoff (per-restaurant local time) and before now.
  - If `end_at` is missing, derive end from `booking_date + end_time` in restaurant timezone; fallback to `start_at` if needed.
  - Avoid emailing cancelled/no-show/completed bookings to prevent duplication.
  - Run staging first, filtered to bookings for `amanshresthaaaaa@gmail.com` only.
  - Production run should not use an email filter (all guests).
  - Enable review emails for restaurants where `sendReviewRequest=false` (permanent).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: use remote Supabase only; no local DB; no secrets in source.
  - Safety: dry-run and log affected booking IDs before applying.
  - Idempotency: avoid duplicate review sends where possible.

## Existing Patterns & Reuse

- Review emails are scheduled on transition to `completed` via check-out (`enqueueCheckOutSideEffects`).
- Check-out requires a prior check-in and non-future timestamps.
- Email sending is gated by restaurant prefs and status guard.

## External Resources

- N/A

## Constraints & Risks

- No DB field tracks whether a review email was already sent; dedupe is limited.
- Check-out cannot occur without check-in; timestamps must be valid and not in future.
- If `sendReviewRequest` is disabled for a restaurant, check-out would not schedule the email.
- Turning `sendReviewRequest` on for all restaurants changes future behavior (confirmed permanent).

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use a one-off server-side backfill script that:
  - Loads bookings with `start_at` < cutoff, excludes `cancelled`/`no_show`/`completed`.
  - Sets `checked_in_at` (from `start_at`) and `checked_out_at` (from `end_at` or `start_at`).
  - Transitions to `completed` via the same RPC used by check-out, then calls `enqueueCheckOutSideEffects` to schedule review emails.
  - Supports dry-run mode and produces an artifact list of affected booking IDs.
