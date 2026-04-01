---
task: ops-booking-card-disabled-ux
timestamp_utc: 2026-04-01T17:09:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card Disabled UX Follow-up

## Objective

We will restore a fully locked interaction state for ops booking cards during lifecycle mutations so that users cannot keep interacting with a row that is already processing an action.

## Success Criteria

- [ ] Locked cards expose an accessible disabled state and block row-level pointer interaction.
- [ ] Mobile collapse toggles are disabled while the card is locked.
- [ ] Details and overflow actions are disabled while the card is locked.
- [ ] Non-locked cards still allow opening the overflow menu.
- [ ] Focused component tests and browser verification pass.

## Architecture & Components

- `src/components/features/dashboard/cards/OpsBookingCard.tsx`
  - own row-level locked styling and `aria-disabled`
- `src/components/features/dashboard/cards/OpsBookingCardHeader.tsx`
  - own the collapse-toggle disabled behavior
- `src/components/features/dashboard/cards/OpsBookingCardActions.tsx`
  - own overflow-trigger locking rules
- `src/components/features/dashboard/cards/opsBookingCardUtils.ts`
  - keep action-policy disabled semantics as the single source of truth

## Data Flow & API Contracts

- No API or backend contract changes.
- UI contract change only:
  - pending lifecycle mutation => card is fully inert
  - done booking without pending mutation => menu remains discoverable with disabled items

## UI/UX States

- Loading/locked mutation state:
  - dimmed card
  - inert pointer surface
  - disabled details/menu/toggle controls
- Done state:
  - unchanged dimmed styling
  - overflow menu still openable to reveal disabled actions

## Edge Cases

- Mobile viewport where the collapse toggle is present.
- Done bookings where all menu items are disabled but should remain visible.
- Pending mutation state that resolves too quickly in the dev harness for stable visual capture.

## Testing Strategy

- Component tests:
  - locked card exposes inert state and disables mobile toggle
  - locked actions disable Details and overflow trigger
  - done-booking overflow menu remains visible with disabled items
- Manual browser proof:
  - existing ops bookings dev harness route
  - verify route loads and non-locked overflow menu still opens
  - document pending-state browser limitation explicitly

## Rollout

- No flag needed.
- Safe UI-only change in an isolated component stack.
