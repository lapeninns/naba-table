#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 Supabase Seed Verification${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

# 1. Check counts
echo -e "${YELLOW}📊 Database Counts:${NC}"
echo "SELECT 
  (SELECT COUNT(*) FROM public.restaurants) as restaurants,
  (SELECT COUNT(*) FROM public.restaurant_operating_hours) as operating_hours,
  (SELECT COUNT(*) FROM public.restaurant_capacity_rules) as capacity_rules,
  (SELECT COUNT(*) FROM public.customers) as customers,
  (SELECT COUNT(*) FROM public.bookings) as bookings;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A -F' | ' | awk '{print "  " $0}'

echo ""
echo -e "${YELLOW}🏪 Restaurants (8 pubs):${NC}"
echo "SELECT '  • ' || name || ' (capacity: ' || capacity || ')' FROM public.restaurants ORDER BY name;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A

echo ""
echo -e "${YELLOW}📅 Booking Distribution:${NC}"
echo "────────────────────────────────────────"
printf "%-25s %6s %7s %8s %7s\n" "Restaurant" "Past" "Today" "Future" "Total"
echo "────────────────────────────────────────"
echo "SELECT 
  RPAD(r.name, 25) || 
  LPAD(COUNT(CASE WHEN b.booking_date < CURRENT_DATE THEN 1 END)::text, 6) || 
  LPAD(COUNT(CASE WHEN b.booking_date = CURRENT_DATE THEN 1 END)::text, 7) || 
  LPAD(COUNT(CASE WHEN b.booking_date > CURRENT_DATE THEN 1 END)::text, 8) || 
  LPAD(COUNT(*)::text, 7)
FROM restaurants r
LEFT JOIN bookings b ON b.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A

echo ""
echo -e "${YELLOW}📋 Booking Status Distribution:${NC}"
echo "────────────────────────────────────────"
printf "%-15s %10s\n" "Status" "Count"
echo "────────────────────────────────────────"
echo "SELECT 
  RPAD(status::text, 15) || LPAD(COUNT(*)::text, 10)
FROM bookings 
GROUP BY status 
ORDER BY COUNT(*) DESC;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A

echo ""
echo -e "${YELLOW}🔍 Data Integrity Checks:${NC}"
echo "────────────────────────────────────────"

# Check for overlaps
overlaps=$(echo "SELECT COUNT(*) FROM bookings b1 JOIN bookings b2 ON b1.restaurant_id = b2.restaurant_id AND b1.id < b2.id AND b1.status IN ('confirmed', 'pending') AND b2.status IN ('confirmed', 'pending') AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)');" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A)

if [ "$overlaps" = "0" ]; then
    echo -e "  ${GREEN}✓${NC} No overlapping bookings"
else
    echo -e "  ${RED}✗${NC} Found $overlaps overlapping bookings!"
fi

# Check unique references
duplicates=$(echo "SELECT COUNT(*) FROM (SELECT reference, COUNT(*) FROM bookings GROUP BY reference HAVING COUNT(*) > 1) AS dups;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A)

if [ "$duplicates" = "0" ]; then
    echo -e "  ${GREEN}✓${NC} All booking references are unique"
else
    echo -e "  ${RED}✗${NC} Found $duplicates duplicate references!"
fi

# Check customer email uniqueness per restaurant
email_dups=$(echo "SELECT COUNT(*) FROM (SELECT restaurant_id, email_normalized, COUNT(*) FROM customers GROUP BY restaurant_id, email_normalized HAVING COUNT(*) > 1) AS dups;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A)

if [ "$email_dups" = "0" ]; then
    echo -e "  ${GREEN}✓${NC} All customer emails unique per restaurant"
else
    echo -e "  ${RED}✗${NC} Found $email_dups duplicate emails!"
fi

echo ""
echo -e "${YELLOW}📍 Sample Bookings (Today):${NC}"
echo "────────────────────────────────────────"
echo "SELECT 
  '  ' || r.name || ' at ' || b.start_time || 
  ' (' || b.customer_name || ', party of ' || b.party_size || ')'
FROM bookings b
JOIN restaurants r ON r.id = b.restaurant_id
WHERE b.booking_date = CURRENT_DATE
ORDER BY r.name, b.start_time
LIMIT 10;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A

echo ""
echo -e "${GREEN}✅ Verification Complete!${NC}"
echo ""
echo -e "${BLUE}📍 Next Steps:${NC}"
echo "  1. Open Supabase Studio: http://127.0.0.1:54323"
echo "  2. Browse tables in the Table Editor"
echo "  3. Run custom queries in the SQL Editor"
echo "  4. Copy queries from: supabase/verify-queries.sql"
echo ""
echo -e "${BLUE}🔗 Connection Details:${NC}"
echo "  API URL:  http://127.0.0.1:54321"
echo "  DB URL:   postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo "  Studio:   http://127.0.0.1:54323"
echo ""
