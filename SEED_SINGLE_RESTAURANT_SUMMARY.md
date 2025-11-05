# Single Restaurant Seed Summary

**Created:** 2025-11-05 19:11:18 UTC  
**Database:** Remote Supabase Production  
**Status:** ✅ Successfully Applied

---

## Migration Applied

**File:** `supabase/migrations/20251105191118_verify_schema_for_single_restaurant.sql`  
**Purpose:** Verified schema readiness for single restaurant seed

---

## Seed File Applied

**File:** `supabase/seed-single-restaurant.sql`  
**Purpose:** Populate database with 1 restaurant, 2 zones, 16 tables, and 50 bookings

---

## What Was Created

### 1. Restaurant

- **Name:** Demo Restaurant
- **Slug:** `demo-restaurant`
- **Timezone:** Europe/London
- **Address:** 123 Main Street, Demo City, DC1 1AA
- **Contact:** contact@demorestuarant.com, 01234 567890
- **Operating Hours:** Mon-Sun 12:00-22:00

### 2. Zones (2 total)

| Zone Name | Sort Order | Tables |
| --------- | ---------- | ------ |
| Dining 1  | 1          | 8      |
| Dining 2  | 2          | 8      |

### 3. Tables (16 total, all movable)

#### Dining 1 (8 tables)

- **3 tables of 2 seats:**
  - D1-T01 (2 seats, movable)
  - D1-T02 (2 seats, movable)
  - D1-T03 (2 seats, movable)
- **5 tables of 4 seats:**
  - D1-T04 (4 seats, movable)
  - D1-T05 (4 seats, movable)
  - D1-T06 (4 seats, movable)
  - D1-T07 (4 seats, movable)
  - D1-T08 (4 seats, movable)

#### Dining 2 (8 tables)

- **6 tables of 4 seats:**
  - D2-T01 (4 seats, movable)
  - D2-T02 (4 seats, movable)
  - D2-T03 (4 seats, movable)
  - D2-T04 (4 seats, movable)
  - D2-T05 (4 seats, movable)
  - D2-T06 (4 seats, movable)

- **2 tables of 2 seats:**
  - D2-T07 (2 seats, movable)
  - D2-T08 (2 seats, movable)

**Total Seating Capacity:**

- Dining 1: 3×2 + 5×4 = 26 seats
- Dining 2: 6×4 + 2×2 = 28 seats
- **Grand Total: 54 seats**

### 4. Customers (50 total)

- Guest 01 through Guest 50
- Email format: `guest01@example.com` to `guest50@example.com`
- Phone format: `+447700000001` to `+447700000050`
- Every 3rd guest opted in for marketing
- Every 10th guest marked as VIP

### 5. Bookings (50 total)

#### Distribution by Date:

- **Today:** 17 bookings
- **Tomorrow:** 17 bookings
- **Day After Tomorrow:** 16 bookings

#### Distribution by Type:

- **Lunch:** 25 bookings (12:00-15:00, 90 min duration)
- **Dinner:** 25 bookings (17:00-22:00, 120 min duration)

#### Distribution by Status:

- **Confirmed:** 45 bookings
- **Pending:** 5 bookings (every 10th booking)

#### Party Sizes:

Bookings cycle through party sizes: 2, 3, 4, 5, 6

- Booking 1: 2 people
- Booking 2: 3 people
- Booking 3: 4 people
- Booking 4: 5 people
- Booking 5: 6 people
- (pattern repeats)

### 6. Additional Data Created

- **Booking Occasions:** lunch, dinner
- **Service Policy:** Configured for 12:00-15:30 lunch, 17:00-22:30 dinner
- **Operating Hours:** 7 days (Mon-Sun), 12:00-22:00
- **Service Periods:** 14 total (2 per day × 7 days)
- **Allowed Capacities:** 2, 4, 6, 8 person tables
- **Table Adjacencies:** 56 adjacency relationships for table combinations
- **Booking State History:** 50 entries
- **Booking Versions:** 50 entries
- **Booking Slots:** 96 time slots
- **Analytics Events:** 50 events
- **Loyalty Program:** Demo Restaurant Loyalty Club
- **Customer Profiles:** 50 profiles
- **Loyalty Points:** 45 customer records (confirmed bookings only)
- **Loyalty Point Events:** 45 events

---

## Database Verification

### Zones Verification

```sql
SELECT z.name, COUNT(t.id) as table_count
FROM zones z
JOIN table_inventory t ON t.zone_id = z.id
WHERE z.restaurant_id = (SELECT id FROM restaurants WHERE slug = 'demo-restaurant')
GROUP BY z.name ORDER BY z.name;
```

Result:
| name | table_count |
|----------|-------------|
| Dining 1 | 8 |
| Dining 2 | 8 |

### Tables Verification

```sql
SELECT z.name as zone, t.capacity, COUNT(*) as count, mobility
FROM zones z
JOIN table_inventory t ON t.zone_id = z.id
WHERE z.restaurant_id = (SELECT id FROM restaurants WHERE slug = 'demo-restaurant')
GROUP BY z.name, t.capacity, mobility
ORDER BY z.name, t.capacity;
```

Result:
| zone | capacity | count | mobility |
|----------|----------|-------|----------|
| Dining 1 | 2 | 3 | movable |
| Dining 1 | 4 | 5 | movable |
| Dining 2 | 2 | 2 | movable |
| Dining 2 | 4 | 6 | movable |

### Bookings Verification

```sql
SELECT COUNT(*) as total_bookings, booking_type, status
FROM bookings
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'demo-restaurant')
GROUP BY booking_type, status
ORDER BY booking_type, status;
```

Result:
| total_bookings | booking_type | status |
|----------------|--------------|-----------|
| 20 | dinner | confirmed |
| 5 | dinner | pending |
| 25 | lunch | confirmed |

**Total: 50 bookings**

---

## Staff Account

**Email:** owner@demorestuarant.com  
**Role:** Owner  
**Access:** Full access to Demo Restaurant

---

## Files Created

1. **Migration:** `supabase/migrations/20251105191118_verify_schema_for_single_restaurant.sql`
2. **Seed:** `supabase/seed-single-restaurant.sql`
3. **Summary:** `SEED_SINGLE_RESTAURANT_SUMMARY.md` (this file)

---

## Next Steps

To use this data in your application:

1. **Update environment variables** to use the new restaurant:

   ```bash
   NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG=demo-restaurant
   ```

2. **Query the restaurant ID:**

   ```sql
   SELECT id FROM restaurants WHERE slug = 'demo-restaurant';
   ```

3. **Use the restaurant in your app** by navigating to:
   ```
   http://localhost:3000/demo-restaurant
   ```

---

## Characteristics

✅ All tables are **movable** (as requested)  
✅ 2 zones: **Dining 1** and **Dining 2**  
✅ Dining 1: 3×2-seater + 5×4-seater tables  
✅ Dining 2: 6×4-seater + 2×2-seater tables  
✅ 50 bookings across 3 days (today, tomorrow, day after)  
✅ Mix of lunch and dinner bookings  
✅ Realistic party sizes (2-6 people)  
✅ Table adjacencies configured for combination planning  
✅ Full booking lifecycle support (state history, versions, slots)  
✅ Loyalty program and analytics enabled

---

**End of Summary**
