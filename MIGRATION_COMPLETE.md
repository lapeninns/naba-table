# Migration Complete - White Horse Pub Setup

## Migration Summary

✅ **Date**: 2025-11-07
✅ **Status**: Successfully completed
✅ **Environment**: Remote Supabase Database

## Actions Performed

### 1. Migration Status Check

- All 75+ migrations already applied to remote database
- Schema is up-to-date and ready for data

### 2. Database Reset

- Truncated all data tables (preserved schema)
- Cleared out all existing restaurant data
- Ready for clean Waterbeach-only setup

### 3. Data Seeding

- ✅ Booking occasions catalog (3 records: lunch, drinks, dinner)
- ✅ White Horse Pub restaurant entity
- ✅ Operating hours (7 days)
- ✅ Service periods (21 periods)
- ✅ Zones (3 zones)
- ✅ Tables (26 tables)
- ✅ Allowed capacities (4 party sizes)

## Final Database State

### Restaurant

- **Name**: White Horse Pub
- **Slug**: white-horse-pub-waterbeach
- **Location**: Waterbeach, Cambridge CB25 9JU
- **Contact**: 01223 860000
- **Email**: info@whitehorsewaterbeach.co.uk

### Operating Hours

- **Days**: 7 days (Sunday-Saturday)
- **Sunday-Thursday**: 12:00-22:00
- **Friday-Saturday**: 12:00-23:00

### Service Periods (21 total)

- **Lunch**: 12:00-15:00 (all days)
- **Dinner**: 17:00-22:00 (weekdays), 17:00-21:00 (Sunday)
- **Drinks**: 12:00-22:00 (Sun-Thu), 12:00-23:00 (Fri-Sat)
- **Overlap**: Drinks periods overlap with lunch and dinner

### Zones & Tables

| Zone        | Area Type | Tables | Total Covers | Table Sizes |
| ----------- | --------- | ------ | ------------ | ----------- |
| Main Bar    | Indoor    | 8      | 32           | 2, 4, 6     |
| Dining Room | Indoor    | 12     | 52           | 2, 4, 6, 8  |
| Garden      | Outdoor   | 6      | 32           | 4, 6, 8     |
| **TOTAL**   | -         | **26** | **116**      | 2, 4, 6, 8  |

### Table Details

**Main Bar (8 tables)**

- 2 × 2-top standard
- 2 × 4-top standard
- 2 × 6-top standard
- 2 × 4-top high_top

**Dining Room (12 tables)**

- 4 × 2-top
- 4 × 4-top
- 2 × 6-top
- 2 × 8-top

**Garden (6 tables)**

- 3 × 4-top
- 2 × 6-top
- 1 × 8-top

### Allowed Capacities

- Party sizes: **2, 4, 6, 8**

## Commands Used

```bash
# Check migration status
pnpm run db:status

# Reset database
source .env.local && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/utilities/reset-for-waterbeach.sql

# Seed with Waterbeach data
source .env.local && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/utilities/init-seeds-waterbeach.sql
```

## Verification

```sql
-- Quick check
SELECT
  'Restaurant' as item, name, '1' as count
FROM restaurants WHERE slug = 'white-horse-pub-waterbeach'
UNION ALL
SELECT 'Operating Hours', 'Days: ' || COUNT(*)::text, ''
FROM restaurant_operating_hours
UNION ALL
SELECT 'Service Periods', 'Total: ' || COUNT(*)::text, ''
FROM restaurant_service_periods
UNION ALL
SELECT 'Zones', 'Total: ' || COUNT(*)::text, '' FROM zones
UNION ALL
SELECT 'Tables', 'Total: ' || COUNT(*)::text, ''
FROM table_inventory
UNION ALL
SELECT 'Allowed Capacities', array_agg(capacity)::text, ''
FROM allowed_capacities;

-- Detailed zone breakdown
SELECT
  z.name as zone,
  z.area_type::text,
  COUNT(t.id) as tables,
  SUM(t.capacity) as covers
FROM zones z
LEFT JOIN table_inventory t ON t.zone_id = z.id
GROUP BY z.id, z.name, z.area_type, z.sort_order
ORDER BY z.sort_order;
```

## Next Steps

1. ✅ **Database**: Fully configured and ready
2. ✅ **Tables**: All tables created with proper zones
3. ✅ **Service Periods**: Configured with overlapping drinks periods
4. ⏭️ **Test Bookings**: Ready to accept reservations
5. ⏭️ **Deploy Frontend**: Ready for production deployment

## Access URLs

- **Reservation Page**: `/reserve/r/white-horse-pub-waterbeach`
- **Admin Settings**: `/ops/restaurant-settings`
- **Database**: Remote Supabase (configured via .env.local)

## Files Modified/Created

1. `supabase/utilities/reset-for-waterbeach.sql` - Database reset script
2. `supabase/utilities/init-seeds-waterbeach.sql` - Waterbeach seed orchestrator
3. `supabase/seeds/white-horse-service-periods.sql` - Complete restaurant seed
4. `WATERBEACH_RESET_SUMMARY.md` - Reset documentation
5. `WHITE_HORSE_CONFIG.md` - Configuration documentation
6. `MIGRATION_COMPLETE.md` - This file

---

**Migration Status**: ✅ COMPLETE
**Ready for Production**: YES
**Total Capacity**: 116 covers across 26 tables
