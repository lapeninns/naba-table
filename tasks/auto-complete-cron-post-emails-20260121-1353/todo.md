---
task: auto-complete-cron-post-emails
timestamp_utc: 2026-01-21T13:53:09Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target environment (production)
- [ ] Confirm trigger scope and guard requirements

## Core

- [x] Update auto-complete window to closing + 5 minutes (local time)
- [x] Fix post-event scheduling bug (double-day push)
- [ ] Verify manual trigger via cron endpoint (dry-run + limit)

## Tests

- [ ] Unit tests for close-window calculation + smart-schedule fix

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Should we prevent sending if a review email already went out?
