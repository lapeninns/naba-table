---
task: ops-dashboard-virtualization
timestamp_utc: 2026-02-02T21:36:52Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Dashboard List Virtualization

## Requirements

- Replace pagination with virtualized full list in ops dashboard bookings.
- Preserve all booking actions, filters, sort, search, and a11y.
- Use TanStack React Virtual with window scrolling and variable heights.

## Existing Patterns & Reuse

- Bookings list is in `src/components/features/dashboard/BookingsList.tsx`.
- Realtime updates use `useBookingRealtime` and accept `visibleBookingIds`.

## External Resources

- TanStack React Virtual docs (already in lockfile but not dependency).

## Constraints & Risks

- Chrome DevTools MCP required for UI verification (blocked by missing env vars).
- Removing pagination is a UX change; must update list rendering and visible IDs.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use `useWindowVirtualizer` to avoid nested scrolling.
- Render rows using absolute positioning and measure element heights for expanded cards.
- Disable entry animations while scrolling to keep UX smooth.
