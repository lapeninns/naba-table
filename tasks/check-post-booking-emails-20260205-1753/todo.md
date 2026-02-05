---
task: check-post-booking-emails
timestamp_utc: 2026-02-05T17:53:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target environment + time window for audit (prod, last 72h)
- [x] Confirm Resend API access for audit

## Core

- [x] Check queue configuration and cron health (Redis + unauth cron probe)
- [x] List Resend review-request emails for the window
- [x] Compare with completed bookings for missing sends (prod; last 72h)
- [x] Add review-only filter to process-emails cron route
- [x] Drain due review_request jobs (manual queue processing)
- [x] Fix build error blocking production deploy
- [x] Deploy changes to production
- [x] Backfill review_request jobs for completed bookings in last 72 hours and trigger cron processing

## Tests

- [x] Local `pnpm run build`
- [x] Local `pnpm run lint`
- [x] Local `pnpm run typecheck`

## Notes

- Assumptions:
- Resend list endpoint returns newest-first (used for early-stop pagination).
- Deviations:

## Batched Questions

- Answered: compared against completed bookings (prod; last 72h) and backfilled review_request jobs.
