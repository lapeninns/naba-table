# ADR: Temporal Integrity and Overlap Prevention

## Status

Accepted

## Context

The SajiloReserveX platform manages high-throughput booking, table allocation, and hold workflows. Historical schema drift and ad-hoc constraints risk:

- Silent double-bookings or overlapping holds.
- Inconsistent timestamps and UUID defaults.
- Difficulties recreating schema in new environments.

## Decision

1. Standardize on:
   - `timestamptz` with `DEFAULT now()` for server-side timestamps.
   - `gen_random_uuid()` for UUID defaults (with `pgcrypto`).
2. Use GiST-based exclusion constraints to enforce:
   - No overlapping `allocations` for the same `(resource_type, resource_id)` when `shadow = false`.
   - No overlapping `table_hold_windows` for the same `table_id`.
3. Add business-level uniqueness:
   - `(restaurant_id, lower(table_number))` for `table_inventory`.
   - `(restaurant_id, lower(name))` for `zones`.
   - Normalized email/phone uniqueness for `customers` (per restaurant).
4. Treat `table_adjacencies` as an undirected graph via canonical `(LEAST, GREATEST)` uniqueness.
5. Provide a reusable `set_updated_at()` trigger and index strategy for hot paths.

## Consequences

- Stronger safety: overlapping bookings and holds are structurally prevented.
- Some writes will now fail fast with `unique_violation` or `exclusion_violation` if they conflict; app must map these to user-friendly errors.
- Schema is reproducible in CI and new environments without manual patching.

## Implementation Links

- `supabase/migrations/001_blockers.sql`
- `supabase/migrations/002_integrity.sql`
- `supabase/migrations/003_index_triggers.sql`
- `supabase/migrations/004_backfill_staging.sql`
- `supabase/migrations/rollback_001_003.sql`
- `docs/db-strict-constraints-runbook.md`
