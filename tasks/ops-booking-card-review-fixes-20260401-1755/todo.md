---
task: ops-booking-card-review-fixes
timestamp_utc: 2026-04-01T17:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Verify the reported findings against the current branch and current tests.
- [x] Create a dedicated task folder for this review-fix pass.

## Core

- [x] Update `OpsBookingCard` row semantics to expose `aria-disabled` for locked cards.
- [x] Restore `next-env.d.ts` to the safe baseline without `.next/dev` imports.
- [x] Align the stale `details.disabled` expectation with the centralized lock policy.

## UI/UX

- [x] Keep the locked card visually inert and mobile-toggle disabled behavior unchanged.

## Tests

- [x] `tests/components/OpsBookingCard.test.tsx`
- [x] `tests/components/OpsBookingCardViewModel.test.ts`
- [x] `pnpm typecheck`
- [x] Chrome DevTools manual verification on the ops bookings harness

## Notes

- Assumptions:
  - The initials override review finding is already resolved in the current branch because `getGuestIdentity()` reads normalized `displayInitials`.
- Deviations:
  - Verification-first is used here because the task started from review findings and required confirming current branch behavior before patching.

## Batched Questions

- None.
