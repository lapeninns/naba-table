---
task: booking-ux-optimistic
timestamp_utc: 2026-01-24T21:34:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Remove artificial delay in Seat/Finish handlers.
- [x] Update list loading logic to avoid full skeleton on refetch.
- [x] Add optimistic cache updates for ops bookings list/detail.
- [x] Ensure rollback on error.
- [x] Remove artificial delay for Finish actions (check-out).
- [x] Filter upcoming/default views to exclude completed bookings.
- [x] Add polling for ops summary/list when realtime is disabled.
- [x] Invalidate ops summary/changes caches after lifecycle transitions.
- [x] Lock other bookings during Seat/Finish until mutation completes.

## UI/UX

- [x] Add subtle updating indicator (a11y status).
- [x] Refine card hover/press transitions (keep brand tokens).
- [x] Smooth pending overlay entry/exit and reduce layout jank (respect reduced motion).
- [x] Normalize list item reveal animation for mobile/desktop.

## Tests

- [ ] Manual QA of Seat/Finish, lock behavior, and check-out list refresh.

## Notes

- Assumptions:
- Deviations:
