---
task: ops-bookings-safe-actions
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Bookings Safe Actions

## Objective

Make Ops booking lifecycle actions safer and more legible during busy service:

- Confirm no-show from list cards with guest context.
- Add global toasts (Sonner) for success/error and “Undo” after marking no-show.
- Track pending state per-booking (no global “disable all other cards” lock).
- Show pending feedback at the action button level (avoid obscuring card content).

## Success Criteria

- [ ] No-show requires explicit confirmation and then shows a 5s Undo toast.
- [ ] Check-in/out success and error feedback is visible via toasts.
- [ ] Multiple bookings can be actioned concurrently; other cards are not disabled globally.
- [ ] No redundant list-level `refetch()` after lifecycle actions (optimistic + invalidation suffice).

## Scope / Files

- Global toast system:
  - `components/ui/sonner.tsx` (new)
  - `components/LayoutClient.tsx` (mount `<Toaster />`)
  - `package.json`, `pnpm-lock.yaml` (dependency)
- Safe no-show + undo + per-booking pending:
  - `src/components/features/bookings/OpsBookingsClient.tsx`
  - `components/dashboard/BookingsTable.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCard.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCardActions.tsx`

## Testing

- `pnpm typecheck`
- `pnpm lint`
- Manual QA in DevTools MCP: confirm dialog, undo toast, concurrent actions, and no UI deadlocks.
