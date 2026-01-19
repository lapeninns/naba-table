---
task: auto-complete-past-bookings
timestamp_utc: 2026-01-19T19:44:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Define midnight window size (60 minutes) and batch limits (default 200).
- [x] Choose actor ID strategy (membership + auth user fallback; optional env override).

## Core

- [x] Add cron endpoint `/api/cron/auto-complete-bookings`.
- [x] Implement eligibility query + timezone window.
- [x] Apply lifecycle transitions and enqueue review emails.
- [x] Add logging + summary counts.
- [x] Add cron schedule in `vercel.json`.

## Tests

- [ ] Unit tests for eligibility/time window.
- [ ] Staging cron dry-run.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- See research.md.
