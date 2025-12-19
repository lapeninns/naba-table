---
task: fix-reservation-token
timestamp_utc: 2025-12-11T09:48:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review `useReservationWizard` safeReturnPath logic and related helpers (Augment retrieval).

## Core

- [x] Update safeReturnPath to include confirmation token after booking success.
- [x] Handle fallback to public thank-you page if token unavailable.

## UI/UX

- [ ] Ensure close action redirects correctly for guests.

## Tests

- [x] Update/add unit tests for safeReturnPath token preservation.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None yet.
