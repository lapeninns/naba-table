---
task: revert-db-perf-optimization
timestamp_utc: 2025-12-07T16:14:47Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Revert DB Performance Optimization

## Requirements

- Functional: undo all DB-side changes executed in task `db-perf-optimization-20251207-0620`, restoring the pre-change index set for bookings/capacity tables.
- Non-functional: remote-only; avoid long locks (use CONCURRENTLY); no data loss; preserve RLS and RPC compatibility; target staging connection defined in `.env.local`.

## Existing Patterns & Reuse

- Baseline index definitions captured in `tasks/db-perf-optimization-20251207-0620/artifacts/schema-before.sql`.
- The prior task added two indexes and dropped three (per `proposed-migration.sql`):
  - Added: `idx_bookings_active_window`, `booking_table_assignments_table_window_idx`.
  - Dropped: `idx_allocations_window_gist`, `idx_allocations_restaurant`, `bookings_customer_id_idx`.
- Index DDL for the dropped ones (from schema-before):
  - `CREATE INDEX idx_allocations_window_gist ON public.allocations USING gist ("window");`
  - `CREATE INDEX idx_allocations_restaurant ON public.allocations USING btree (restaurant_id);`
  - `CREATE INDEX bookings_customer_id_idx ON public.bookings USING btree (customer_id);`

## External Resources

- Postgres docs for CONCURRENT index operations (ensure online-safe drops/creates).

## Constraints & Risks

- Dropping/creating indexes must be `CONCURRENTLY` to minimize locking on hot tables.
- Connection string from `.env.local` contains secrets; do not log or commit.
- Ensure we target staging (assumption based on prior task); avoid accidental production impact.

## Open Questions (owner, due)

- Confirm environment (staging vs prod) for the connection in `.env.local`. (owner: eng, before execution)

## Recommended Direction (with rationale)

- Capture current index state for the affected tables.
- Drop the two newly added indexes.
- Recreate the three previously dropped indexes using their original definitions, with `IF NOT EXISTS` and `CONCURRENTLY` to keep the revert safe.
- Recheck index catalog to confirm restoration.
