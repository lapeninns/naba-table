#!/bin/bash

echo "🔍 Verifying Supabase Seed Data via SQL..."
echo ""

# Create a temporary SQL file
cat > /tmp/verify.sql << 'EOF'
-- Verification queries
\echo '📊 Database Counts:'
\echo '────────────────────────────────────────'
SELECT 
  (SELECT COUNT(*) FROM public.restaurants) AS pubs,
  (
    SELECT
      CASE
        WHEN to_regclass('public.restaurant_tables') IS NULL THEN NULL
        ELSE (SELECT COUNT(*) FROM public.restaurant_tables)
      END
  ) AS tables,
  (SELECT COUNT(*) FROM public.customers) AS customers,
  (SELECT COUNT(*) FROM public.bookings) AS bookings;

\echo ''
\echo '🏪 Restaurants:'
\echo '────────────────────────────────────────'
SELECT name, capacity FROM public.restaurants ORDER BY name;

\echo ''
\echo '📅 Booking Distribution:'
\echo '────────────────────────────────────────'
SELECT status, COUNT(*) AS count
FROM public.bookings
GROUP BY status
ORDER BY count DESC;

\echo ''
\echo '📆 Past / Today / Future:'
\echo '────────────────────────────────────────'
SELECT
  COUNT(*) FILTER (WHERE booking_date < CURRENT_DATE) AS past,
  COUNT(*) FILTER (WHERE booking_date = CURRENT_DATE) AS today,
  COUNT(*) FILTER (WHERE booking_date > CURRENT_DATE) AS future
FROM public.bookings;

\echo ''
\echo '🏪 Bookings per Restaurant:'
\echo '────────────────────────────────────────'
SELECT
  r.name,
  COUNT(b.*) AS bookings
FROM public.restaurants r
LEFT JOIN public.bookings b ON b.restaurant_id = r.id
GROUP BY r.name
ORDER BY r.name;

\echo ''
\echo '⭐ Special Guest (amanshresthaaaaa@gmail.com):'
\echo '────────────────────────────────────────'
SELECT
  r.name,
  COUNT(b.*) AS bookings
FROM public.bookings b
JOIN public.restaurants r ON r.id = b.restaurant_id
WHERE b.customer_email = 'amanshresthaaaaa@gmail.com'
GROUP BY r.name
ORDER BY r.name;

\echo ''
\echo '✅ Verification Complete!'
EOF

# Run the SQL file
docker exec supabase_db_SajiloReserveX psql -U postgres -d postgres -f /tmp/verify.sql

# Cleanup
rm -f /tmp/verify.sql
