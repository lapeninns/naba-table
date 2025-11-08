# Waterbeach Seed Utilities

This directory now contains **only the SQL helpers required to operate the Waterbeach / White Horse Pub dataset**. All multi-restaurant and schema-driven generators have been retired to keep the system focused on the single live venue.

## Available Files

| File                               | Purpose                                                                                                                                                   | How to run                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `white-horse-service-periods.sql`  | Seeds the canonical White Horse Pub (Waterbeach) fixtures. Includes restaurant record, service periods, zones, tables, and allowed capacities.            | `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/white-horse-service-periods.sql`  |
| `cleanup-keep-only-waterbeach.sql` | Deletes every restaurant except White Horse from an existing database and cascades related data. Useful when legacy data leaked into remote environments. | `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/cleanup-keep-only-waterbeach.sql` |

## Recommended Flow

1. **Full refresh (remote only)**

   ```bash
   pnpm run db:reset
   ```

   This truncates tables via `supabase/seed.sql` (Waterbeach-only) and reseeds everything in one pass.

2. **Restore Waterbeach fixtures only**

   ```bash
   source .env.local
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/white-horse-service-periods.sql
   ```

3. **Clean up stray data**

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/cleanup-keep-only-waterbeach.sql
   ```

4. **Dump current database seed data (NEW!)**

   ```bash
   ./scripts/dump-seed-data.sh
   ```

   Exports all current data to `supabase/seeds/dumps/` for backup or migration.

## Notes

- These scripts assume Supabase environment variables are available (see `.env.local`).
- All files override data via `TRUNCATE`/`DELETE`. Do **not** run against production without backups.
- Legacy generators (`intelligent-seed.sql`, `schema-driven-seed.sql`, etc.) were removed on 2025-11-07. See `SEED_DATA_SUMMARY.md` for context.
