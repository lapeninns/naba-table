# Implementation Plan: Remove Recent Activity and Expand Booking List

## Objective

Remove the Recent Activity sidebar from the Operations Dashboard and expand the Booking List to take up the full width.

## Success Criteria

- [ ] "Recent Activity" section is gone from the dashboard.
- [ ] `DashboardSummaryCard` (Booking List) takes up the full width of the container on large screens.
- [ ] No console errors from unused hooks or missing components.

## Architecture & Components

- `OpsDashboardClient.tsx`: The main container component where the grid is defined.

## UI/UX States

- No changes to existing states, just layout modification.

## Edge Cases

- Mobile view: The sidebar was already stacked below, so removing it will just make it shorter.

## Testing Strategy

- Manual verification of the dashboard layout on desktop and mobile.

## Rollout

- Immediate. No feature flags requested.
