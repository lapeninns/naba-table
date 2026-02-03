---
task: ops-bookings-optimization
timestamp_utc: 2026-02-02T22:13:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Bookings Performance

## Objective

Virtualize the ops bookings list and replace pagination with infinite scrolling, while keeping booking actions and filters intact.

## Success Criteria

- [ ] Pagination UI removed; list scrolls continuously with infinite loading.
- [ ] Booking actions and filters remain correct.
- [ ] Inline callbacks remain memoized for search, status filter, and retry.

## Components

- `src/components/features/bookings/OpsBookingsClient.tsx`
- `components/dashboard/BookingsTable.tsx`
- `src/hooks/ops/useOpsBookingsList.ts`

## Testing Strategy

- `pnpm run typecheck`.
- DevTools MCP when env vars are available.
