-- Diagnostic: Last 24 Hours Booking Activity
-- Run this in your Supabase SQL Editor

-- 1. Recent bookings (last 24 hours)
SELECT 
  id,
  reference,
  customer_name,
  customer_email,
  status,
  source,
  created_at,
  details->'channel' as channel
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 2. Count by status
SELECT 
  status,
  COUNT(*) as count,
  source
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status, source
ORDER BY count DESC;

-- 3. Bookings that should have triggered emails
SELECT 
  id,
  reference,
  customer_name,
  customer_email,
  customer_phone,
  status,
  source,
  created_at,
  CASE 
    WHEN customer_email IS NOT NULL AND customer_email != '' THEN 'Should send email'
    ELSE 'No email (phone only)'
  END as email_status
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 4. Check booking_history for email-related events
SELECT 
  bh.booking_id,
  b.reference,
  bh.action,
  bh.metadata,
  bh.created_at
FROM booking_history bh
JOIN bookings b ON b.id = bh.booking_id
WHERE bh.created_at >= NOW() - INTERVAL '24 hours'
  AND (
    bh.metadata::text ILIKE '%email%' OR
    bh.action IN ('created', 'confirmed', 'checked_in')
  )
ORDER BY bh.created_at DESC
LIMIT 50;

-- 5. Recent ops walk-in bookings (might have optional contact fields)
SELECT 
  id,
  reference,
  customer_name,
  customer_email,
  customer_phone,
  status,
  source,
  details->'created_by' as created_by,
  details->'staff' as staff_info,
  created_at
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND source = 'walk-in'
ORDER BY created_at DESC;
