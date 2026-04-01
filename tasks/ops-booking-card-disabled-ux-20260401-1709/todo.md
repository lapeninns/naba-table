---
task: ops-booking-card-disabled-ux
timestamp_utc: 2026-04-01T17:09:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm the current callers and action policy for locked ops booking cards.
- [x] Reuse the existing ops bookings dev harness for browser proof.

## Core

- [x] Restore row-level inert styling and `aria-disabled` on locked cards.
- [x] Disable the mobile collapse toggle while locked.
- [x] Disable Details during pending lifecycle mutations.
- [x] Disable the overflow trigger only when the full action surface is locked.

## Tests

- [x] Update `tests/components/OpsBookingCard.test.tsx`
- [x] Update `tests/components/OpsBookingCardActions.noShow.test.tsx`
- [x] Run focused vitest coverage
- [x] Run `pnpm typecheck`

## Verification

- [x] Open the ops bookings dev harness in Chrome DevTools
- [x] Verify non-locked overflow actions still open
- [x] Capture screenshot evidence
- [x] Document the transient pending-state browser limitation

## Notes

- Assumptions:
  - Locked cards should be fully inert again, not partially interactive.
- Deviations:
  - The dev harness mutation resolves too quickly to hold a stable pending-state screenshot, so focused component tests serve as compensating evidence for that exact transient state.
