---
task: ops-realtime-hardening
timestamp_utc: 2026-02-05T08:41:15Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Realtime Hardening

## Objective

We will keep ops dashboard data fresh and resilient to realtime dropouts so that operators can trust the booking view without manual refresh.

## Success Criteria

- [ ] Summary data refreshes at least every 3 minutes even if realtime silently drops events.
- [ ] Bursty realtime events no longer trigger excessive summary refetches.
- [ ] UI shows a data freshness signal and indicates stale data when overdue.

## Architecture & Components

- `lib/ops/realtime.ts`: centralized timing constants for summary polling, safety polling, and invalidation debounce.
- `useOpsTodaySummary`: debounced invalidations + safety poll logic.
- `ConnectionStatusBeacon`: shows freshness based on summary `dataUpdatedAt`.
- `OpsDashboardHeader`: passes freshness props to the beacon.

## Data Flow & API Contracts

- No API changes. Query refetches still call `bookingService.getTodaySummary`.

## UI/UX States

- Connected + fresh: shows "Live" with last updated age.
- Connected + stale: shows "Stale" and age.
- No data yet: freshness indicator hidden.

## Edge Cases

- Initial load (no dataUpdatedAt): do not show freshness.
- Background tabs: no safety polling.
- Realtime disabled/unhealthy: existing polling fallback remains.

## Testing Strategy

- Unit: none (changes are orchestration).
- Integration: sanity check summary refetches after debounce.
- Manual: verify freshness indicator, stale state, and no layout regressions.

## Rollout

- No feature flag. Ship directly.

## DB Change Plan (if applicable)

- Not applicable.
