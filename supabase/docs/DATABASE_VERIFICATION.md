# Database Verification Guide

## Quick Commands

### Check Everything

```bash
# Comprehensive verification (recommended)
pnpm run db:verify
```

### Check Specific Things

#### 1. Migration Status

```bash
# Check if all migrations are synced
supabase migration list
# or
pnpm run db:status

# ✅ Look for: Local column = Remote column for all migrations
```

#### 2. Schema Objects Count

```bash
source .env.local
psql "$SUPABASE_DB_URL" -c "
SELECT
  'Tables' as type, COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT 'Functions', COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public';
"

# ✅ Expected: Tables: 23+, Functions: 200+
```

#### 3. Seed Data Verification

```bash
source .env.local
psql "$SUPABASE_DB_URL" -c "
SELECT
  (SELECT COUNT(*) FROM restaurants) as restaurants,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM bookings) as bookings,
  (SELECT COUNT(*) FROM table_inventory) as tables;
"

# ✅ Expected: 8 restaurants, 530 customers, 310 bookings, 128 tables
```

#### 4. Booking Distribution

```bash
source .env.local
psql "$SUPABASE_DB_URL" -c "
SELECT
  COUNT(CASE WHEN booking_date < CURRENT_DATE THEN 1 END) as past,
  COUNT(CASE WHEN booking_date = CURRENT_DATE THEN 1 END) as today,
  COUNT(CASE WHEN booking_date > CURRENT_DATE THEN 1 END) as future
FROM bookings;
"

# ✅ Expected: ~100 past, ~90 today, ~120 future
```

## Expected Values (After Fresh Setup)

### Migrations

- **Total**: 21 migrations
- **Range**: `20250101000000` → `20251017123500`
- **Status**: All should show in both Local AND Remote columns

### Schema Objects

- **Tables**: 23+
- **Functions**: 200+
- **Types**: 9+ (enums)

### Seed Data

- **Restaurants**: 8
- **Customers**: 530
- **Bookings**: 310 total
  - Past: ~100
  - Today: ~90
  - Future: ~120
- **Tables**: 128 (16 per restaurant)
- **Profiles**: 1+ (admin user)

## Troubleshooting

### Migrations Not Synced

```bash
# If Local column is filled but Remote is empty:
supabase db push

# If objects exist but migrations show as not applied:
supabase migration repair --status applied <timestamp>
```

### Missing Seed Data

```bash
# Re-run seeds only (doesn't affect schema):
pnpm run db:seed-only

# Full reset (wipe + migrate + seed):
pnpm run db:wipe
supabase db push
pnpm run db:seed-only
```

### Verify Specific Table

```bash
source .env.local
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM <table_name>;"
```

## NPM Scripts Reference

```bash
pnpm run db:status       # Check migration status
pnpm run db:verify       # Full verification check
pnpm run db:push         # Push migrations to remote
pnpm run db:seed-only    # Seed database only
pnpm run db:reset        # Reset with migrations + seeds
pnpm run db:wipe         # Wipe entire public schema (⚠️ destructive)
```

## Manual Verification Checklist

- [ ] All migrations show in both Local and Remote columns
- [ ] Table count ≥ 23
- [ ] Function count ≥ 200
- [ ] 8 restaurants exist
- [ ] 530 customers exist
- [ ] 310 bookings exist
- [ ] 128 tables in inventory
- [ ] Bookings distributed across past/today/future
- [ ] Admin profile exists

---

**Last Updated**: October 17, 2025  
**Script Location**: `scripts/verify-database.sh`
