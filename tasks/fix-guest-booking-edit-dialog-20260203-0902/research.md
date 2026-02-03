---
task: fix-guest-booking-edit-dialog
timestamp_utc: 2026-02-03T09:02:53Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix guest booking edit dialog for email link access

## Requirements

- Functional:
  - Guests opening the booking detail link from email on a new device can manage (edit/cancel) their reservation without triggering ops-only context errors.
  - Ops flows continue to use ops update mutation and ops services.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No regression to existing a11y semantics in dialog.
  - Keep edits scoped; no new UI primitives.
  - Preserve auth boundaries: guest routes must not require ops providers.

## Existing Patterns & Reuse

- Guest update mutation: `hooks/useUpdateBooking.ts` (calls `/api/bookings/:id`).
- Ops update mutation: `src/hooks/ops/useOpsUpdateBooking.ts` (requires `OpsServicesProvider`).
- Shared dialog UI: `components/dashboard/EditBookingDialog.tsx` used by both guest and ops pages.
- Booking detail page uses `ReservationDetailClient` (public route) to open `EditBookingDialog`.

## External Resources

- None.

## Constraints & Risks

- Must follow SDLC phases and create task artifacts.
- UI change requires Chrome DevTools MCP verification.
- `components/` is legacy; keep change minimal and compatible.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Split `EditBookingDialog` into a shared base and two typed exports:
  - `EditBookingDialog` (guest) uses `useUpdateBooking` only.
  - `EditBookingDialogOps` (ops) uses `useOpsUpdateBooking` within ops provider.
- Update ops call sites to import the ops export. This removes the ops hook from guest routes and prevents the provider error.
