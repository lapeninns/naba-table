---
task: db-latency
timestamp_utc: 2025-11-26T16:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Latency & DB Fetch Improvements

## Objective

Reduce repeated DB round-trips and surface timing visibility on hot ops read paths (dashboard summary/export) so that responses are faster and easier to monitor without changing data correctness.

## Success Criteria

- [ ] `getTodayBookingsSummary` avoids at least one DB query per call via cached restaurant metadata.
- [ ] Repeated dashboard/export calls for the same restaurant+date within 5s hit an in-memory cache instead of refetching DB.
- [ ] Timing logs emitted for summary and change-feed queries with duration metadata (visible via structured logger).
- [ ] No change to auth/authorization behavior and staleness capped at 5s for cached results.

## Architecture & Components

- `server/ops/bookings.ts`: wrap summary + change feed with LRU caches (per restaurant+date) using existing `server/capacity/lru-cache.ts`; add short TTL and cache stats logging.
- `server/restaurants/timezone.ts` (new helper) or extension in `server/supabase.ts`: cache restaurant metadata (id→timezone/name) with ~10m TTL.
- `lib/logger.ts`: reuse existing structured logger for timing spans; no changes to logger internals.

## Data Flow & API Contracts

- API routes `/api/ops/dashboard/summary` and `/api/ops/bookings/export` keep the same contract.
- Internal: `getTodayBookingsSummary(restaurantId, options)` first resolves timezone via cached metadata → either returns cached summary (if fresh) or fetches from Supabase and stores in cache before returning. Cache key: `${restaurantId}:${targetDate}`.
- Change feed helper (if used by polling clients) gets similar short-lived cache to cut repetitive reads within a polling window.

## UI/UX States

- None (backend-only change). Ensure errors and auth responses unchanged.

## Edge Cases

- Restaurant timezone updated → cache TTL is bounded; add manual `invalidateRestaurantMetaCache` helper callable from updates if needed.
- No bookings or missing customer data → cache still stores empty results; ensure nullables preserved.
- Cache stampede: keep single-flight per key by storing in-flight promise or using memoized fetch.

## Testing Strategy

- Unit: add small tests around cache helpers (hit/miss, TTL expiry, per-restaurant isolation) with vitest if feasible.
- Smoke: run `pnpm test:ops` (or closest) if applicable; otherwise targeted unit suite.
- Manual: call summary API twice for same restaurant+date and observe log durations/cache hit message.

## Rollout

- Config knobs: TTL env (fallback defaults) for summary and metadata caches; disable caching by setting TTL to 0.
- Monitoring: review structured logs for `duration_ms` fields; watch for errors in summary export.
- Kill-switch: set TTL envs to 0 or delete caches to revert to uncached path.

## DB Change Plan (if applicable)

- None; no migrations.
