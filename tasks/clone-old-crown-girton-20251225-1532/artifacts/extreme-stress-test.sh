#!/bin/bash
# EXTREME Stress test - Same day capacity testing
# Run with: bash extreme-stress-test.sh

BASE_URL="https://nabatable.com"
RESTAURANT_ID="a050d1ad-1ee0-4ea0-abc2-22c3778aa52c"  # The Old Crown Girton (Production)
TEST_DATE="2026-02-14"  # Valentine's Day - a fresh date for testing

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🔥 EXTREME Stress Test: Capacity Limits"
echo "📍 The Old Crown Girton (Production)"
echo "📅 Test Date: $TEST_DATE"
echo "=========================================="
echo ""

# Counters
success=0
failed=0
booking_num=0

# Function to create a booking
create_booking() {
  local booking_type=$1
  local time=$2
  local party_size=$3
  local label=$4
  
  ((booking_num++))
  local name="Stress Test $booking_num"
  local email="stress$booking_num@stresstest.com"
  local phone="+4477009${booking_num}0000"
  
  echo -n "[$booking_num] 📝 $label: $booking_type @ $time for $party_size guests... "
  
  response=$(curl -sL -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings" \
    -H "Content-Type: application/json" \
    -d '{
      "restaurantId": "'"$RESTAURANT_ID"'",
      "bookingType": "'"$booking_type"'",
      "date": "'"$TEST_DATE"'",
      "time": "'"$time"'",
      "party": '"$party_size"',
      "seating": "any",
      "name": "'"$name"'",
      "email": "'"$email"'",
      "phone": "'"$phone"'",
      "marketingOptIn": false
    }')
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "201" ]; then
    booking_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    status=$(echo "$body" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}✅ $status${NC} (${booking_id:0:8}...)"
    ((success++))
    return 0
  else
    error=$(echo "$body" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -z "$error" ]; then
      error=$(echo "$body" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    echo -e "${RED}❌ HTTP $http_code${NC} - $error"
    ((failed++))
    return 1
  fi
}

echo -e "${CYAN}=== PHASE 1: LUNCH SERVICE (12:00-14:30) ===${NC}"
echo "Flooding the lunch service with bookings..."
echo "--------------------------------------------"

# 12:00 slot - Fill it up
create_booking "lunch" "12:00" 2 "Slot 12:00 #1"
create_booking "lunch" "12:00" 4 "Slot 12:00 #2"
create_booking "lunch" "12:00" 6 "Slot 12:00 #3"
create_booking "lunch" "12:00" 2 "Slot 12:00 #4"
create_booking "lunch" "12:00" 4 "Slot 12:00 #5"

# 12:30 slot
create_booking "lunch" "12:30" 2 "Slot 12:30 #1"
create_booking "lunch" "12:30" 4 "Slot 12:30 #2"
create_booking "lunch" "12:30" 6 "Slot 12:30 #3"
create_booking "lunch" "12:30" 8 "Slot 12:30 #4"
create_booking "lunch" "12:30" 2 "Slot 12:30 #5"

# 13:00 slot
create_booking "lunch" "13:00" 2 "Slot 13:00 #1"
create_booking "lunch" "13:00" 4 "Slot 13:00 #2"
create_booking "lunch" "13:00" 6 "Slot 13:00 #3"
create_booking "lunch" "13:00" 4 "Slot 13:00 #4"
create_booking "lunch" "13:00" 2 "Slot 13:00 #5"

# 13:30 slot
create_booking "lunch" "13:30" 2 "Slot 13:30 #1"
create_booking "lunch" "13:30" 4 "Slot 13:30 #2"
create_booking "lunch" "13:30" 6 "Slot 13:30 #3"

# 14:00 slot (late lunch)
create_booking "lunch" "14:00" 2 "Slot 14:00 #1"
create_booking "lunch" "14:00" 4 "Slot 14:00 #2"

echo ""
echo -e "${CYAN}=== PHASE 2: DINNER SERVICE (18:00-21:00) ===${NC}"
echo "Flooding the dinner service with bookings..."
echo "--------------------------------------------"

# 18:00 slot - Early dinner
create_booking "dinner" "18:00" 2 "Slot 18:00 #1"
create_booking "dinner" "18:00" 4 "Slot 18:00 #2"
create_booking "dinner" "18:00" 6 "Slot 18:00 #3"
create_booking "dinner" "18:00" 2 "Slot 18:00 #4"
create_booking "dinner" "18:00" 4 "Slot 18:00 #5"

# 18:30 slot
create_booking "dinner" "18:30" 2 "Slot 18:30 #1"
create_booking "dinner" "18:30" 4 "Slot 18:30 #2"
create_booking "dinner" "18:30" 6 "Slot 18:30 #3"
create_booking "dinner" "18:30" 8 "Slot 18:30 #4"

