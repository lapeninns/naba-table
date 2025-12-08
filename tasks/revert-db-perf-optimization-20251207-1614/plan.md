---
task: revert-db-perf-optimization
timestamp_utc: 2025-12-07T16:14:47Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Revert DB Performance Optimization

## Objective

Restore the database index state to match pre-task `db-perf-optimization-20251207-0620`, removing newly added indexes and recreating the ones that were dropped.

## Success Criteria

- [ ] `idx_bookings_active_window` and `booking_table_assignments_table_window_idx` are absent.
- [ ] `idx_allocations_window_gist`, `idx_allocations_restaurant`, and `bookings_customer_id_idx` exist with their original definitions.
- [ ] No long locks or errors during revert; commands run with `CONCURRENTLY`.

## Architecture & Components

- Target DB: Supabase Postgres via `SUPABASE_DB_URL` from `.env.local` (assumed staging).
- Tables affected: `bookings`, `booking_table_assignments`, `allocations`.

## Data Flow & API Contracts

- Pure schema/index revert; no RPC signature changes.

## UI/UX States

- N/A (database only).

## Edge Cases

- Index already missing/present: use `IF EXISTS`/`IF NOT EXISTS` to keep operations idempotent.
- CONCURRENT operations cannot run inside a transaction; run as separate statements.

## Testing Strategy

- Before/after catalog snapshots: `pg_indexes` queries stored in `artifacts/indexes-before.txt` and `artifacts/indexes-after.txt`.
- Verify exit criteria by inspecting `pg_indexes` results.

## Rollout

- One-time revert on the target environment; no feature flags.

## DB Change Plan

- Drop new indexes: `idx_bookings_active_window`, `booking_table_assignments_table_window_idx` (CONCURRENTLY).
- Recreate dropped indexes: `idx_allocations_window_gist`, `idx_allocations_restaurant`, `bookings_customer_id_idx` (CONCURRENTLY, IF NOT EXISTS).
- Confirm presence/absence post-change; no further backfill required.
