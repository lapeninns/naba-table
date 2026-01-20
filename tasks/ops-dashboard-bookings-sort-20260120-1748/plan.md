---
task: ops-dashboard-bookings-sort
timestamp_utc: 2026-01-20T17:48:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops dashboard “All” booking sort

## Objective

We will reorder the “All” bookings list so checked-in bookings appear first, followed by upcoming, with completed/cancelled/no-show at the end, while keeping the current sort controls within each group.

## Success Criteria

- [ ] Checked-in bookings appear at the top of the “All” list sorted by the selected sort key.
- [ ] Upcoming bookings follow checked-in, sorted by the selected sort key.
- [ ] Completed/cancelled/no-show bookings are at the end of the list.
- [ ] Other filters (upcoming/seated/finished/no_show) remain unchanged.

## Architecture & Components

- `src/components/features/dashboard/BookingsList.tsx`: adjust sorting behavior for `filter === 'all'`.

## Data Flow & API Contracts

- No API changes. Ordering is client-side.

## UI/UX States

- No new states. Existing sort controls and pagination remain.

## Edge Cases

- Bookings with missing `startTime` should remain at the end within their group (current behavior).
- Unknown statuses (if any) should fall into the upcoming group by default to keep them visible.

## Testing Strategy

- Manual: verify ordering in “All” filter with mixed statuses.
- Regression: confirm other filters and sort selectors behave as before.

## Rollout

- No feature flag. Standard deploy.

## DB Change Plan (if applicable)

- Not applicable.