# 19:00 slot - Prime time
create_booking "dinner" "19:00" 2 "Slot 19:00 #1"
create_booking "dinner" "19:00" 4 "Slot 19:00 #2"
create_booking "dinner" "19:00" 6 "Slot 19:00 #3"
create_booking "dinner" "19:00" 4 "Slot 19:00 #4"
create_booking "dinner" "19:00" 2 "Slot 19:00 #5"
create_booking "dinner" "19:00" 8 "Slot 19:00 #6"

# 19:30 slot - Peak time
create_booking "dinner" "19:30" 2 "Slot 19:30 #1"
create_booking "dinner" "19:30" 4 "Slot 19:30 #2"
create_booking "dinner" "19:30" 6 "Slot 19:30 #3"
create_booking "dinner" "19:30" 4 "Slot 19:30 #4"
create_booking "dinner" "19:30" 2 "Slot 19:30 #5"
create_booking "dinner" "19:30" 8 "Slot 19:30 #6"

# 20:00 slot
create_booking "dinner" "20:00" 2 "Slot 20:00 #1"
create_booking "dinner" "20:00" 4 "Slot 20:00 #2"
create_booking "dinner" "20:00" 6 "Slot 20:00 #3"
create_booking "dinner" "20:00" 4 "Slot 20:00 #4"

# 20:30 slot
create_booking "dinner" "20:30" 2 "Slot 20:30 #1"
create_booking "dinner" "20:30" 4 "Slot 20:30 #2"
create_booking "dinner" "20:30" 6 "Slot 20:30 #3"

echo ""
echo -e "${CYAN}=== PHASE 3: DRINKS/BAR (15:00-17:30) ===${NC}"
echo "Flooding the bar with drinks bookings..."
echo "-----------------------------------------"

create_booking "drinks" "15:00" 2 "Slot 15:00 #1"
create_booking "drinks" "15:00" 4 "Slot 15:00 #2"
create_booking "drinks" "15:30" 2 "Slot 15:30 #1"
create_booking "drinks" "15:30" 4 "Slot 15:30 #2"
create_booking "drinks" "16:00" 2 "Slot 16:00 #1"
create_booking "drinks" "16:00" 4 "Slot 16:00 #2"
create_booking "drinks" "16:00" 6 "Slot 16:00 #3"
create_booking "drinks" "16:30" 2 "Slot 16:30 #1"
create_booking "drinks" "16:30" 4 "Slot 16:30 #2"
create_booking "drinks" "17:00" 2 "Slot 17:00 #1"
create_booking "drinks" "17:00" 4 "Slot 17:00 #2"
create_booking "drinks" "17:00" 6 "Slot 17:00 #3"
create_booking "drinks" "17:30" 2 "Slot 17:30 #1"
create_booking "drinks" "17:30" 4 "Slot 17:30 #2"

echo ""
echo -e "${CYAN}=== PHASE 4: LARGE PARTY STRESS TEST ===${NC}"
echo "Testing large party bookings..."
echo "--------------------------------"

create_booking "dinner" "18:00" 10 "Large Party #1"
create_booking "dinner" "19:00" 12 "Large Party #2"
create_booking "dinner" "19:30" 10 "Large Party #3"
create_booking "dinner" "20:00" 14 "Large Party #4"
create_booking "lunch" "12:30" 10 "Large Party #5"
create_booking "lunch" "13:00" 12 "Large Party #6"

echo ""
echo "=========================================="
echo -e "📊 ${CYAN}EXTREME STRESS TEST RESULTS${NC}"
echo "=========================================="
echo -e "📅 Test Date: $TEST_DATE"
echo -e "📍 Restaurant: The Old Crown Girton"
echo ""
echo -e "✅ Successful bookings: ${GREEN}$success${NC}"
echo -e "❌ Failed bookings: ${RED}$failed${NC}"
total=$((success + failed))
if [ $total -gt 0 ]; then
  rate=$((success * 100 / total))
  echo -e "📈 Success Rate: ${YELLOW}$rate%${NC}"
fi
echo ""
echo "Total guests booked: (run SQL below to calculate)"
echo ""
echo "=========================================="
echo "📋 SQL to verify bookings & assignments:"
echo "=========================================="
echo ""
cat << 'EOF'
-- Count bookings by status
SELECT 
  status, 
  COUNT(*) as count,
  SUM(party_size) as total_guests
FROM bookings 
WHERE booking_date = '2026-02-14'
  AND restaurant_id = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c'
GROUP BY status;

-- Check table assignments
SELECT 
  b.start_time,
  b.booking_type,
  b.party_size,
  b.status,
  COUNT(bta.id) as tables_assigned
FROM bookings b
LEFT JOIN booking_table_assignments bta ON bta.booking_id = b.id
WHERE b.booking_date = '2026-02-14'
  AND b.restaurant_id = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c'
GROUP BY b.id, b.start_time, b.booking_type, b.party_size, b.status
ORDER BY b.start_time;

-- Check capacity usage by time slot
SELECT 
  start_time,
  COUNT(*) as bookings,
  SUM(party_size) as total_covers
FROM bookings 
WHERE booking_date = '2026-02-14'
  AND restaurant_id = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c'
  AND status IN ('confirmed', 'pending')
GROUP BY start_time
ORDER BY start_time;
EOF
