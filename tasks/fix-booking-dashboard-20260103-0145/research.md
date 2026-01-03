---
task: fix-booking-dashboard
timestamp_utc: 2026-01-03T01:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Dashboard booking flows

## Requirements

- Functional:
  - Booking details dialog opens and renders correctly.
  - Assign table action works and persists.
  - Booking card interactions work (open/assign/cancel).
  - Cancellation flow completes and reflects updated state.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No new a11y regressions; keyboard flows work.
  - No sensitive data logged.

## Existing Patterns & Reuse

- Dashboard bookings list is rendered via `BookingsList` which maps `OpsTodayBooking` to `BookingDTO` and triggers `BookingDetailsDialogWrapper` through `OpsDashboardClient`.
- `BookingDetailsDialogWrapper` derives `restaurantId` and `timezone` from the booking source; if missing, `summary` becomes null and the dialog renders an empty state.
- Table assignment UI uses `TableAssignmentPanel` + `useTableAssignment` with `bookingService.getAssignmentContext`.

## External Resources

- None.

## Constraints & Risks

- Supabase is remote-only; use MCP for DB operations if required.
- UI change requires manual QA via Chrome DevTools MCP.
- Potential regression risk: booking details dialog expects restaurant metadata that is missing in current `BookingDTO` mapping.

## Open Questions (owner, due)

- Q: Which Supabase project/environment should be used for debugging?
  A: UNCONFIRMED (owner: github:@maintainers).
- Q: Exact repro steps and console/network errors?
  A: UNCONFIRMED (owner: github:@maintainers).
- Q: Should ops dashboard support cancel action directly from card/dialog, or only via status/no-show?
  A: UNCONFIRMED (owner: github:@maintainers).

## Recommended Direction (with rationale)

- Populate `BookingDTO` with `restaurantId` and `restaurantTimezone` in `BookingsList` so the details dialog can construct a valid summary and enable table assignment.
- If cancellation is required on ops dashboard, wire a cancel action to `bookingService.cancelBooking` with UI confirmation and query invalidation (subject to product expectation).
