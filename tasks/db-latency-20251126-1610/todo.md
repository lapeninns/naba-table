---
task: db-latency
timestamp_utc: 2025-11-26T16:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add env-driven TTL defaults for caching (summary + restaurant meta).
- [x] Wire cache utilities for ops booking summary/change feed.

## Core

- [x] Implement restaurant metadata cache helper (timezone/name) with TTL and invalidation hook.
- [x] Add in-memory cache for `getTodayBookingsSummary` keyed by restaurant+date with single-flight.
- [x] (Optional) Cache change feed similarly if used by polling endpoints.
- [x] Add timing logs for summary/change feed queries.

## UI/UX

- [x] No UI changes (confirm API responses unchanged).

## Tests

- [x] Add/update unit tests for cache helpers (hit/miss, TTL, tenant isolation).
- [x] Run targeted test suite (e.g., `pnpm test:ops` or `pnpm test`).

## Notes

- Assumptions: ops views tolerate \<=5s staleness; restaurant metadata rarely changes.
- Deviations: none yet.
