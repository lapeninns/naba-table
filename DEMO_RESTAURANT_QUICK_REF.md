# Demo Restaurant - Quick Reference

## Restaurant Details

- **ID:** `8dcb19c3-d767-4993-9b91-4655a4d95921`
- **Name:** Demo Restaurant
- **Slug:** `demo-restaurant`

## Environment Variables

```bash
NEXT_PUBLIC_DEFAULT_RESTAURANT_ID=8dcb19c3-d767-4993-9b91-4655a4d95921
NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG=demo-restaurant
```

## Database Stats

- **Zones:** 2 (Dining 1, Dining 2)
- **Tables:** 16 total (all movable)
  - Dining 1: 3×2-seat + 5×4-seat = 8 tables (26 seats)
  - Dining 2: 6×4-seat + 2×2-seat = 8 tables (28 seats)
- **Customers:** 50
- **Bookings:** 50 (45 confirmed, 5 pending)

## Quick Queries

### View all tables

```sql
SELECT z.name as zone, t.table_number, t.capacity, t.mobility
FROM zones z
JOIN table_inventory t ON t.zone_id = z.id
WHERE z.restaurant_id = '8dcb19c3-d767-4993-9b91-4655a4d95921'
ORDER BY z.name, t.table_number;
```

### View today's bookings

```sql
SELECT b.reference, b.customer_name, b.party_size, b.start_time, b.end_time, b.status
FROM bookings b
WHERE b.restaurant_id = '8dcb19c3-d767-4993-9b91-4655a4d95921'
  AND b.booking_date = CURRENT_DATE
ORDER BY b.start_time;
```

### View table availability

```sql
SELECT z.name as zone, t.table_number, t.capacity, t.status
FROM zones z
JOIN table_inventory t ON t.zone_id = z.id
WHERE z.restaurant_id = '8dcb19c3-d767-4993-9b91-4655a4d95921'
  AND t.active = true
ORDER BY z.name, t.capacity, t.table_number;
```
