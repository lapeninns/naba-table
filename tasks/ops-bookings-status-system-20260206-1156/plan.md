---
task: ops-bookings-status-system
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Bookings Status UI Single Source of Truth

## Objective

Unify all booking status presentation into one canonical module so the same status produces:

- consistent label and description
- consistent icon
- consistent badge classnames
- consistent list rail classnames

## Success Criteria

- [ ] Exactly one module defines status UI tokens.
- [ ] Ops list cards, status filters, and booking dialog use the canonical config.
- [ ] Removed/deleted duplicate configs without breaking imports.

## Scope / Files

- New canonical module:
  - `lib/ops/booking-status.ts`
- Consumers to update:
  - `src/components/features/booking-state-machine/BookingStatusBadge.tsx`
  - `src/components/features/bookings/OpsStatusFilter.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCardHeader.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCard.tsx`
  - `src/components/features/dashboard/booking-details/BookingDialog.tsx`
  - `src/components/features/dashboard/booking-details/utils.ts`
- Duplicates to remove (explicitly requested by user plan):
  - `src/components/features/dashboard/StatusBadge.tsx`
  - `src/components/features/dashboard/booking-details/components/BookingStatusBadge.tsx` (or refactor to use canonical config and keep if needed)

## Testing

- `pnpm typecheck`
- `pnpm lint`
- Spot-check: status badges/rails in Ops bookings list and booking dialog.
