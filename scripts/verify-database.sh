#!/bin/bash
# ============================================================================
# Database Verification Script
# ============================================================================
# Purpose: Verify that all migrations and seeds have been applied correctly
# Usage: ./scripts/verify-database.sh
# ============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       🔍 DATABASE VERIFICATION                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Source environment variables
if [ -f .env.local ]; then
  source .env.local
else
  echo "❌ Error: .env.local file not found"
  exit 1
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Error: SUPABASE_DB_URL not set"
  exit 1
fi

echo "1️⃣  CHECKING MIGRATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase migration list

echo ""
echo "2️⃣  CHECKING SCHEMA OBJECTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  'Tables' as object_type, 
  COUNT(*)::text as count 
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
  'Functions' as object_type, 
  COUNT(*)::text as count 
FROM information_schema.routines 
WHERE routine_schema = 'public'
UNION ALL
SELECT 
  'Types' as object_type, 
  COUNT(*)::text as count 
FROM pg_type t 
JOIN pg_namespace n ON t.typnamespace = n.oid 
WHERE n.nspname = 'public' 
  AND t.typtype = 'e';
"

echo ""
echo "3️⃣  CHECKING SEED DATA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  'Restaurants' as entity,
  COUNT(*)::text as count
FROM restaurants
UNION ALL
SELECT 
  'Customers',
  COUNT(*)::text
FROM customers
UNION ALL
SELECT 
  'Bookings',
  COUNT(*)::text
FROM bookings
UNION ALL
SELECT 
  'Tables',
  COUNT(*)::text
FROM table_inventory
UNION ALL
SELECT 
  'Profiles',
  COUNT(*)::text
FROM profiles;
"

echo ""
echo "4️⃣  CHECKING BOOKING DISTRIBUTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  COUNT(CASE WHEN booking_date < CURRENT_DATE THEN 1 END) as past_bookings,
  COUNT(CASE WHEN booking_date = CURRENT_DATE THEN 1 END) as today_bookings,
  COUNT(CASE WHEN booking_date > CURRENT_DATE THEN 1 END) as future_bookings,
  COUNT(*) as total_bookings
FROM bookings;
"

echo ""
echo "5️⃣  CHECKING KEY TABLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  table_name,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT 
    table_name,
    table_schema,
    query_to_xml(format('SELECT COUNT(*) as cnt FROM %I.%I', table_schema, table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('bookings', 'customers', 'restaurants', 'table_inventory', 'booking_slots', 'profiles', 'restaurant_memberships')
) t
ORDER BY table_name;
"

echo ""
echo "6️⃣  CHECKING CRITICAL FUNCTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_booking_with_capacity_check',
    'apply_booking_state_transition',
    'assign_table_to_booking',
    'user_restaurants'
  )
ORDER BY routine_name;
"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Verification Complete!"
echo ""
echo "Expected Values:"
echo "  • Migrations: 21/21 synced (Local = Remote)"
echo "  • Tables: 23+"
echo "  • Functions: 200+"
echo "  • Types: 9+"
echo "  • Restaurants: 8"
echo "  • Customers: 530"
echo "  • Bookings: 310 (100 past, 90 today, 120 future)"
echo "  • Tables: 128"
echo "═══════════════════════════════════════════════════════════"
echo ""
