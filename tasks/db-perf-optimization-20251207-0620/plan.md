---
task: db-perf-optimization
timestamp_utc: 2025-12-07T06:20:52Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Database Performance Optimization

## Objective

Design and stage a performance-optimized Postgres/Supabase schema for reservations (bookings, capacity, holds, customers, analytics) that lowers P95 query latency without breaking existing RPCs or RLS.

## Success Criteria

- [ ] Key capacity queries (assign/confirm/unassign tables) run with index-assisted plans; no sequential scans on `booking_table_assignments`/`allocations` for restaurant-scoped window lookups.
- [ ] Bookings list/export (filtered by restaurant_id, booking_date, status) P95 DB latency < 200 ms at current row counts; query plans show index usage.
- [ ] Analytics/observability inserts remain write-friendly (no lock-heavy migrations; fillfactor/defaults acceptable).
- [ ] `types/supabase.ts` regenerated after changes; CI typecheck passes locally.

## Architecture & Components

- Source of truth: staging Supabase project (ref from env) via Supabase CLI dump.
- Target tables/index work:
  - `bookings`: composite index on (restaurant_id, booking_date, status, start_time) covering common list filters; partial index for active statuses (e.g., pending/confirmed/seated).
  - `booking_table_assignments`: GiST index on (restaurant_id, assignment_window) and btree on (booking_id) + covering (table_id, start_at, end_at); consider exclusion to prevent overlapping per table.
  - `allocations`: GiST on (restaurant_id, resource_type, resource_id, window); exclusion constraint on overlapping windows per resource when `shadow=false`.
  - `table_holds` + `table_hold_members`: btree on (restaurant_id, zone_id, start_at, end_at); index hold members by (hold_id) and (table_id).
  - `table_inventory`: unique (restaurant_id, table_number); index (restaurant_id, capacity, active) for availability lookups.
  - `customers`/`customer_profiles`: unique per-restaurant email/phone normalized columns; index (restaurant_id, email_normalized) and (restaurant_id, phone_normalized) using `text_pattern_ops` if needed.
  - `analytics_events`/`observability_events`: narrow index on (restaurant_id, occurred_at/created_at) for time-bounded exports; consider partitioning later if volume high.
- Data type hygiene: migrate time columns to `timestamptz`; ensure range columns use `tsrange`/`tstzrange`; tighten integer sizes where safe (capacity, party_size → smallint if bounds allow); keep JSON only for metadata fields.

## Data Flow & API Contracts

- Keep existing RPC signatures intact. Any column renames/additions must be additive or accompanied by backward-compatible views.
- Supabase clients live in `server/supabase.ts` and `lib/supabase/*`; no expected client code changes once types regenerate.

## UI/UX States

- N/A (backend-only change). No UI impact expected.

## Edge Cases

- Overlapping table assignments/allocations must still be prevented (exclusion constraints must match current business rules for shadow/maintenance rows).
- Historical/archived bookings should avoid index bloat—use partial indexes scoped to recent windows if row counts are large.
- Long-running index builds on large tables; need concurrent creation and optional throttling.

## Testing Strategy

- Schema dump baseline: `supabase db dump --schema-only --project-ref <ref> > artifacts/schema-before.sql`.
- Generate candidate indexes/constraints via SQL migration; dry-run with Supabase CLI (`supabase db push --dry-run` or `supabase db reset --dry-run` equivalent) if available.
- Validate query plans with representative SQL (capacity + booking list) using `EXPLAIN (ANALYZE, BUFFERS)` against staging; capture in `artifacts/`.
- Regenerate types: `supabase gen types typescript --project-id <ref> --schema public > types/supabase.ts` and run `pnpm typecheck`.

## Rollout

- Apply to staging first; monitor pg_stat_statements and app latency for 24h.
- Production rollout in a low-traffic window; create indexes concurrently; keep old indexes until new ones verified, then drop concurrently if superseded.
- Monitoring: pg_stat_statements, Supabase metrics for CPU/IO; app APM for key endpoints.
- Kill-switch/rollback: drop new indexes/constraints concurrently; revert column type changes via casts only if needed; keep migrations idempotent where possible.

## DB Change Plan

- Target envs: staging → production.
- Backup reference: confirm PITR/backup status before prod apply (Supabase PITR enabled by default; verify snapshot recency).
- Dry-run evidence: capture schema dump + planned SQL in `artifacts/db-diff.txt`.
- Backfill strategy: if new NOT NULL/unique constraints added, prefill defaults and validate with `NOT VALID` + `VALIDATE CONSTRAINT` to avoid full table rewrites.
- Rollback plan: drop new indexes/constraints; revert columns with `USING` casts only if absolutely necessary.
