---
task: review-email-backfill
timestamp_utc: 2026-01-19T18:49:59Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm cutoff timezone and restaurant scope.
- [x] Apply email filter in staging only (`amanshresthaaaaa@gmail.com`).
- [x] Confirm eligible statuses (confirmed only) and end-time definition for “past”.
- [x] Flip `sendReviewRequest` to true where false (permanent).

## Core

- [x] Add dry-run script to list candidate bookings and counts.
- [x] Add staging-only email filter for `amanshresthaaaaa@gmail.com`.
- [x] Add apply mode to transition bookings and schedule review emails.
- [x] Add optional step to flip `sendReviewRequest` to true where false.
- [x] Capture artifact list and summary.

## Tests

- [x] Dry-run on staging data.
- [x] Apply small batch in staging.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- (filled in research.md)
