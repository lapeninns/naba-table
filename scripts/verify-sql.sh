#!/bin/bash

echo "🔍 Verifying Supabase Seed Data via SQL..."
echo ""

# Create a temporary SQL file
cat > /tmp/verify.sql << 'EOF'
-- Verification queries
\echo '📊 Database Counts:'
\echo '────────────────────────────────────────'
SELECT 
  (SELECT COUNT(*) FROM public.restaurants) as pubs,
  (SELECT COUNT(*) FROM public.restaurant_tables) as tables,
  (SELECT COUNT(*) FROM public.customers) as customers,
  (SELECT COUNT(*) FROM public.bookings) as bookings;

\echo ''
\echo '🏪 Restaurants:'
\echo '────────────────────────────────────────'
SELECT name, capacity FROM public.restaurants ORDER BY name;

\echo ''
\echo '📅 Booking Distribution:'
\echo '────────────────────────────────────────'
SELECT 
  status,
  COUNT(*) as count
FROM public.bookings
GROUP BY status
ORDER BY count DESC;

\echo ''
\echo '✅ Verification Complete!'
EOF

# Run the SQL file
docker exec supabase_db_SajiloReserveX psql -U postgres -d postgres -f /tmp/verify.sql

# Cleanup
rm -f /tmp/verify.sql
