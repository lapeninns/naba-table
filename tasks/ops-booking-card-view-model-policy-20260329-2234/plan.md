---
task: ops-booking-card-view-model-policy
timestamp_utc: 2026-03-29T22:34:59Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card View-Model Policy

## Objective

We will make the Ops booking card builder the canonical source of truth for normalized card display and action policy so both the dashboard list and bookings list receive the same richer row model without changing selector scope.

## Success Criteria

- [ ] Builder returns grouped `header`, `details`, `actions`, `meta`, and `booking` submodels.
- [ ] Guest identity normalizes to Walk-in Guest when absent, and initials derive from that normalized label.
- [ ] Table state is canonical: `assigned`, `unassigned`, or `not_applicable`.
- [ ] Urgency is suppressed for done and checked-in bookings.
- [ ] Footer completion label is canonicalized in the builder, not re-derived in the action component.
- [ ] Structured action policy determines visibility/disabled state for primary and menu actions.
- [ ] Existing selector inputs and fetch scope remain unchanged.

## Architecture & Components

- Canonical policy layer:
  - `src/components/features/dashboard/cards/opsBookingCardUtils.ts`
- Selector/dashboard consumers:
  - `src/components/features/bookings/opsBookingsSelectors.ts`
  - `src/components/features/dashboard/list/BookingsListVirtualized.tsx`
- Presentational consumers:
  - `src/components/features/dashboard/cards/OpsBookingCard.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCardHeader.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCardDetails.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCardActions.tsx`

## Data Flow & API Contracts

- Inputs remain unchanged:
  - `booking`
  - `timezone`
  - `now`
  - `pendingAction`
  - `actionsDisabled`
  - optional urgency/time overrides
- Output contract changes from a flat card row to grouped submodels:
  - `booking`
  - `meta`
  - `header`
  - `details`
  - `actions`

## UI/UX States

- Header consumes normalized guest label, initials, time/date labels, status, urgency, and notes indicator.
- Details consume canonical reference/contact/notes/table display labels and table state.
- Footer/actions consume structured policy for:
  - details button
  - menu actions (`edit`, `no_show`, `cancel`)
  - primary action (`check-in` or `check-out`)
  - completion footer label for done bookings

## Edge Cases

- Missing guest name -> `Walk-in Guest`
- Missing contact -> `No contact`
- Missing reference -> fallback from booking id
- No table assignment on active booking -> `unassigned`
- No table assignment on finished/non-table booking -> `not_applicable`

## Testing Strategy

- Unit:
  - `tests/components/OpsBookingCardViewModel.test.ts`
  - `tests/components/features/bookings/opsBookingsSelectors.test.ts`
  - `tests/components/OpsBookingCardActions.noShow.test.tsx`
- Verification:
  - targeted Vitest run for touched card/selector tests
  - note UI verification requirement in `verification.md`; run Chrome DevTools if card rendering behavior materially changes during local validation

## Rollout

- No feature flag; canonical refactor of existing UI path.
- Preserve public behavior while consolidating policy into the builder.

## DB Change Plan (if applicable)

- Not applicable.
