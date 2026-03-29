---
task: update-booking-card-tests
timestamp_utc: 2026-03-29T23:05:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Update booking card tests

## Objective

We will align booking card tests with the rebuilt booking-card logic so the suite validates the current normalized contract and interaction policy instead of legacy assumptions.

## Success Criteria

- [x] View-model tests cover normalization, initials, notes, canonical table states, urgency suppression, contact/reference fallbacks, and party-size formatting.
- [x] Component/action tests cover per-status action policy, disabled done-booking mutations, pending-mutation behavior, details visibility/clickability, and mobile/desktop rendering rules.
- [x] Affected selector/component tests pass without relying on stale contract assumptions.

## Architecture & Components

- `src/components/features/dashboard/cards/opsBookingCardUtils.ts`: source-of-truth booking card normalization and action derivation.
- `src/components/features/dashboard/cards/OpsBookingCard*.tsx`: rendered booking card states and actions.
- `tests/components/OpsBookingCard*.test*`: helper/component coverage to refresh.
- `tests/components/features/bookings/opsBookingsSelectors.test.ts`: selector expectations if impacted by contract cleanup.

## Data Flow & API Contracts

- Booking list item input is normalized into a view-model before rendering.
- Status/action policy derives from canonical booking status plus mutation-pending flags.

## UI/UX States

- Loading/pending mutation
- Primary action enabled/disabled
- Details action always present on desktop and still clickable while mutations are pending
- Mobile notes hint only when notes are collapsed/hidden by layout rules

## Edge Cases

- Blank/whitespace labels and notes
- Missing contact and booking reference
- Confirmed, checked-in, completed, cancelled, and no-show action policy
- Done bookings with mutations disabled

## Testing Strategy

- Unit: view-model normalization helpers and selectors
- Component: booking card rendering and button states via Testing Library

## Rollout

- No runtime rollout; test-only change
