---
task: fix-booking-dashboard
timestamp_utc: 2026-01-03T01:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Dashboard booking flows

## Objective

We will restore booking details dialog, assign table, booking card actions, and cancellation so operators can manage bookings reliably from the dashboard.

## Success Criteria

- [ ] Dialog, assignment, and cancellation actions work end-to-end.
- [ ] UI updates reflect backend state without console errors.

## Architecture & Components

- `OpsDashboardClient` -> `DashboardSummaryCard` -> `BookingsList` -> `OpsBookingCard` (details action)
- `BookingDetailsDialogWrapper` uses `useOpsBooking` and expects `restaurantId`/`timezone` from the booking source to build a summary.
- Table assignment uses `BookingDialog` -> `TableAssignmentPanel` -> `useTableAssignment`.

## Data Flow & API Contracts

- Ops booking details: `GET /api/ops/bookings/{id}` via `useOpsBooking`.
- Assignment: `GET /api/ops/bookings/{id}/assignment-context` and `POST /api/ops/bookings/{id}/assign-tables`.
- Cancellation (if required): `DELETE /api/ops/bookings/{id}` via `bookingService.cancelBooking`.

## UI/UX States

- Loading / Empty / Error / Success states verified.

## Edge Cases

- Booking list items missing `restaurantId`/`restaurantTimezone` should not break dialog.
- Past bookings should keep assignment actions disabled.

## Testing Strategy

- Run lint, typecheck, unit tests per package scripts.
- Manual QA via Chrome DevTools MCP for dialog, assignment, and cancellation flows.

## Rollout

- No new feature flags expected.

## DB Change Plan (if applicable)

- No DB schema changes expected.
