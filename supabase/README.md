# Supabase Directory Structure

This directory contains all Supabase-related database files for the SajiloReserveX project.

## 📁 Directory Structure

```
supabase/
├── README.md                    # This file
├── migrations/                  # Database schema migrations
│   ├── 20251019102432_consolidated_schema.sql
│   ├── ...                      # Timestamped change scripts
│   └── _archive/                # Legacy dumps & placeholders (kept for history)
├── seed.sql                    # Canonical Waterbeach dataset
├── seeds/                      # Targeted helper scripts (Waterbeach only)
│   ├── white-horse-service-periods.sql
│   └── cleanup-keep-only-waterbeach.sql
└── utilities/                   # Helper scripts for database operations
    ├── init-database.sql       # Migration orchestration (for db:reset)
    ├── init-seeds.sql          # Seed orchestration (for db:reset)
    └── init-seeds-waterbeach.sql # Minimal Waterbeach seed wrapper
```

## 🚀 Quick Start

### Apply Migrations (First Time Setup)

```bash
supabase db push
```

### Seed the Database

```bash
pnpm run db:seed-only
```

### Reset Database (Migrations + Seeds)

```bash
pnpm run db:reset
```

## 📝 File Descriptions

### migrations/

Contains all database schema migrations. Migrations are applied via:

- `supabase db push` - Push migrations to remote database
- `supabase migration list` - Check migration status

**Highlights:**

- `20251019102432_consolidated_schema.sql` – Baseline schema (tables, functions, triggers, RLS).
- `20251101104500_reinstate_support_tables.sql` – Restores `merge_rules`, formalises `waiting_list`, and captures marketing `leads`.
- `_archive/` retains prior `remote_schema` dumps/comment-only stubs for auditability.

### seed.sql + seeds/

- `seed.sql` – canonical Waterbeach-only dataset (White Horse Pub). Inserts owner, restaurant, zones, tables, allowed capacities, service periods, bookings, holds, analytics, etc.
- `seeds/white-horse-service-periods.sql` – idempotent helper that recreates service periods/tables for the single venue. Useful after partial cleanups.
- `seeds/cleanup-keep-only-waterbeach.sql` – deletes any non-White-Horse restaurants plus cascading records.

> All other seed variants (intelligent/schema-driven/demo) were removed on 2025-11-07.

### utilities/

Helper scripts that orchestrate migrations and seeds for the `pnpm` commands.

- `init-database.sql` - Wrapper for migration application (used by `db:reset`)
- `init-seeds.sql` - Wrapper for seed execution (used by `db:reset`, `db:seed-only`) – sources `../seed.sql`.
- `init-seeds-waterbeach.sql` - Minimal loader for `seeds/white-horse-service-periods.sql`.

## 🔧 Available Commands

| Command                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| `pnpm run db:reset`       | Reset database: apply migrations + seeds     |
| `pnpm run db:migrate`     | Apply migrations only                        |
| `pnpm run db:seed-only`   | Apply seeds only                             |
| `pnpm run db:push`        | Push migrations via Supabase CLI             |
| `pnpm run db:pull`        | Pull schema from remote                      |
| `pnpm run db:status`      | Check migration status                       |
| `./scripts/db-cleanup.sh` | Dry-run backup + migration archival workflow |

## ⚠️ Important Notes

1. **Remote Only**: This project uses remote Supabase only (no local Docker instance)
2. **Migrations**: Always use `supabase db push` to apply schema changes
3. **Seeds**: Seed script uses `TRUNCATE` - only run against non-production databases
4. **Environment**: Ensure `SUPABASE_DB_URL` is set in `.env.local`

## 🗂️ Ignored Files

The following directories are auto-generated and git-ignored:

- `.temp/` - Temporary Supabase CLI files
- `.branches/` - Supabase branching metadata

---

## 🧭 Notable Tables

- `merge_rules`: Defines merge-capacity heuristics for table combinations.
- `waiting_list`: Tracks guests awaiting allocation for a specific date/time window.
- `leads`: Stores marketing sign-ups from `/api/lead`.

> Tip: Run `./scripts/db-cleanup.sh --apply` after regenerating remote schema to back up, archive dump-style migrations, and refresh `supabase/schema.sql` plus `types/supabase.ts`.

**Last Updated**: November 1, 2025
