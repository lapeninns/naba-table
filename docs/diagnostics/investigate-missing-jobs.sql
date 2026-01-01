-- URGENT: Investigate Missing Jobs
-- Run this in Supabase Production to find out WHY jobs aren't being created

-- 1. Recent confirmed bookings that SHOULD have jobs
SELECT 
  id,
  reference,
  customer_name,
  customer_email,
  customer_phone,
  status,
  source,
  created_at,
  start_at,
  EXTRACT(EPOCH FROM (start_at - NOW())) / 3600 as hours_until_start,
  CASE 
    WHEN customer_email IS NULL OR customer_email = '' THEN '❌ No email'
    ELSE '✅ Has email'
  END as email_status
FROM bookings
WHERE status = 'confirmed'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND start_at > NOW()  -- Future bookings
ORDER BY created_at DESC;

-- 2. Check if any bookings have missing emails (might explain no jobs)
SELECT 
  COUNT(*) as confirmed_bookings,
  COUNT(CASE WHEN customer_email IS NOT NULL AND customer_email != '' THEN 1 END) as with_email,
  COUNT(CASE WHEN customer_email IS NULL OR customer_email = '' THEN 1 END) as without_email
FROM bookings
WHERE status = 'confirmed'
  AND created_at >= NOW() - INTERVAL '7 days';

-- 3. Check specific recent booking details
SELECT 
  id,
  reference,
  customer_email,
  status,
  source,
  created_at,
  details
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if bookings were created through the API or other means
SELECT 
  source,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed
FROM bookings
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY source;
