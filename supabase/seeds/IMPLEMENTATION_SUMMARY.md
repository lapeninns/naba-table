# Waterbeach Seed Utilities — Implementation Summary

## Current Files

1. **`white-horse-service-periods.sql`**
   - Creates the White Horse Pub (Waterbeach) restaurant, operating hours, service periods, zones, tables, allowed capacities, and baseline customers.
   - Designed to be idempotent so it can be re-run after a cleanup.

2. **`cleanup-keep-only-waterbeach.sql`**
   - Deletes every restaurant except White Horse and cascades related state (bookings, tables, holds, analytics, etc.).
   - Guard clauses ensure the script aborts if the target slug does not exist.

## Orchestration

- `supabase/seed.sql` is now the canonical full-data seed and only provisions White Horse.
- `supabase/utilities/init-seeds.sql` sources `../seed.sql`, which makes `pnpm run db:seed-only` the preferred command.
- `supabase/utilities/init-seeds-waterbeach.sql` remains for minimal resets where only `white-horse-service-periods.sql` is needed.

## Retired Assets (2025-11-07)

The following files were removed to avoid confusion:

- `intelligent-seed.sql`
- `schema-driven-seed.sql`
- `seed.sql.backup*`, `seed.sql.legacy-*`
- `seed-single-restaurant.sql`
- `today-bookings-seed.sql`, `stress-test-allocation.sql`, `capacity-fixtures.sql`, `smart-bookings.sql`, and other demo datasets

All references in package scripts have been removed; use the Waterbeach utilities above for any data refresh operations.
