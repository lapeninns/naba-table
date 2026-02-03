---
task: ops-dashboard-perf3
timestamp_utc: 2026-02-02T21:44:20Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Perf Round 3

## Objective

Reduce remaining render and update overhead in the virtualized ops bookings list.

## Success Criteria

- [ ] Reduced re-measure churn in virtualized list.
- [ ] Fewer UI updates from realtime bursts.
- [ ] Search/filter retains responsiveness on large lists.
- [ ] No behavior regressions.

## Architecture & Components

- `src/components/features/dashboard/BookingsList.tsx`
  - Add row height cache keyed by booking id.
  - Add search index map and DTO cache.
- `src/hooks/ops/useBookingRealtime.ts`
  - Batch/ debounce external update toasts.
- `src/hooks/ops/useOpsTodaySummary.ts`
  - Use `select` to reduce downstream renders if safe.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- No changes to loading/empty/error states.

## Edge Cases

- Ensure caches invalidate when booking status/time changes.

## Testing Strategy

- `pnpm run typecheck`.
- Chrome DevTools MCP perf/a11y verification once env vars are present.
