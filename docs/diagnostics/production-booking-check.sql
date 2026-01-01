-- Production Diagnostic: Check Recent Booking Activity
-- Run this in Supabase SQL Editor (use PRODUCTION database)

-- 1. Bookings in last 24 hours
SELECT 
  id,
  reference,
  customer_name,
  customer_email,
  status,
  source,
  created_at,
  start_at,
  details
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Count by status (last 24h)
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN customer_email IS NOT NULL AND customer_email != '' THEN 1 END) as with_email
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- 3. Confirmed bookings that should have jobs (last 24h)
SELECT 
  id,
  reference,
  customer_name,
  customer_email,
  status,
  created_at,
  start_at,
  EXTRACT(EPOCH FROM (start_at - NOW())) / 3600 as hours_until_start
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND status = 'confirmed'
  AND customer_email IS NOT NULL
  AND customer_email != ''
ORDER BY created_at DESC;

-- 4. Recent bookings (last 7 days) summary
SELECT 
  DATE(created_at) as booking_date,
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN customer_email IS NOT NULL AND customer_email != '' THEN 1 END) as has_email
FROM bookings
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY booking_date DESC;
