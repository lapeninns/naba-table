---
task: fix-ops-dashboard-cancel
timestamp_utc: 2026-02-03T17:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Cancel Button

## Objective

We will enable ops users to cancel bookings from the Ops dashboard so that cancellations execute the existing backend flow and update UI state.

## Success Criteria

- [ ] Clicking "Cancel Booking" in the ops dashboard triggers the cancellation flow (dialog + mutation).
- [ ] Booking status updates in list/detail views and toast feedback appears.

## Architecture & Components

- `src/components/features/bookings/OpsBookingsClient.tsx`: wire `onCancel` to cancel flow.
- `components/dashboard/OpsBookingCard.tsx`: emits `onCancel` callback.
- `src/components/features/dashboard/OpsDashboardClient.tsx`: handle cancel request and confirmation dialog.
- `src/components/features/dashboard/DashboardSummaryCard.tsx`: plumb `onCancel` into summary list.
- `src/components/features/dashboard/BookingsList.tsx`: pass `onCancel` to `OpsBookingCard`.
- `src/hooks/ops/useOpsCancelBooking.ts`: mutation for cancellation (reuse).

## Data Flow & API Contracts

Endpoint: `DELETE /api/ops/bookings/:id`
Response: `{ id: string, status: string }`
Errors: `{ error: string, code?: string }` (existing contract).

## UI/UX States

- Confirmation dialog (if already present in flow), loading/pending, error toast, success toast.

## Edge Cases

- Attempt cancellation past cutoff returns 403 with `CUTOFF_PASSED`.
- Cancel action disabled for past-day bookings (existing UI rule).

## Testing Strategy

- Unit: N/A (wire-up change only).
- Integration: verify cancel action triggers mutation and refreshes list.
- E2E: N/A (unless existing coverage requires update).
- Accessibility: ensure keyboard activation still works for menu item and dialog.

## Rollout

- Feature flag: N/A (existing behavior fix).
- Monitoring: review ops logs/toast for errors.
- Kill-switch: revert to previous handler if needed.

## DB Change Plan (if applicable)

- N/A.
