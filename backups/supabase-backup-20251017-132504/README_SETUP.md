# Supabase Setup & Migration Guide

## 📋 Quick Start

### One-Click Database Setup

```bash
# Option 1: Reset database from scratch (runs migrations + seeds)
pnpm run db:reset

# Option 2: Only run migrations (create schema)
pnpm run db:migrate

# Option 3: Only seed data (populate tables)
pnpm run db:seed

# Option 4: Clean slate + verify
pnpm run db:full-reset && pnpm run db:verify
```

## 📁 Directory Structure

```
supabase/
├── README_SETUP.md              # This file
├── init-database.sql            # Single entry point for all migrations (applies in order)
├── init-seeds.sql               # Single entry point for all seed data
├── create-database.sql          # Legacy - orchestrates via \ir includes
├── wipe-public-schema.sql       # Drops all tables (use with caution!)
│
├── migrations/                  # Individual migration files (ordered by timestamp)
│   ├── 20250101000000_remote_schema.sql
│   ├── 20250115071800_add_booking_confirmation_token.sql
│   └── ... (more migrations)
│
├── seeds/                       # Individual seed files
│   ├── README.md
│   ├── seed.sql                 # Main restaurants & bookings
│   ├── seed-table-inventory.sql # Table data
│   ├── seed-today-bookings.sql  # Today's booking samples
│   └── manual/
│
├── manual-rollbacks/            # Emergency rollback scripts
│   └── 20251016092200_capacity_engine_rollback.sql
│
└── .branches/                   # Branch snapshots
```

## 🚀 Usage (Remote Supabase - No Docker Needed!)

### Workflow

```bash
# 1. Reset remote database (migrations + seeds)
pnpm run db:reset

# 2. Verify seeds were applied correctly
pnpm run db:verify

# 3. Done! Database is ready to use
```

**Note:** All commands work with your remote Supabase instance. No Docker required!

### Direct SQL Execution (Advanced)

```bash
# Via psql directly
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/init-database.sql

# With Docker
docker exec supabase_db_1 psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /workspace/supabase/init-database.sql
```

## 📜 What Each File Does

### Core Setup Files

| File                  | Purpose                                  | When to Use                                              |
| --------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `init-database.sql`   | Applies ALL migrations in correct order  | Running schema setup for first time or full reset        |
| `init-seeds.sql`      | Populates database with seed data        | After running migrations, for test data                  |
| `create-database.sql` | Legacy orchestrator (via `\ir` includes) | Backward compatibility - use `init-database.sql` instead |

### Cleanup Scripts

| File                     | Purpose                    | ⚠️ Warning                               |
| ------------------------ | -------------------------- | ---------------------------------------- |
| `wipe-public-schema.sql` | Drops entire public schema | **Destructive! Only on test databases!** |

### Manual Rollbacks

Located in `manual-rollbacks/`, these can reverse specific migrations if something breaks.

## 🔄 Migration Process

1. **Schema Creation** → All migrations applied in timestamp order
2. **Data Seeding** → Reference data, test restaurants, bookings, customers
3. **Verification** → Run `pnpm run db:verify` to check counts

## 🛠 Manual Database Operations

### Check current migrations applied

```sql
SELECT * FROM public._migrations
ORDER BY timestamp DESC
LIMIT 10;
```

### View all bookings

```sql
SELECT COUNT(*), status
FROM public.bookings
GROUP BY status;
```

### Clear specific data

```bash
# Just drop tables (keep schema)
pnpm run db:wipe

# Then reseed
pnpm run db:seed
```

## 📊 Seed Data Summary

After running `db:seed`, you'll have:

- **8 Restaurants** (The Railway, The George, etc.)
- **~480 Customers** (60 per restaurant)
- **~260 Bookings** (past/today/future mix)
- **128 Tables** (16 per restaurant)
- **2,800+ Today's Bookings** for demo (50 per restaurant)

## 🔐 Authentication

Admin access is configured for: `amanshresthaaaaa@gmail.com`

This user automatically gets full access to all restaurants when seeding.

## 🚨 Troubleshooting

### "Migration already applied" error

- Safe to re-run, migrations are idempotent
- Or: `pnpm run db:reset` to start fresh

### "Foreign key constraint" error

- Ensure migrations run before seeds
- Use `pnpm run db:full-reset` instead of manual commands

### "Table doesn't exist" error

- Run: `pnpm run db:migrate` to ensure schema is created

### Slow seeding?

- Normal for first run (260 bookings × 480 customers)
- Progress logged to console
- Subsequent runs use upserts (faster)

## 📝 Adding New Migrations

1. Create file: `supabase/migrations/TIMESTAMP_description.sql`
2. Add to `init-database.sql` with comment
3. Test with: `pnpm run db:reset`
4. Verify: `pnpm run db:verify`

## 📝 Adding New Seeds

1. Create file: `supabase/seeds/seed-description.sql`
2. Add section to `init-seeds.sql`
3. Test with: `pnpm run db:seed`

---

**Last Updated:** October 17, 2025  
**Status:** Production-Ready
