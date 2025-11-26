---
task: db-latency
timestamp_utc: 2025-11-26T16:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Latency & DB Fetch Improvements

## Requirements

- Functional: reduce perceived latency for ops dashboard/export APIs that read bookings; avoid regressions to data correctness or auth (RLS, restaurant scoping).
- Non-functional: keep data reasonably fresh for ops (target staleness \<=5s for cached responses); no schema changes; follow Supabase remote-only; respect existing logging and env handling.

## Existing Patterns & Reuse

- Supabase service client is memoized in `server/supabase.ts`; tenant clients cached per restaurant header.
- Heavy read paths: `getTodayBookingsSummary` used by `/api/ops/dashboard/summary` and `/api/ops/bookings/export`; includes 3 sequential DB hits (restaurant timezone, bookings + table assignments, loyalty + profiles).
- Client-side caching via TanStack Query with custom stale/gc times in `lib/query/staleTimes.ts` and persistence in `lib/query/persist.ts`.
- Reusable in-memory cache utility `server/capacity/lru-cache.ts` already used elsewhere.
- Logging helper `lib/logger.ts` for structured logs (debug/info/warn/error) suitable for timing traces.

## External Resources

- Supabase recommendations on minimizing round-trips (single select with related tables, short-lived caching) — general guidance, no direct schema docs referenced.

## Constraints & Risks

- Must not exceed acceptable staleness for ops views; short TTL caching only.
- Supabase is remote-only; no migrations in this task.
- Potential multi-tenant concerns: caches must be keyed by restaurant and date; avoid cross-tenant leakage.
- Auth still enforced per request (membership check); caching must not bypass authorization.

## Open Questions (owner, due)

- What are the top P95/99 endpoints today? (owner: agent, due: later once traces available)
- Acceptable cache TTL for dashboard/export? (defaulting to 5s unless guidance provided)

## Recommended Direction (with rationale)

- Add lightweight in-memory caching around read-mostly booking summary/change feeds using existing LRU cache, keyed by restaurant+date with \<=5s TTL to cut duplicate DB trips during dashboard polling/export downloads.
- Cache restaurant metadata (timezone/name) separately with longer TTL (e.g., 10 minutes) because it rarely changes, removing one DB query per summary call.
- Add timing logs for hot queries (summary, change feed) using structured logger to surface slow spans and provide baseline P95 numbers.
- Keep client-side behavior unchanged; no schema or UI changes.
