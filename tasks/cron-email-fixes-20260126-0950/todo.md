---
task: cron-email-fixes
timestamp_utc: 2026-01-26T09:52:43Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate cron/email job entrypoints and schedulers
- [x] Identify affected email types and queues

## Core

- [x] Fix scheduling or selection logic
- [ ] Ensure idempotency/deduping
- [ ] Add/adjust logging for diagnosis

## UI/UX

- [ ] N/A (unless UI changes required)

## Tests

- [x] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks (if UI changes)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
