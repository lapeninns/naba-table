---
task: booking-list-table-assignments
timestamp_utc: 2026-01-20T16:51:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking List Table Assignments

## Objective

We will ensure the bookings list reflects table assignments so operators can see accurate table info.

## Success Criteria

- [ ] Bookings list shows assigned table(s) when present in data.
- [ ] Empty state only appears when no table assignment exists in data.

## Architecture & Components

- API: `src/app/api/ops/bookings/route.ts` — include table assignment data and map it to `tableAssignments`.
- UI: `components/dashboard/OpsBookingCard.tsx` — unchanged; already reads `tableAssignments`.
- Client: `src/components/features/bookings/OpsBookingsClient.tsx` — unchanged; passes mapped list items through.

## Data Flow & API Contracts

- GET `/api/ops/bookings` returns `OpsBookingsPage` items with `tableAssignments` and `requiresTableAssignment` populated.
- `tableAssignments` shape matches existing detail endpoint (`/api/ops/bookings/[id]`).

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- Bookings with no assignments (empty list) should show "No table assigned".
- Missing table inventory data should render `?` table number fallback (consistent with detail endpoint).

## Testing Strategy

- Unit: none planned (small server mapping change).
- Integration: verify list API payload contains `tableAssignments`.
- UI: manual QA via Chrome DevTools MCP on `/bookings`.

## Rollout

- Feature flag: N/A
- Exposure: 100%
- Monitoring: N/A
- Kill-switch: N/A

## DB Change Plan (if applicable)

- N/A
