-- ============================================================================
-- DIAGNOSTIC QUERIES: Find patterns in booking assignment failures
-- Run these in Supabase SQL Editor
-- ============================================================================

-- 1. List all restaurants and their table counts
SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  COUNT(DISTINCT z.id) as zone_count,
  COUNT(DISTINCT ti.id) as table_count,
  COUNT(DISTINCT roh.id) as operating_hours_count,
  COUNT(DISTINCT rsp.id) as service_period_count
FROM restaurants r
LEFT JOIN zones z ON z.restaurant_id = r.id
LEFT JOIN table_inventory ti ON ti.restaurant_id = r.id AND ti.active = true
LEFT JOIN restaurant_operating_hours roh ON roh.restaurant_id = r.id
LEFT JOIN restaurant_service_periods rsp ON rsp.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- 2. Recent bookings with assignment status
SELECT 
  b.id as booking_id,
  LEFT(b.id::text, 8) as short_id,
  r.name as restaurant,
  b.status,
  b.booking_type,
  b.booking_date,
  b.start_time,
  b.party_size,
  b.assignment_state,
  COUNT(bta.id) as assigned_tables,
  b.created_at
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
LEFT JOIN booking_table_assignments bta ON bta.booking_id = b.id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
GROUP BY b.id, r.name
ORDER BY b.created_at DESC
LIMIT 30;

-- 3. Bookings that have status 'confirmed' but NO table assignments (THE BUG!)
SELECT 
  b.id as booking_id,
  r.name as restaurant,
  b.status,
  b.booking_type,
  b.booking_date,
  b.start_time,
  b.party_size,
  b.assignment_state,
  b.created_at
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
LEFT JOIN booking_table_assignments bta ON bta.booking_id = b.id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
  AND bta.id IS NULL
ORDER BY b.created_at DESC;

-- 4. Bookings that have status 'pending' (failed to confirm)
SELECT 
  b.id as booking_id,
  r.name as restaurant,
  b.status,
  b.booking_type,
  b.booking_date,
  b.start_time,
  b.party_size,
  b.assignment_state,
  b.created_at
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
  AND b.status = 'pending'
ORDER BY b.created_at DESC;

-- 5. Check if restaurants have matching service periods for booking types
SELECT 
  r.name as restaurant,
  rsp.booking_option,
  rsp.opening_time,
  rsp.closing_time,
  rsp.is_active
FROM restaurant_service_periods rsp
JOIN restaurants r ON r.id = rsp.restaurant_id
ORDER BY r.name, rsp.booking_option;

-- 6. Check active holds (table capacity being held but not confirmed)
SELECT 
  th.id as hold_id,
  r.name as restaurant,
  b.id as booking_id,
  th.status,
  th.start_at,
  th.end_at,
  th.expires_at,
  th.created_at,
  COUNT(thm.id) as table_count
FROM table_holds th
LEFT JOIN restaurants r ON r.id = th.restaurant_id
LEFT JOIN bookings b ON b.id = th.booking_id
LEFT JOIN table_hold_members thm ON thm.hold_id = th.id
WHERE th.created_at > NOW() - INTERVAL '24 hours'
GROUP BY th.id, r.name, b.id
ORDER BY th.created_at DESC
LIMIT 20;

-- 7. Compare Corner House vs Old Crown Girton setup
WITH restaurant_stats AS (
  SELECT 
    r.id,
    r.name,
    (SELECT COUNT(*) FROM zones WHERE restaurant_id = r.id) as zones,
    (SELECT COUNT(*) FROM table_inventory WHERE restaurant_id = r.id AND active = true) as tables,
    (SELECT COUNT(*) FROM table_adjacencies ta 
     JOIN table_inventory t ON t.id = ta.table_a 
     WHERE t.restaurant_id = r.id) as adjacencies,
    (SELECT COUNT(*) FROM restaurant_operating_hours WHERE restaurant_id = r.id) as hours,
    (SELECT COUNT(*) FROM restaurant_service_periods WHERE restaurant_id = r.id) as service_periods
  FROM restaurants r
  WHERE r.name ILIKE '%corner%' OR r.name ILIKE '%old crown%'
)
SELECT * FROM restaurant_stats;

-- 8. Check capacity for today's bookings
SELECT 
  b.booking_date,
  b.start_time,
  r.name as restaurant,
  b.party_size,
  b.booking_type,
  (
    SELECT COUNT(*) 
    FROM table_inventory ti 
    WHERE ti.restaurant_id = b.restaurant_id 
      AND ti.active = true 
      AND ti.min_party_size <= b.party_size 
      AND (ti.max_party_size IS NULL OR ti.max_party_size >= b.party_size)
  ) as available_tables_for_party
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
WHERE b.booking_date = CURRENT_DATE
ORDER BY b.start_time;

