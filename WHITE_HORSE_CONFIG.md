# White Horse Pub - Complete Seed Configuration

## Summary

The seed file now includes complete restaurant configuration with zones and tables.

## Database Contents

✅ **Restaurant**: White Horse Pub (Waterbeach)
✅ **Operating Hours**: 7 days
✅ **Service Periods**: 21 periods (lunch, dinner, drinks × 7 days)
✅ **Zones**: 3 zones
✅ **Tables**: 26 tables across all zones
✅ **Allowed Capacities**: 4 party sizes (2, 4, 6, 8)

## Zones Configuration

### 1. Main Bar (Indoor)

- **Type**: Bar seating
- **Tables**: 8 tables
  - B1-B2: 2-top standard (2 tables)
  - B3-B4: 4-top standard (2 tables)
  - B5-B6: 6-top standard (2 tables)
  - B7-B8: 4-top high_top (2 tables)

### 2. Dining Room (Indoor)

- **Type**: Dining tables
- **Tables**: 12 tables
  - D1-D4: 2-top (4 tables)
  - D5-D8: 4-top (4 tables)
  - D9-D10: 6-top (2 tables)
  - D11-D12: 8-top (2 tables)

### 3. Garden (Outdoor)

- **Type**: Patio seating
- **Tables**: 6 tables
  - G1-G3: 4-top (3 tables)
  - G4-G5: 6-top (2 tables)
  - G6: 8-top (1 table)

## Total Capacity Breakdown

| Capacity  | Main Bar | Dining Room | Garden | Total Tables |
| --------- | -------- | ----------- | ------ | ------------ |
| 2-top     | 2        | 4           | 0      | 6            |
| 4-top     | 4        | 4           | 3      | 11           |
| 6-top     | 2        | 2           | 2      | 6            |
| 8-top     | 0        | 2           | 1      | 3            |
| **Total** | **8**    | **12**      | **6**  | **26**       |

## Total Covers

- Main Bar: 34 covers (2×2 + 4×4 + 2×6 = 4+16+12+2 = 34)
- Dining Room: 56 covers (4×2 + 4×4 + 2×6 + 2×8 = 8+16+12+16 = 52)
- Garden: 32 covers (3×4 + 2×6 + 1×8 = 12+12+8 = 32)
- **Grand Total**: ~122 covers

## Service Periods

### Weekdays (Mon-Thu)

- Lunch: 12:00-15:00
- Dinner: 17:00-22:00
- Drinks: 12:00-22:00 (overlaps)

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

## Files Modified

1. **`supabase/seeds/white-horse-service-periods.sql`**
   - Added zones (3 zones: Main Bar, Dining Room, Garden)
   - Added tables (26 tables with proper categories and seating types)
   - Added allowed_capacities (2, 4, 6, 8)
   - Proper type casting for PostgreSQL enums

## Running the Seed

```bash
# Full reset and reseed
source .env.local && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/reset-for-waterbeach.sql && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-seeds-waterbeach.sql

# Or just reseed White Horse (updates existing)
source .env.local && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/white-horse-service-periods.sql
```

## Verification Queries

### Check zones and table distribution

```sql
SELECT
  z.name as zone,
  z.area_type,
  COUNT(t.id) as table_count,
  SUM(t.capacity) as total_covers
FROM zones z
LEFT JOIN table_inventory t ON t.zone_id = z.id
WHERE z.restaurant_id = (SELECT id FROM restaurants WHERE slug = 'white-horse-pub-waterbeach')
GROUP BY z.id, z.name, z.area_type, z.sort_order
ORDER BY z.sort_order;
```

### Check table details by zone

```sql
SELECT
  z.name as zone,
  t.table_number,
  t.capacity,
  t.category,
  t.seating_type,
  t.status
FROM table_inventory t
JOIN zones z ON z.id = t.zone_id
WHERE t.restaurant_id = (SELECT id FROM restaurants WHERE slug = 'white-horse-pub-waterbeach')
ORDER BY z.sort_order, t.table_number;
```

## Next Steps

The restaurant is now fully configured and ready for:

1. ✅ Booking reservations
2. ✅ Table allocation
3. ✅ Zone-based seating preferences
4. ✅ Capacity management

---

**Date**: 2025-11-07
**Status**: ✅ Complete with zones and tables
