---
task: ops-dashboard-bookings-sort
timestamp_utc: 2026-01-20T17:48:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops dashboard “All” booking sort order

## Requirements

- Functional:
  - In the “All” filter on `app.nabatable.com/dashboard`, show **checked-in** bookings first.
  - Follow checked-in with **upcoming** bookings.
  - Push **completed** bookings to the end of the list.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing filtering/search/pagination controls.
  - Maintain list performance for large datasets.

## Existing Patterns & Reuse

- `src/components/features/dashboard/BookingsList.tsx` handles filtering + sorting for the dashboard list.
- Upcoming statuses are defined in the list filter (confirmed, PRIORITY_WAITLIST, pending, pending_allocation).
- Completed/finished statuses are grouped as completed, cancelled, no_show.
- Sort controls already support time/party/name sorting.

## External Resources

- None.

## Constraints & Risks

- Keep changes scoped to list ordering for the “All” filter.
- Avoid breaking the other filters (upcoming, seated, finished, no_show).

## Open Questions (owner, due)

- None (user approved recommended ordering).

## Recommended Direction (with rationale)

- For `filter === 'all'`, apply a **grouped sort**: checked-in first, upcoming second, completed/cancelled/no_show last, while preserving existing sort controls within each group. This keeps the dashboard operationally focused on active and upcoming bookings.
