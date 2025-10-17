# Supabase Seeds Directory

## 📋 Overview

This directory contains all seed data scripts for populating the database with reference and test data.

## 🎯 Quick Start

```bash
# One-click seeding (recommended)
pnpm run db:reset

# Or manually
pnpm run db:migrate           # Apply schema
pnpm run db:seed-only         # Populate data
```

## 📁 File Structure

```
seeds/
├── README.md                           # This file
├── seed.sql                            # Main seed (8 restaurants, 480 customers, 260 bookings)
├── seed-table-inventory.sql            # Table inventory (legacy - now in consolidated seed)
├── seed-today-bookings.sql             # Today's bookings (legacy - now in consolidated seed)
└── manual/
    └── seed-table-inventory.sql        # Backup of table seed
```

## 📄 Seed Files Explained

### `seed.sql` (840 lines)

**Purpose:** Main seed data generator

**Creates:**

- **8 Restaurants** (La Peninns pub chain)
  - The Railway Pub, The Bell Sawtry, The Queen Elizabeth, etc.
  - Each with full contact info, operating hours, service periods
- **480 Customers** (60 per restaurant)
  - Generated with seed emails (format: `slug-customer-XX@seedsajilo.dev`)
  - Realistic phone numbers
  - Marketing opt-in status (20% opted in)
- **260 Bookings** (mix of past/today/future)
  - 100 past bookings (various statuses: completed, cancelled, no_show)
  - 40 today bookings
  - 120 future bookings
  - Distributed across 8 restaurants
  - Includes seating preferences and booking types

**Run individually:**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/seed.sql
```

### `seed-table-inventory.sql` (92 lines)

**Purpose:** Creates table inventory for restaurants

**Creates:**

- **128 Tables** (16 per restaurant)
- Table numbers (T01, T02, etc.)
- Capacity specs (2-8 seats)
- Seating types (indoor, outdoor, bar, private_room)
- Sections (Main Floor, Patio, Bar High-Tops, Private Room)
- Position coordinates (for future UI visualization)

**Status:**
⚠️ **Legacy** - Now consolidated into `init-seeds.sql`

**Run individually (if needed):**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/seed-table-inventory.sql
```

### `seed-today-bookings.sql` (190 lines)

**Purpose:** Additional sample bookings for today (demo purposes)

**Creates:**

- **50 Bookings** for first restaurant
- Generated for `CURRENT_DATE`
- Spread across lunch, afternoon, dinner, late slots
- Realistic party sizes and seating preferences

**Status:**
⚠️ **Legacy** - Now consolidated into `init-seeds.sql`

**Run individually (if needed):**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/seed-today-bookings.sql
```

## 🚀 Consolidated Approach

### New: `supabase/init-seeds.sql`

**Replaces:** All individual seed files above

**Benefits:**

- ✅ Single file execution
- ✅ Proper transaction handling
- ✅ Better error messages
- ✅ One-command setup

**Usage:**

```bash
# After running migrations
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/init-seeds.sql

# Or via npm
pnpm run db:reset
```

## 🔄 Data Flow

```
1. Schema Setup (migrations)
   └─→ Tables, types, functions created

2. Seed Data (this directory)
   ├─→ Clear old data (TRUNCATE)
   ├─→ Insert restaurants & operating hours
   ├─→ Insert customers
   ├─→ Insert bookings & customer profiles
   ├─→ Insert table inventory
   ├─→ Insert today's sample bookings
   └─→ Grant admin access

3. Ready for Use
   └─→ 8 restaurants fully populated
       480 customers in system
       ~310 bookings across timeline
       128 tables configured
```

## 📊 Seed Statistics

After running `pnpm run db:reset`, you'll have:

| Metric           | Count                          |
| ---------------- | ------------------------------ |
| Restaurants      | 8                              |
| Customers        | 480+                           |
| Total Bookings   | 260+                           |
| Today's Bookings | 50+                            |
| Tables           | 128                            |
| Operating Hours  | 56 (8 restaurants × 7 days)    |
| Service Periods  | 32 (8 restaurants × 4 periods) |

## 🔐 Admin Access

The seed automatically grants full access to:

- **Email:** `amanshresthaaaaa@gmail.com`
- **Role:** `owner` across all restaurants
- **Requirement:** User must exist in `auth.users` first

## ⚙️ Customization

### To add new seed data:

1. Create a new file: `supabase/seeds/seed-feature.sql`
2. Test it individually:
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/seed-feature.sql
   ```
3. Add to `supabase/init-seeds.sql` in appropriate section
4. Test full reset:
   ```bash
   pnpm run db:reset
   ```

### To modify existing seed:

1. Edit the seed file (e.g., `seed.sql`)
2. Re-run full reset:
   ```bash
   pnpm run db:full-reset
   ```
3. Or re-run just seeds:
   ```bash
   pnpm run db:seed-only
   ```

## 🚨 Troubleshooting

### "Duplicate key value" error

- Seed already applied, re-run migrations: `pnpm run db:reset`
- Or: Check for existing restaurants with same IDs

### "Foreign key constraint violated"

- Migrations haven't been applied yet
- Run: `pnpm run db:migrate` first

### "Function doesn't exist"

- Custom functions not created yet
- Ensure migrations run before seeds

### Seeds stuck/slow?

- Normal for first run (~30-60s for 260 bookings)
- Subsequent runs faster with upserts
- Check: `psql -d "$DATABASE_URL" -c "SELECT count(*) FROM public.bookings;"`

## 📝 Seed Generation Scripts

These are referenced within seeds but actual scripts live in `tasks/`:

- `tasks/seed-eight-pubs-dataset-20251011-1240.js` - Generates main seed
- Generates deterministic data for reproducibility
- Uses timezone-aware timestamps

## 🔗 Related Files

- **Migrations:** `supabase/migrations/` - Schema definitions
- **Orchestrator:** `supabase/init-database.sql` - Applies migrations
- **Full Setup:** `supabase/init-seeds.sql` - This consolidated seeds file
- **NPM Scripts:** `package.json` - Commands to run seeds
- **Docs:** `supabase/README_SETUP.md` - Complete setup guide

---

**Last Updated:** October 17, 2025  
**Status:** Production-Ready ✅
