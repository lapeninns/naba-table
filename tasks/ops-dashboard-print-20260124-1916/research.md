---
task: ops-dashboard-print
timestamp_utc: 2026-01-24T19:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: [feat.ops.print_bookings]
related_tickets: []
---

# Research: Ops Dashboard Booking Print

## Requirements

- Functional:
  - Add a Print button on the ops dashboard that opens a print-optimized booking list.
  - Printed list includes only: name, table number, notes, party size, time.
  - Print output respects current filters/search/sort and selected date.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keyboard accessible and screen reader-labeled print action.
  - Print view uses semantic table/list and preserves readability.
  - No sensitive data beyond requested columns.

## Existing Patterns & Reuse

- Ops dashboard uses `src/components/features/dashboard/OpsDashboardClient.tsx` with `BookingsFilterBar` and `DashboardSummaryCard`.
- Booking list UI uses `components/dashboard/OpsBookingCard.tsx` and list/table components.
- CSV export route exists at `src/app/api/ops/bookings/export/route.ts` for data access patterns.

## External Resources

- N/A

## Constraints & Risks

- Must use Shadcn UI primitives for any UI additions.
- Manual UI QA via Chrome DevTools MCP is required for UI change.
- Avoid printing full UI; must render dedicated print layout.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Create a dedicated print view (route or new window) that renders a compact table with only the required columns, driven by current filters/search/sort/date from ops dashboard state. This allows controlled layout and avoids printing the interactive UI.
