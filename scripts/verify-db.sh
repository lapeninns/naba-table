#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Supabase connection details
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo -e "${BLUE}🔍 Verifying Supabase Seed Data...${NC}\n"

# Function to query and display results
query_count() {
    local table=$1
    local label=$2
    local expected=$3
    
    count=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Prefer: count=exact" \
        | grep -o '"count":[0-9]*' | cut -d':' -f2)
    
    if [ "$count" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} ${label}: ${count} (expected: ${expected})"
    else
        echo -e "  ${RED}✗${NC} ${label}: ${count} (expected: ${expected})"
    fi
}

echo -e "${YELLOW}📊 Database Counts:${NC}"
echo "────────────────────────────────────────"
query_count "restaurants" "Restaurants" "8"
query_count "restaurant_tables" "Tables" "96"
query_count "customers" "Customers" "640"
query_count "bookings" "Bookings" "400"

echo ""
echo -e "${YELLOW}🏪 Restaurant Names:${NC}"
echo "────────────────────────────────────────"

# Get restaurant names
restaurants=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/restaurants?select=name,capacity&order=name" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "$restaurants" | jq -r '.[] | "  • \(.name) (capacity: \(.capacity))"' 2>/dev/null || echo "  (jq not installed - install with: brew install jq)"

echo ""
echo -e "${YELLOW}📅 Sample Bookings:${NC}"
echo "────────────────────────────────────────"

# Get sample bookings
bookings=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/bookings?select=customer_name,booking_date,start_time,status&limit=5&order=booking_date" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "$bookings" | jq -r '.[] | "  • \(.customer_name) - \(.booking_date) at \(.start_time) (\(.status))"' 2>/dev/null || echo "  (install jq to see details: brew install jq)"

echo ""
echo -e "${GREEN}✅ Verification Complete!${NC}"
echo ""
echo -e "${BLUE}📍 Next Steps:${NC}"
echo "  1. Open Supabase Studio: http://127.0.0.1:54323"
echo "  2. Run verification queries from: supabase/verify-queries.sql"
echo "  3. Update .env.local with Supabase credentials"
echo "  4. Start your app: npm run dev"
echo ""
