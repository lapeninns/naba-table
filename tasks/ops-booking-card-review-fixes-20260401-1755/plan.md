---
task: ops-booking-card-review-fixes
timestamp_utc: 2026-04-01T17:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card Review Fixes

## Objective

We will close the reproducible PR review findings so that the ops booking card advertises its locked state accessibly, the repo typechecks without a dev server, and the booking card view-model tests match the current lock policy.

## Success Criteria

- [ ] Locked booking cards render `aria-disabled="true"` when interactions are locked.
- [ ] `next-env.d.ts` no longer imports `.next/dev` artifacts.
- [ ] Focused tests and typecheck pass against the corrected expectations.
- [ ] Browser verification confirms the locked card still appears inert on the existing ops bookings dev harness.

## Architecture & Components

- `src/components/features/dashboard/cards/OpsBookingCard.tsx`: owns row-level accessibility and locked-card semantics.
- `next-env.d.ts`: must stay on the stable Next-generated baseline.
- `tests/components/OpsBookingCardViewModel.test.ts`: proves the centralized action policy.
- Task artifacts: record that the initials-related finding was checked and found already satisfied.

## Data Flow & API Contracts

Endpoint: none
Request: n/a
Response: unchanged
Errors: unchanged

## UI/UX States

- Locked cards remain visually dimmed and pointer-inert.
- Locked cards now also expose their state to assistive technology via `aria-disabled`.

## Edge Cases

- Locked state must not break the existing mobile collapse-toggle disable behavior.
- Typecheck must succeed without `.next/dev` existing locally.

## Testing Strategy

- Focused component regression tests:
  - `tests/components/OpsBookingCard.test.tsx`
  - `tests/components/OpsBookingCardViewModel.test.ts`
- Validation:
  - `pnpm typecheck`
- Manual UI proof:
  - Chrome DevTools smoke on the ops bookings dev harness at mobile width to confirm the locked card remains inert and exposes the corrected row semantics.

## Rollout

- No feature flag needed.
- Safe rollout because this is a semantics/test-alignment patch with no API shape changes.

## DB Change Plan (if applicable)

- No database changes.
