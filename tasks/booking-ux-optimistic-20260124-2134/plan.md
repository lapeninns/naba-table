---
task: booking-ux-optimistic
timestamp_utc: 2026-01-24T21:34:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Booking UX + Optimistic Updates

## Objective

We will make Seat/Finish feel instant by removing artificial delays, keeping the list visible during refetch, applying optimistic status updates to the ops bookings list, and polishing motion/transition details on both ops dashboard and ops bookings while keeping brand tokens intact. Completed bookings should be excluded from upcoming/default views.

## Success Criteria

- [ ] Seat/Finish updates status immediately in the list.
- [ ] No full-list skeleton during background refetch.
- [ ] Upcoming/default views no longer show completed bookings.
- [ ] Errors rollback to the previous state and surface a toast.
- [ ] Check-out/no-show updates invalidate ops caches so completed bookings don't linger as checked-in.
- [ ] While Seat/Finish runs, other bookings are disabled only until the mutation resolves (refetch in background).
- [ ] Motion feels smooth (no jarring jumps), and `prefers-reduced-motion` is respected.
- [ ] Brand colors/typography unchanged.

## Architecture & Components

- `components/dashboard/BookingsTable.tsx`: refine list animation wrappers + updating indicator polish.
- `src/components/features/bookings/OpsBookingsClient.tsx`: remove artificial delay in handlers.
- `src/hooks/ops/useOpsBookingStatusActions.ts`: optimistic cache updates for ops bookings list/detail.
- `src/components/features/dashboard/OpsDashboardClient.tsx`: default filter + background refetch after lifecycle updates.
- `src/hooks/ops/useOpsBookingsTableState.ts`: upcoming statuses filter.
- `src/app/api/ops/bookings/[id]/*/route.ts`: invalidate ops summary/changes caches after lifecycle transitions.
- `src/components/features/dashboard/BookingsList.tsx` + `components/dashboard/BookingsTable.tsx`: lock other cards during seat/finish.
- `components/dashboard/OpsBookingCard.tsx`: refine hover/press/overlay transitions using existing tokens.

## Data Flow & API Contracts

- Lifecycle actions call `bookingService.checkInBooking` / `checkOutBooking`.
- Cache updates use React Query `setQueriesData` for `opsBookings.list` and `setQueryData` for detail.
- When realtime is disabled, ops summary/list polls on an interval to keep data fresh.
- Lifecycle APIs invalidate server-side ops caches on status changes.

## UI/UX States

- Initial load: full skeleton.
- Refetch: list remains visible + subtle "Updating…" indicator.
- Action pending: per-card overlay fades in smoothly, with clear affordance.
- Error: rollback + toast.
- Seat/Finish pending: other bookings are disabled until mutation completes, then refetch runs in background.

## Edge Cases

- Empty list with refetch in progress should not show a full skeleton.
- Focused booking detail cache should reflect optimistic status.
- Completed/no-show actions should not leave stale checked-in entries.

## Testing Strategy

- Manual QA: Seat/Finish on ops bookings list; verify status change + no full skeleton + smooth transitions.
- Confirm rollback path via simulated error.

## Rollout

- No feature flag; low-risk UX fix.
