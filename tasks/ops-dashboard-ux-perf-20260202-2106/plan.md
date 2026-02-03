---
task: ops-dashboard-ux-perf
timestamp_utc: 2026-02-02T21:06:50Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard UI/UX Smoothness & Performance

## Objective

Make the ops dashboard feel faster and smoother by reducing unnecessary re-renders and initial bundle cost while preserving behavior.

## Success Criteria

- [ ] Noticeably smoother search/filter/sort interactions under large booking lists.
- [ ] No behavioral regressions in booking actions or list ordering.
- [ ] Reduced render churn observed in DevTools (lower scripting time per interaction).

## Architecture & Components

- `src/components/features/dashboard/OpsDashboardClient.tsx`
  - Combine guest stats + tab counts in a single reduce.
  - Convert `BookingDetailsDialogWrapper` to dynamic import.
- `src/components/features/dashboard/BookingsList.tsx`
  - Pass stable `nowDate` reference to memoized booking cards.
- `components/dashboard/OpsBookingCard.tsx`
  - Already memoized; keep stable props.

## Data Flow & API Contracts

- No API changes.
- Dialog data fetching behavior unchanged.

## UI/UX States

- Loading/empty/error/success states unchanged.

## Edge Cases

- No bookings: counts remain zero and list empty states remain correct.
- Dialog open/close still works with dynamic import and open state.

## Testing Strategy

- Manual ops dashboard smoke.
- Chrome DevTools MCP: performance trace + Lighthouse (blocked without env vars).

## Rollout

- No feature flag.
- Deploy as standard change.
