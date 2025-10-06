-- ============================================
-- VERIFICATION QUERIES
-- Run these in Supabase Studio SQL Editor to verify seed data
-- ============================================

-- 1. Count all records
SELECT 
  (SELECT COUNT(*) FROM restaurants) as pubs,
  (SELECT COUNT(*) FROM restaurant_tables) as tables,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM bookings) as bookings;

-- Expected: pubs=8, tables=96, customers=640, bookings=400

-- 2. View all pubs with their capacities
SELECT 
  name,
  slug,
  capacity,
  timezone
FROM restaurants
ORDER BY name;

-- 3. Bookings distribution by pub
SELECT 
  r.name,
  COUNT(CASE WHEN b.booking_date < CURRENT_DATE THEN 1 END) as past_bookings,
  COUNT(CASE WHEN b.booking_date = CURRENT_DATE THEN 1 END) as today_bookings,
  COUNT(CASE WHEN b.booking_date > CURRENT_DATE THEN 1 END) as future_bookings,
  COUNT(*) as total_bookings
FROM restaurants r
LEFT JOIN bookings b ON b.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- Expected: Each pub should have ~15 past, ~5 today, ~30 future (total 50)

-- 4. Booking status distribution
SELECT 
  status,
  COUNT(*) as count
FROM bookings
GROUP BY status
ORDER BY count DESC;

-- 5. Tables per pub (should be 12 each)
SELECT 
  r.name,
  COUNT(t.id) as table_count,
  string_agg(t.label, ', ' ORDER BY t.label) as table_labels
FROM restaurants r
LEFT JOIN restaurant_tables t ON t.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- 6. Check for overlapping bookings (should return 0 rows)
SELECT 
  b1.id as booking1_id,
  b2.id as booking2_id,
  t.label as table_label,
  b1.start_at,
  b1.end_at,
  b2.start_at as overlap_start,
  b2.end_at as overlap_end
FROM bookings b1
JOIN bookings b2 
  ON b1.table_id = b2.table_id 
  AND b1.id < b2.id
  AND b1.status IN ('confirmed', 'pending')
  AND b2.status IN ('confirmed', 'pending')
  AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)')
JOIN restaurant_tables t ON t.id = b1.table_id;

-- If this returns rows, there are overlapping bookings (BUG!)

-- 7. Sample bookings for today
SELECT 
  r.name as restaurant,
  t.label as table,
  b.customer_name,
  b.start_time,
  b.end_time,
  b.party_size,
  b.status
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
JOIN restaurant_tables t ON t.id = b.table_id
WHERE b.booking_date = CURRENT_DATE
ORDER BY r.name, b.start_time;

-- 8. Customers with most bookings
SELECT 
  c.full_name,
  c.email,
  r.name as restaurant,
  COUNT(b.id) as booking_count
FROM customers c
JOIN restaurants r ON r.id = c.restaurant_id
LEFT JOIN bookings b ON b.customer_id = c.id
GROUP BY c.id, c.full_name, c.email, r.name
HAVING COUNT(b.id) > 0
ORDER BY booking_count DESC, c.full_name
LIMIT 20;

-- 9. Upcoming bookings (next 7 days)
SELECT 
  r.name as restaurant,
  b.booking_date,
  b.start_time,
  b.customer_name,
  t.label as table,
  b.party_size,
  b.status
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
JOIN restaurant_tables t ON t.id = b.table_id
WHERE b.booking_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY r.name, b.booking_date, b.start_time
LIMIT 50;

-- 10. Table utilization by seating type
SELECT 
  r.name as restaurant,
  t.seating_type,
  COUNT(DISTINCT t.id) as table_count,
  COUNT(b.id) as booking_count,
  ROUND(COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT t.id), 0), 2) as bookings_per_table
FROM restaurants r
JOIN restaurant_tables t ON t.restaurant_id = r.id
LEFT JOIN bookings b ON b.table_id = t.id
GROUP BY r.id, r.name, t.seating_type
ORDER BY r.name, t.seating_type;

-- 11. Verify booking reference uniqueness
SELECT 
  reference,
  COUNT(*) as count
FROM bookings
GROUP BY reference
HAVING COUNT(*) > 1;

-- Should return 0 rows (all references should be unique)

-- 12. Check customer email/phone uniqueness per restaurant
WITH duplicate_emails AS (
  SELECT 
    restaurant_id,
    email_normalized,
    COUNT(*) as count
  FROM customers
  GROUP BY restaurant_id, email_normalized
  HAVING COUNT(*) > 1
),
duplicate_phones AS (
  SELECT 
    restaurant_id,
    phone_normalized,
    COUNT(*) as count
  FROM customers
  GROUP BY restaurant_id, phone_normalized
  HAVING COUNT(*) > 1
)
SELECT 
  (SELECT COUNT(*) FROM duplicate_emails) as duplicate_emails,
  (SELECT COUNT(*) FROM duplicate_phones) as duplicate_phones;

-- Should return 0 for both

-- 13. Restaurant memberships (owner assignments)
SELECT 
  r.name,
  rm.user_id,
  rm.role
FROM restaurant_memberships rm
JOIN restaurants r ON r.id = rm.restaurant_id
ORDER BY r.name;

-- All should be assigned to user_id: 00000000-0000-0000-0000-000000000001

-- 14. Booking time distribution (by hour)
SELECT 
  EXTRACT(HOUR FROM start_time) as hour,
  COUNT(*) as booking_count
FROM bookings
GROUP BY hour
ORDER BY hour;

-- 15. Full booking details for one pub (example)
SELECT 
  b.reference,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.customer_name,
  b.customer_email,
  t.label as table,
  t.seating_type,
  b.party_size,
  b.status,
  b.notes
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
JOIN restaurant_tables t ON t.id = b.table_id
WHERE r.slug = 'the-queen-elizabeth-pub'
ORDER BY b.booking_date, b.start_time
LIMIT 20;
