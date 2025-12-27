---
task: email-scheduling-redis
timestamp_utc: 2025-12-26T23:57:10Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: [feat.email.queue]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Scope confirmed: queue all booking emails when flag enabled
- [x] Add/verify email queue worker entrypoint

## Core

- [x] Implement worker to fetch booking and dispatch email by job type
- [x] Ensure worker skips invalid/missing bookings and respects booking status
- [x] Update booking side-effects to enqueue all booking emails when flag enabled
- [x] Add logging + DLQ behavior (BullMQ defaults)

## UI/UX

- [ ] N/A

## Tests

- [ ] Unit/integration for worker routing

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
