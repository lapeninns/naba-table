---
task: fix-edit-booking-dialog
timestamp_utc: 2026-01-28T15:55:36Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Edit Booking dialog wiring

## Requirements

- Functional:
  - On ops dashboard and ops bookings list, clicking Edit Booking opens Edit dialog (not Details).
  - Opening Edit closes Details if open.
  - Ops Edit Booking uses ops endpoint (PATCH `/api/ops/bookings/[id]`) to avoid 405 on guest endpoint.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing a11y affordances (buttons, focus order).
  - No additional data exposure; no DB changes.

## Existing Patterns & Reuse

- Ops list/details: `BookingDetailsDialogWrapper` used in `OpsDashboardClient` and `OpsBookingsClient`.
- Edit dialog exists: `components/dashboard/EditBookingDialog.tsx` (already used in guest booking detail).

## External Resources

- None.

## Constraints & Risks

- UI change requires Chrome DevTools MCP manual QA + artifacts.
- Keep changes minimal and aligned with existing ops flows.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Wire Edit Booking to open `EditBookingDialog` with explicit state in ops clients, closing details dialog first.
