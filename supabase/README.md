# Supabase Directory Structure

This directory contains all Supabase-related database files for the SajiloReserveX project.

## 📁 Directory Structure

```
supabase/
├── README.md                    # This file
├── migrations/                  # Database schema migrations
│   └── 20251019102432_consolidated_schema.sql
├── seeds/                       # Seed data for development/testing
│   └── seed.sql                # Sample data (restaurants, bookings, etc.)
└── utilities/                   # Helper scripts for database operations
    ├── init-database.sql       # Migration orchestration (for db:reset)
    └── init-seeds.sql          # Seed orchestration (for db:reset)
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

**Current Migration:**

- `20251019102432_consolidated_schema.sql` - Complete database schema including all tables, functions, triggers, and RLS policies

### seeds/

Contains seed data files for populating the database with sample data.

**Current Seed:**

- `seed.sql` - Sample data including:
  - 4 employee profiles (owner, manager, host, server)
  - 2 restaurants with full configuration
  - 10 tables across 4 zones
  - 6 customers with profiles
  - 7 bookings in various states
  - Supporting data (service periods, loyalty programs, etc.)

### utilities/

Helper scripts that orchestrate migrations and seeds for the `pnpm` commands.

- `init-database.sql` - Wrapper for migration application (used by `db:reset`)
- `init-seeds.sql` - Wrapper for seed execution (used by `db:reset`, `db:seed-only`)

## 🔧 Available Commands

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `pnpm run db:reset`     | Reset database: apply migrations + seeds |
| `pnpm run db:migrate`   | Apply migrations only                    |
| `pnpm run db:seed-only` | Apply seeds only                         |
| `pnpm run db:push`      | Push migrations via Supabase CLI         |
| `pnpm run db:pull`      | Pull schema from remote                  |
| `pnpm run db:status`    | Check migration status                   |

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

**Last Updated**: October 19, 2025
