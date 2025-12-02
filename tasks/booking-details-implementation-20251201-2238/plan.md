---
task: booking-details-implementation
timestamp_utc: 2025-12-01T22:38:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Details Component

## Objective

Enable the dashboard booking-details feature to display and update booking information using existing Supabase-backed services, with a11y/perf compliance.

## Success Criteria

- [ ] Booking details render for a booking ID with guest, table, occasion, and status info.
- [ ] Actions available per existing API (e.g., status update, notes) work and show confirmation/errors.
- [ ] Loading/empty/error states implemented and accessible.
- [ ] Perf/a11y budgets from root met.

## Architecture & Components

- `src/components/features/dashboard/booking-details`: compose UI from existing primitives.
- Hooks: reuse `useOpsBooking`, `useOpsBookingLifecycleActions`, `useOpsTableAssignmentActions`.
- Services: extend `bookingService` with assignment-context fetch; keep direct assignment endpoints.
- Normalize booking detail data into `OpsTodayBooking` shape in the wrapper before passing to UI.

## Data Flow & API Contracts

- Read: `GET /api/ops/bookings/:id` via `bookingService.getBooking` → map to `OpsTodayBooking`.
- Assignment context: `GET /api/ops/bookings/:id/assignment-context` via new service method → `useAssignmentContext`.
- Actions: lifecycle mutations via `useOpsBookingLifecycleActions`; direct assign/unassign via booking service.
- Errors: surface via existing toast hooks; bubble network errors in UI components.

## UI/UX States

- Loading skeleton/spinner.
- Empty (booking not found) — hide dialog if data missing after fetch.
- Error (fetch failed).
- Success (details with actions).

## Edge Cases

- Missing related data (guest, table) should fallback gracefully.
- Network failures show retry.
- Auth-required scenarios handled via existing guards.

## Testing Strategy

- Unit tests for component rendering given mocked data.
- Integration test for hooks/services if present.
- Accessibility checks (axe) in verification.

## Rollout

- No new flag planned unless required; fallback to existing dashboard gating.
- Monitoring: rely on existing logging/observability for ops dashboard.

## DB Change Plan (if applicable)

- None anticipated; reuse existing schema.
