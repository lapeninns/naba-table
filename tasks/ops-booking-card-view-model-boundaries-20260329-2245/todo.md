---
task: ops-booking-card-view-model-boundaries
timestamp_utc: 2026-03-29T22:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect current card/view-model/action-policy code paths
- [x] Normalize view-model contracts for header/details/actions

## Core

- [x] Refactor `OpsBookingCard` to orchestration only
- [x] Refactor `OpsBookingCardHeader` to normalized header props
- [x] Refactor `OpsBookingCardDetails` to normalized details props
- [x] Refactor `OpsBookingCardActions` to structured action policy with existing surface callbacks

## Behavior

- [x] Keep invalid actions visible but disabled
- [x] Keep plain `Details` enabled during pending mutations
- [x] Preserve no-show confirmation flow
- [x] Prevent done bookings from exposing mutating actions as valid

## Tests

- [x] Update/add focused unit and component tests
- [x] Run targeted verification

## Notes

- Assumptions:
  - Existing visible labels and callback names remain the public surface.
- Deviations:
  - Manual DevTools UI QA was attempted but blocked by a pre-existing Next worktree resolution error (`Can't resolve 'tailwindcss' in '/Users/amankumarshrestha/.cline/worktrees/e4404'`) before the dev harness route could render.
