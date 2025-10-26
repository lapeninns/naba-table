# Seed Data Scaling Summary

## Objective

Scale up seed data to provide realistic test volumes:

- **Zones**: 5x increase (8 → 40)
- **Tables**: 10x increase (32 → 320)
- **Bookings**: 30x increase (200 → 6000)

## Implementation Date

October 26, 2025

## Results

### Final Counts

| Entity      | Count | Per Restaurant |
| ----------- | ----- | -------------- |
| Restaurants | 8     | -              |
| Zones       | 40    | 5              |
| Tables      | 320   | 40             |
| Customers   | 3,200 | 400            |
| Bookings    | 6,000 | 750            |

### Multipliers Achieved

- ✅ **Zones**: 8 → 40 = **5x** (Target: 5x)
- ✅ **Tables**: 32 → 320 = **10x** (Target: 10x)
- ✅ **Bookings**: 200 → 6,000 = **30x** (Target: 30x)

## Zone Structure (Per Restaurant)

Each restaurant now has 5 zones with specific characteristics:

1. **Main Dining** (12 tables)
   - Capacity: 2-9 guests
   - Category: Dining
   - Seating: Standard & Booth

2. **Bar Area** (8 tables)
   - Capacity: 2-7 guests
   - Category: Bar & Lounge
   - Seating: High Top & Sofa

3. **Patio** (8 tables)
   - Capacity: 2-9 guests
   - Category: Patio
   - Seating: Standard

4. **Private Room** (6 tables)
   - Capacity: 4-9 guests
   - Category: Private
   - Seating: Standard

5. **Outdoor Garden** (6 tables)
   - Capacity: 2-9 guests
   - Category: Patio
   - Seating: Standard

**Total**: 40 tables per restaurant

## Table Distribution

### By Capacity

- 2-person tables: ~25%
- 4-person tables: ~40%
- 7-person tables: ~25%
- 9-person tables: ~10%

### By Category

- Dining: 30% (12 tables)
- Bar: 15% (6 tables)
- Lounge: 5% (2 tables)
- Patio: 35% (14 tables)
- Private: 15% (6 tables)

## Booking Distribution

### By Time Period

- Today: 2,000 bookings (250 per restaurant)
- Past Day: 2,000 bookings (250 per restaurant)
- Future Day: 2,000 bookings (250 per restaurant)

**Total**: 6,000 bookings (750 per restaurant)

### By Booking Type

- Lunch: 2,400 (40%)
- Drinks: 1,200 (20%)
- Dinner: 2,400 (40%)

### Time Slots

- **Lunch**: 12:00-15:00 (90 min duration)
- **Drinks**: 15:00-17:00 (60 min duration)
- **Dinner**: 17:00-22:00 (105-120 min duration)

## Technical Details

### Database Schema Compliance

All seed data strictly follows the current database schema from migrations:

#### Zones Table

- `restaurant_id` (FK to restaurants, NOT NULL)
- `name` (text, NOT NULL, unique per restaurant)
- `sort_order` (smallint, NOT NULL, default 0)

#### Table Inventory

- `restaurant_id` (FK to restaurants, NOT NULL)
- `zone_id` (FK to zones, NOT NULL)
- `table_number` (text, NOT NULL, unique per restaurant)
- `capacity` (integer, NOT NULL, FK to allowed_capacities)
- `category` (enum: dining, bar, lounge, patio, private)
- `seating_type` (enum: standard, booth, high_top, sofa)
- `mobility` (enum: movable, default)
- `active` (boolean, default true)

#### Allowed Capacities

Added for each restaurant: 2, 4, 7, 9 guests

### Booking References

Made unique across all batches using prefixes:

- Today bookings: `LP-T-{hash}`
- Past day bookings: `LP-P-{hash}`
- Future day bookings: `LP-F-{hash}`

### Time Constraint Fixes

Fixed modulo calculations to prevent time wraparound violations:

- Lunch: max 12 slots (avoid going past 15:00)
- Drinks: max 8 slots (avoid going past 17:00)
- Dinner: max 16 slots (avoid going past 22:00)

## Verification Queries

```sql
-- Overall counts
SELECT
  'restaurants' as entity, COUNT(*) as count FROM restaurants
UNION ALL
SELECT 'zones', COUNT(*) FROM zones
UNION ALL
SELECT 'tables', COUNT(*) FROM table_inventory
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings;

-- Per restaurant breakdown
SELECT
  r.name,
  (SELECT COUNT(*) FROM zones z WHERE z.restaurant_id = r.id) as zones,
  (SELECT COUNT(*) FROM table_inventory t WHERE t.restaurant_id = r.id) as tables,
  (SELECT COUNT(*) FROM customers c WHERE c.restaurant_id = r.id) as customers,
  (SELECT COUNT(*) FROM bookings b WHERE b.restaurant_id = r.id) as bookings
FROM restaurants r
ORDER BY r.name;

-- Zone and table distribution
SELECT
  z.name as zone_name,
  COUNT(t.id) as table_count,
  array_agg(DISTINCT t.category) as categories
FROM zones z
JOIN table_inventory t ON t.zone_id = z.id
WHERE z.restaurant_id = (SELECT id FROM restaurants LIMIT 1)
GROUP BY z.name, z.sort_order
ORDER BY z.sort_order;

-- Booking type distribution
SELECT
  booking_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bookings), 1) as percentage
FROM bookings
GROUP BY booking_type;
```

## Files Modified

### supabase/seed.sql

Key changes:

1. Added zones generation (40 zones, 5 per restaurant)
2. Added allowed_capacities insertion (before table_inventory)
3. Added table_inventory generation (320 tables, 40 per restaurant)
4. Scaled booking generation from 150 to 250 per time period
5. Fixed time calculations to prevent constraint violations
6. Made booking references unique with prefixes

## Success Criteria

- ✅ Zones scaled by 5x
- ✅ Tables scaled by 10x
- ✅ Bookings scaled by 30x
- ✅ All data based on current database schema
- ✅ Data distributed evenly across all 8 restaurants
- ✅ No foreign key constraint violations
- ✅ No unique constraint violations
- ✅ No time constraint violations
- ✅ Seed runs successfully without errors

## Next Steps

The database now contains realistic test volumes suitable for:

- Performance testing
- UI/UX testing with real-world data volumes
- Manual assignment and capacity planning workflows
- Analytics and reporting features
- Load testing scenarios
