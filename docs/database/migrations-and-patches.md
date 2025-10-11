# Supabase Migrations & Patch Registry

This registry catalogues every tracked Supabase migration and pnpm patch override. Use it to understand schema evolution and dependency tweaks without digging through directories.

> ⚠️ Remote policy reminders:
>
> - Never modify an existing migration once it has been pushed to the remote Supabase instance.
> - Coordinate before applying migrations to the shared remote database.
> - Keep patch files under `patches/` with the exact filenames referenced in `package.json`.

## How to Update This Registry

1. Add your new migration/patch file following established conventions.
2. Append a new entry in the timeline or patch table with summary and notes.
3. Cross-reference earlier entries instead of editing history when superseding behaviour.
4. Record any patch removals in the notes to preserve context.

## Migration Timeline

| Timestamp        | File                                                                                                                                                       | Summary                                                                           | Notes                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 2025-01-15 09:30 | [`20250115093000_add_profile_update_policies.sql`](../../supabase/migrations/20250115093000_add_profile_update_policies.sql)                               | Adds guarded RLS policies for `profile_update_requests` table.                    | Runs only when the table exists, ensuring idempotency.             |
| 2025-02-04 10:30 | [`20250204103000_auth_team_invites.sql`](../../supabase/migrations/20250204103000_auth_team_invites.sql)                                                   | Renames membership roles & introduces `restaurant_invites` with policies.         | Executed inside a transaction to keep role vocabulary consistent.  |
| 2025-02-04 11:45 | [`20250204114500_fix_membership_policy.sql`](../../supabase/migrations/20250204114500_fix_membership_policy.sql)                                           | Adds helper function `user_restaurants_admin()` and rewrites membership policy.   | Grants execute to `authenticated` + `service_role`.                |
| 2025-10-06 17:04 | [`20251006170446_remote_schema.sql`](../../supabase/migrations/20251006170446_remote_schema.sql)                                                           | Baseline snapshot of remote schema (extensions, enums, tables, functions).        | Foundation for subsequent incremental migrations.                  |
| 2025-10-06 17:05 | [`20251006170500_profile_update_requests.sql`](../../supabase/migrations/20251006170500_profile_update_requests.sql)                                       | Creates `profile_update_requests` idempotency table with unique constraint.       | Pairs with policy migrations below.                                |
| 2025-10-06 17:06 | [`20251006170600_add_profile_update_policies.sql`](../../supabase/migrations/20251006170600_add_profile_update_policies.sql)                               | Enables RLS and recreates policies on `profile_update_requests`.                  | Supersedes the guarded 202501 policy once table exists everywhere. |
| 2025-10-09 18:37 | [`20251009183743_seed_today_bookings.sql`](../../supabase/migrations/20251009183743_seed_today_bookings.sql)                                               | Seeds 50 bookings for QA for a specific restaurant.                               | Safe to rerun; enforces UTC timestamps.                            |
| 2025-10-10 16:50 | [`20251010165023_add_booking_option_and_reservation_columns.sql`](../../supabase/migrations/20251010165023_add_booking_option_and_reservation_columns.sql) | Adds `booking_option` to service periods and reservation settings to restaurants. | Includes `CHECK` constraints for sane values.                      |
| 2025-10-11 09:15 | [`20251011091500_add_has_access_to_profiles.sql`](../../supabase/migrations/20251011091500_add_has_access_to_profiles.sql)                                 | Adds `has_access` flag + index on profiles.                                       | Default `true` to avoid retrofits.                                 |

### Seed Files

- [`supabase/seed.sql`](../../supabase/seed.sql) — Eight Lapens Inns pubs with 260 bookings (100 past, 40 today, 120 future) plus related customers.
- [`supabase/seed-today-bookings.sql`](../../supabase/seed-today-bookings.sql) — Standalone helper mirroring the QA booking migration.

## pnpm Patch Overrides

| Package & Version  | Patch File                                                               | Summary                                                                          | Notes                                                            |
| ------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `tr46@0.0.3`       | [`patches/tr46@0.0.3.patch`](../../patches/tr46@0.0.3.patch)             | Switches `require("punycode")` to `require("punycode/")` for pnpm compatibility. | Prevents resolution issues without CommonJS default export shim. |
| `whatwg-url@5.0.0` | [`patches/whatwg-url@5.0.0.patch`](../../patches/whatwg-url@5.0.0.patch) | Applies the same punycode path fix to URL state machine dependency.              | Aligns Node ESM/CJS interop expectations.                        |

## One-Step Provisioning Script

To rebuild from scratch without sequencing files manually, run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/create-database.sql
```

This script imports the baseline snapshot and then applies each incremental migration via `\ir` directives.

## Backup & Clean Scripts

- [`scripts/backup-remote-db.sh`](../../scripts/backup-remote-db.sh) — Wraps `pg_dump` to create timestamped backups (requires `SUPABASE_DB_URL`).
- [`supabase/wipe-public-schema.sql`](../../supabase/wipe-public-schema.sql) — Drops/recreates `public` schema; run only post-backup.
- [`scripts/clean-remote-db.sh`](../../scripts/clean-remote-db.sh) — Sources env vars (supports `--env`), wipes schema, replays migrations, and seeds data.

Example workflow:

```bash
# Export secrets (or script --env .env.local with password)
SUPABASE_DB_URL="postgres://..." scripts/backup-remote-db.sh
scripts/clean-remote-db.sh --env .env.local
```

## Maintenance Checklist

- [ ] New migration created with timestamped filename.
- [ ] Migration summary added to timeline table.
- [ ] Seed files referenced if updated.
- [ ] Patch table updated when dependencies change.
- [ ] Links verified in Markdown preview.

Keeping this registry current ensures swift auditing of schema changes and dependency overrides.
