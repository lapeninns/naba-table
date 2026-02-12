---
task: ops-bookings-safe-actions
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Bookings Safe Actions (No-show Confirm + Undo + Toasts)

## Requirements

- Functional:
  - List card “Mark No Show” must require confirmation and show guest context.
  - Provide a short undo affordance after marking no-show.
  - Check-in/out remain single-tap (no confirm dialogs).
- Non-functional:
  - Provide consistent success/error feedback without building custom primitives.
  - Allow multiple per-booking pending actions without globally disabling other cards.

## Existing Patterns & Reuse

- Dialog confirm pattern already exists:
  - `src/components/features/bookings/components/OpsCancelBookingAlertDialog.tsx`
  - `src/components/features/dashboard/booking-details/BookingDialog.tsx` uses AlertDialog confirm for no-show.
- Optimistic lifecycle mutations already exist:
  - `src/hooks/ops/useOpsBookingStatusActions.ts` (optimistic patches + invalidations).

## Risk Notes

- Adding a new dependency (`sonner`) requires ensuring it does not conflict with existing z-index layers (Tooltip/Crisp).
