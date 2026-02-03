---
task: ops-dashboard-optimization
timestamp_utc: 2026-02-02T20:26:55Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Performance Optimization

## Objective

We will reduce render cost and UI jank on the ops dashboard while keeping behavior identical.

## Success Criteria

- [ ] Search input remains responsive under large booking lists.
- [ ] No regressions in filters, sorting, pagination, or booking actions.
- [ ] Reduced recalculation work during per-minute updates.
- [ ] Chrome DevTools MCP shows improved scripting/CPU time during list interactions.

## Architecture & Components

- `src/components/features/dashboard/OpsDashboardClient.tsx`
  - Add deferred search value.
  - Track calendar open state and gate heatmap fetch.
  - Use summary totals for header badges.
- `src/components/features/dashboard/BookingsList.tsx`
  - Memoized filtering/sorting with deferred search value.
  - Avoid `now` dependency unless required.
  - Memoize DTO mapping.
- `src/components/features/dashboard/HeatmapCalendar.tsx`
  - Expose `onOpenChange` to allow lazy loading heatmap.
- `components/dashboard/OpsBookingCard.tsx`
  - Memoize component to reduce re-renders when props stable.

## Data Flow & API Contracts

- No API changes.
- Heatmap fetch uses existing `useOpsBookingHeatmap` but enabled only when calendar opens.

## UI/UX States

- Loading/empty/error/success states remain unchanged.

## Edge Cases

- `searchQuery` empty: no extra filtering cost.
- `filter` not `attention`: avoid `now`-dependent filtering.
- Heatmap not loaded: header still shows counts via summary totals.

## Testing Strategy

- Manual smoke on ops dashboard flows.
- Chrome DevTools MCP: performance + a11y verification.

## Rollout

- No feature flag.
- Deploy as standard change; monitor logs and user feedback.
