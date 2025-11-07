# Waterbeach-Only Database Reset - Summary

## What Was Done

Successfully reset the remote Supabase database and seeded it with **White Horse Pub (Waterbeach) only**.

## Files Created

1. **`supabase/utilities/reset-for-waterbeach.sql`**
   - Truncates all data tables (preserves schema)
   - Clean slate for new seed data

2. **`supabase/utilities/init-seeds-waterbeach.sql`**
   - Loads booking occasions catalog (lunch, drinks, dinner)
   - Loads White Horse Pub with operating hours and service periods

3. **`supabase/seeds/white-horse-service-periods.sql`**
   - Restaurant entity with contact info
   - 7 operating hours (one per day)
   - 21 service periods (lunch, dinner, drinks for each day)

4. **`supabase/seeds/cleanup-keep-only-waterbeach.sql`**
   - Selective cleanup script to purge any non-White-Horse restaurants

> Legacy helpers such as `fix-demo-restaurant-service-periods.sql` were deleted to keep the repo single-venue only.

## Database State (Verified)

✅ **Restaurants**: 1 (White Horse Pub, Waterbeach)
✅ **Operating Hours**: 7 records (Sun-Sat)
✅ **Service Periods**: 21 records (3 per day: lunch, dinner, drinks)
✅ **Booking Occasions**: 3 records (lunch, drinks, dinner - all active)
✅ **day_of_week**: All service periods have proper values (0-6)
✅ **Drinks overlap**: Properly configured to overlap with meal periods

## Service Periods Details

### Weekdays (Mon-Thu)

- Lunch: 12:00-15:00
- Dinner: 17:00-22:00
- Drinks: 12:00-22:00 (overlaps with lunch & dinner)

### Friday

- Lunch: 12:00-15:00
- Dinner: 17:00-22:00
- Drinks: 12:00-23:00 (extended)

### Saturday

- Lunch: 12:00-15:00
- Dinner: 17:00-22:00
- Drinks: 12:00-23:00 (extended)

### Sunday

- Lunch: 12:00-15:00
- Dinner: 17:00-21:00 (earlier close)
- Drinks: 12:00-22:00

## Quick Commands

### Full Reset & Reseed (Waterbeach Only)

```bash
source .env.local && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/reset-for-waterbeach.sql && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-seeds-waterbeach.sql
```

### Verify Database State

```bash
source .env.local && psql "$SUPABASE_DB_URL" -c "
  SELECT id, name, slug FROM public.restaurants;
  SELECT 'Service Periods:' as info, COUNT(*) FROM public.restaurant_service_periods;
  SELECT 'Operating Hours:' as info, COUNT(*) FROM public.restaurant_operating_hours;
"
```

### Reseed White Horse Only (without reset)

```bash
source .env.local && \
  psql "$SUPABASE_DB_URL" -f supabase/seeds/white-horse-service-periods.sql
```

## Benefits

1. ✅ **Clean state**: No legacy Demo Restaurant data
2. ✅ **Correct schema**: All service periods have day_of_week values
3. ✅ **Booking works**: API can now match periods to dates
4. ✅ **Drinks overlap**: Proper configuration for all-day drinks service
5. ✅ **Reproducible**: Can reset and reseed anytime with one command
6. ✅ **Minimal data**: Only Waterbeach, no test bookings or tables

## Next Steps

To test the booking flow:

1. Navigate to `/reserve/r/white-horse-pub-waterbeach`
2. Select a date
3. Verify time slots appear for lunch, dinner, and drinks
4. Drinks slots should appear alongside meal slots (no "closed" message)

## Backup

Legacy `.backup` copies were deleted as part of the Waterbeach-only cleanup. Use git history if prior revisions are required.

---

**Date**: 2025-11-07
**Status**: ✅ Complete
