---
task: perf-floor-plan-load
timestamp_utc: 2026-02-12T15:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan: Speed Up Floor Plan Load

## Objective

Reduce the time-to-interactive for `/app/floor-plan` by removing unnecessary backend work and avoiding sequential Supabase awaits.

## Implementation

1. Add a lean tables listing function (no summary) in `server/ops/tables.ts`.
2. Update `/api/ops/tables` to accept `includeSummary=0` (default true).
3. Update `/api/ops/tables/timeline` to accept `includeSummary=0` (default true).
4. Update `getTableAvailabilityTimeline` to:
   - optionally skip summary computation, and
   - parallelize independent calls (schedule, tables, turn bands, bookings).
5. Update floor plan client calls to request `includeSummary=0` for tables and timeline.
6. Update floor plan UI to render once table layout is available (timeline is additive and must not block the whole view).

## Verification

- Typecheck + lint.
- Manual: load `/app/floor-plan` and check Network for reduced request time and fewer DB reads (proxy via Server Timing if needed).
