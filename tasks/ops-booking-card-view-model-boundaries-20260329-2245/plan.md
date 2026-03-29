---
task: ops-booking-card-view-model-boundaries
timestamp_utc: 2026-03-29T22:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card View-Model Boundaries

## Objective

We will normalize the Ops booking card into header, details, and actions contracts so the card remains an orchestration shell and all rendering decisions come from the canonical view-model builder.

## Success Criteria

- [ ] `OpsBookingCard` only coordinates disclosure state and external callback wiring.
- [ ] `OpsBookingCardHeader` renders from normalized header props only.
- [ ] `OpsBookingCardDetails` renders from normalized details props only and stays desktop-visible while mobile uses disclosure.
- [ ] `OpsBookingCardActions` renders from structured action policy while preserving existing visible controls and handlers.
- [ ] Invalid actions stay visible but disabled.
- [ ] `Details` stays enabled during pending mutations.
- [ ] No-show confirmation is unchanged.
- [ ] Done bookings do not expose mutating actions as valid.

## Architecture & Components

- `opsBookingCardUtils.ts`
  - Extend `OpsBookingCardViewModel` with `header`, `details`, and `actions`.
  - Build a first-class action policy with explicit validity and disabled reasons.
- `OpsBookingCard.tsx`
  - Own disclosure/open state, loading state presentation, and callback adaptation only.
- `OpsBookingCardHeader.tsx`
  - Render normalized header model.
- `OpsBookingCardDetails.tsx`
  - Render normalized details model with responsive disclosure behavior.
- `OpsBookingCardActions.tsx`
  - Render from structured action policy plus wired callbacks and pending dialog state.

## Testing Strategy

- Unit:
  - Extend `OpsBookingCardViewModel.test.ts` to assert normalized slices and action validity for done/pending bookings.
- Component:
  - Refresh/add `OpsBookingCardActions` tests for no-show confirmation and pending `Details` behavior.

## Rollout

- No flag or schema change.
- Safe refactor constrained to the canonical card pipeline.
