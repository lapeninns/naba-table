---
task: realtime-hardening
timestamp_utc: 2026-01-25T12:12:46Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN]
related_tickets: []
---

# Implementation Plan: Realtime Hardening (Ops)

## Objective

We will make ops bookings data reliably realtime by closing list update gaps, enabling realtime by default, and ensuring polling acts only as a fallback, so operators see up-to-date status without excessive network churn.

## Success Criteria

- [ ] Ops bookings list updates on bookings table changes when realtime is enabled.
- [ ] Summary/heatmap/changes feed remain consistent with list updates.
- [ ] Realtime is enabled by default unless explicitly disabled via env.
- [ ] Polling only occurs when realtime is disabled or unhealthy.
- [ ] No broad cache invalidation; keys scoped by restaurant/date.

## Architecture & Components

- Realtime client: `src/lib/supabase/realtime-client.ts` (existing).
- Realtime hooks:
  - `useBookingRealtime` (allocations + assignments).
  - `useOpsTodaySummary` (bookings + related tables).
  - `useOpsBookingChanges`, `useOpsBookingHeatmap` (existing).
- List data: `useOpsBookingsList` (polling + list queries).

## Data Flow & API Contracts

- No API changes; only client query invalidation and subscription wiring.
- React Query keys:
  - `queryKeys.opsBookings.list(...)`
  - `queryKeys.opsDashboard.summary(...)`

## UI/UX States

- No new UI states planned.
- Polling indicator behavior unchanged.

## Edge Cases

- Realtime enabled but channel unhealthy: fallback polling should activate.
- Restaurant or date filter changes should rebind subscriptions safely.
- High-frequency updates should debounce invalidations.

## Testing Strategy

- Manual QA (DevTools MCP) for ops dashboard list + summary.
- Simulate realtime off/on and connection interruptions.
- Spot-check list updates for status transitions (check-in/out, no-show).

## Rollout

- Feature flag: `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN` (existing).
- No staged rollout changes; behavior improves under existing flag.

## DB Change Plan (if applicable)

- N/A
