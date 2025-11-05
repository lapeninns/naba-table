#!/bin/bash

# ============================================================================
# Run Allocation Algorithm Stress Test
# ============================================================================
# This script runs your table allocation algorithm against today's bookings
# and measures performance metrics
# ============================================================================

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ALLOCATION ALGORITHM STRESS TEST RUNNER                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load environment
source .env.local

# Get baseline stats
echo "📊 Baseline Statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$SUPABASE_DB_URL" -c "
SELECT 
  'Bookings pending: ' || COUNT(*)::text
FROM public.bookings 
WHERE booking_date = CURRENT_DATE 
AND status = 'confirmed'
AND id NOT IN (SELECT booking_id FROM public.booking_table_assignments);
"
echo ""

# Run allocation for each restaurant
echo "⚡ Running Allocation Algorithm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

START_TIME=$(date +%s)

# Get all restaurants
RESTAURANTS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT slug FROM public.restaurants ORDER BY name;")

for slug in $RESTAURANTS; do
  echo "  Processing: $slug..."
  
  # Run the allocation script for this restaurant
  TARGET_RESTAURANT_SLUG="$slug" TARGET_DATE=$(date +%Y-%m-%d) tsx -r tsconfig-paths/register scripts/ops-auto-assign-ultra-fast.ts || true
  
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "  ✅ Allocation complete in ${DURATION}s"
echo ""

# Get post-allocation stats
echo "📊 Post-Allocation Statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$SUPABASE_DB_URL" << 'EOF'
SELECT 
  'Total bookings: ' || COUNT(*)::text
FROM public.bookings 
WHERE booking_date = CURRENT_DATE;

SELECT 
  'Successfully allocated: ' || COUNT(*)::text
FROM public.bookings b
WHERE booking_date = CURRENT_DATE 
AND EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = b.id);

SELECT 
  'Still pending: ' || COUNT(*)::text
FROM public.bookings 
WHERE booking_date = CURRENT_DATE 
AND status IN ('confirmed', 'pending_allocation')
AND id NOT IN (SELECT booking_id FROM public.booking_table_assignments);

SELECT 
  'Tables used: ' || COUNT(DISTINCT bta.table_id)::text || ' / 90'
FROM public.booking_table_assignments bta
JOIN public.bookings b ON b.id = bta.booking_id
WHERE b.booking_date = CURRENT_DATE;

SELECT 
  'Multi-table assignments: ' || COUNT(*)::text
FROM (
  SELECT booking_id 
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE b.booking_date = CURRENT_DATE
  GROUP BY booking_id
  HAVING COUNT(*) > 1
) multi;

SELECT 
  'Average party size allocated: ' || ROUND(AVG(b.party_size), 1)::text
FROM public.bookings b
WHERE booking_date = CURRENT_DATE 
AND EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = b.id);
EOF

echo ""

# Run validation
echo "⚡ Constraint Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

pnpm run db:stress-test

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  STRESS TEST COMPLETE                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Performance: ${DURATION}s for all allocations"
echo "  See full results above"
echo ""
