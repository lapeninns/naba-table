---
task: db-perf-optimization
timestamp_utc: 2025-12-07T06:20:52Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Pull Supabase project ref/DB URL from `.env.local` (do not commit); verify CLI auth.
- [x] Schema dump: `pg_dump --schema-only … > tasks/db-perf-optimization-20251207-0620/artifacts/schema-before.sql`.
- [ ] Capture key query samples from capacity/booking flows to drive index design (store in `artifacts/queries.sql`).

## Core

- [x] Propose index/constraint changes per hot table (bookings, assignments, holds, allocations, customers, analytics).
- [x] Author migration SQL (online-safe: CREATE INDEX CONCURRENTLY, NOT VALID constraints) in new migration file.
- [x] Apply migration via psql; output saved to `artifacts/db-diff.txt`.
- [ ] Regenerate `types/supabase.ts` after schema changes and reconcile code (attempted; reverted pending code alignment).

## UI/UX

- N/A (backend only).

## Tests

- [x] `pnpm typecheck`
- [ ] `pnpm test` (sanity) if schema changes affect shared types.
- [ ] Validate representative queries with `EXPLAIN (ANALYZE)` in staging; capture plans.

## Notes

- Assumptions: multi-tenant per-restaurant filters; time-window overlaps are dominant perf drivers.
- Deviations: Supabase typegen removed columns/views referenced in code; reverted `types/supabase.ts` to keep typecheck passing. Need follow-up reconciliation before committing regenerated types.

## Batched Questions

- Provide current row counts and pg_stat_statements for top slow queries to confirm index priorities.
