# Waterbeach Seed Data Summary

## Overview

The repository now seeds a **single venue** – **White Horse Pub (Waterbeach)** – to mirror the only live property that still uses SajiloReserveX. All legacy multi-restaurant datasets were removed on 2025-11-07.

## 📊 Snapshot

- **Restaurants**: 1 (White Horse Pub, slug `white-horse-pub-waterbeach`)
- **Customers**: 50 (Waterbeach-specific guest profiles)
- **Bookings**: 25 per dataset refresh (past, present, future spread)
- **Owner account**: `owner@lapeninns.com` (same credentials as before)

## 🏢 Restaurant Details

- **Address**: 12 Green Side, Waterbeach, Cambridge, CB25 9HP
- **Phone**: 01223 375578
- **Email**: whitehorse@lapeninns.com
- **Website**: https://whitehorsepub.co
- **Timezone**: Europe/London
- **Policy snippet**: “Visit: https://whitehorsepub.co”

### Operating Hours

- **Monday – Friday**: 12:00 → 22:00
- **Weekends**: Closed (marked via `is_closed = true`)

### Service Periods

Every weekday receives three blocks:

1. **Weekday Lunch** (12:00–15:00, `lunch`)
2. **Happy Hour** (15:00–17:00, `drinks`)
3. **Dinner Service** (17:00–22:00, `dinner`)

### Customers & Bookings

- 50 synthetic guests tied to the restaurant slug (unique emails + phones)
- 25 bookings distributed evenly across:
  - Past 8 days
  - Today
  - Next 8 days
- Party sizes span 2–7, with table assignments exercised through allocator logic
- Status mix keeps ~95% confirmed and a small cancel rate for realism

## 🛠️ Running the Seed

```bash
pnpm run db:seed-only               # orchestrates supabase/seed.sql
# or manually
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

### Verification Snippets

```sql
SELECT COUNT(*) FROM public.restaurants;        -- expect 1
SELECT COUNT(*) FROM public.customers;          -- expect 50
SELECT COUNT(*) FROM public.bookings;           -- expect 25
SELECT DISTINCT slug FROM public.restaurants;   -- expect 'white-horse-pub-waterbeach'
```

## ♻️ Cleanup Helpers

- `supabase/seeds/cleanup-keep-only-waterbeach.sql` removes any stray restaurants if legacy data sneaks back.
- `supabase/seeds/white-horse-service-periods.sql` replays the service periods/tables without touching auth data.

## Notes

- All timestamps remain `Europe/London`.
- Scripts use `TRUNCATE ... CASCADE`; never run against production without backups.
- Historical docs referencing multi-restaurant datasets are archived for provenance but no longer map to runnable SQL.

## 🔄 Resetting Data

To reset the database and reseed:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql
```

This will:

1. Truncate all relevant tables
2. Recreate the owner account
3. Insert all restaurants, customers, and bookings
4. Set up operating hours and service periods

---

**Last Updated**: October 20, 2025
**Version**: 1.0
