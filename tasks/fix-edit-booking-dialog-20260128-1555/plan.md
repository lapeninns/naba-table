---
task: fix-edit-booking-dialog
timestamp_utc: 2026-01-28T15:55:36Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Edit Booking dialog

## Objective

We will ensure Edit Booking opens the Edit dialog (not Details) on ops dashboard and ops bookings list so staff can update reservations reliably.

## Success Criteria

- [ ] Edit Booking opens `EditBookingDialog` on `/app/dashboard`.
- [ ] Edit Booking opens `EditBookingDialog` on `/app/bookings`.
- [ ] Details dialog is closed when Edit opens.

## Architecture & Components

- `OpsDashboardClient`: owns details/edit dialog state; wires handlers into summary list.
- `OpsBookingsClient`: owns details/edit dialog state; wires handlers into bookings table.
- `DashboardSummaryCard` → `BookingsList` → `OpsBookingCard`: pass `onEdit` handler.
- `EditBookingDialog`: existing dialog component, no changes required.

## Data Flow & API Contracts

- Ops edit uses `PATCH /api/ops/bookings/[id]` via `useOpsUpdateBooking`.
- Guest edit keeps `PUT /api/bookings/[id]` via `useUpdateBooking`.

## UI/UX States

- Edit: open only Edit dialog.
- Details: open only Details dialog.
- Close: both closed.

## Edge Cases

- Editing when Details is open.
- Editing a booking that was focused via URL param.

## Testing Strategy

- Unit: component-level test to assert Edit vs Details dialog open states in ops bookings client.
- Manual QA: Chrome DevTools MCP on `/app/dashboard` and `/app/bookings`.

## Rollout

- No feature flag; direct fix.

## DB Change Plan (if applicable)

- Not applicable.
