# Research: Remove Recent Activity and Expand Booking List

## Requirements

- Functional:
  - Remove the "Recent Activity" sidebar from the operations dashboard.
  - Expand the "Booking List" (DashboardSummaryCard) to take up the full available width of its container.
- Non-functional:
  - Maintain responsiveness for mobile and tablet views.
  - Ensure no unused hooks or imports remain.

## Existing Patterns & Reuse

- The dashboard uses a grid system (`xl:grid-cols-12`) with `xl:col-span-9` for the main content and `xl:col-span-3` for the sidebar.
- Removing the grid and letting the main content div be full-width is the simplest approach.

## External Resources

- N/A

## Constraints & Risks

- None identified. Simple UI change.

## Open Questions

- None.

## Recommended Direction

- Modify `src/components/features/dashboard/OpsDashboardClient.tsx`.
- Remove `BookingChangeFeed` import and `useOpsBookingChanges` hook.
- Remove the grid container or set it to a single column.
- Remove the `aside` element.
- Update the main column div to be full width.
