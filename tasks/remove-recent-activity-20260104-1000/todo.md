# Implementation Checklist

## Setup

- [x] Remove `BookingChangeFeed` import from `OpsDashboardClient.tsx`.
- [x] Remove `useOpsBookingChanges` usage.

## Core

- [x] Update grid layout in `OpsDashboardClient.tsx` to remove the sidebar.
- [x] Make `DashboardSummaryCard` container full width.

## UI/UX

- [ ] Verify layout on different screen sizes.

## Tests

- [ ] Manual smoke test.

## Notes

- Assumptions: The user wants "Recent Activity" completely removed, including the data fetching hook.
