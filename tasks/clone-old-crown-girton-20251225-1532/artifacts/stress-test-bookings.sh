#!/bin/bash
# Stress test script for booking system
# Run with: bash stress-test-bookings.sh

BASE_URL="https://nabatable.com"
RESTAURANT_ID="a050d1ad-1ee0-4ea0-abc2-22c3778aa52c"  # The Old Crown Girton (Production)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🧪 Stress Test: The Old Crown Girton (PROD)"
echo "=========================================="
echo ""

# Function to create a booking
create_booking() {
  local booking_type=$1
  local date=$2
  local time=$3
  local party_size=$4
  local name=$5
  local email=$6
  local phone=$7
  
  echo -n "📝 Creating $booking_type booking for $party_size guests on $date at $time... "
  
  response=$(curl -sL -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings" \
    -H "Content-Type: application/json" \
    -d '{
      "restaurantId": "'"$RESTAURANT_ID"'",
      "bookingType": "'"$booking_type"'",
      "date": "'"$date"'",
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
    echo -e "${GREEN}✅ Success${NC} - ID: ${booking_id:0:8}... Status: $status"
    return 0
  else
    error=$(echo "$body" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${RED}❌ Failed${NC} - HTTP $http_code - $error"
    return 1
  fi
}

# Counter for results
success=0
failed=0

echo "Testing LUNCH bookings..."
echo "-------------------------"
create_booking "lunch" "2026-01-05" "12:30" 2 "Test Lunch 1" "test.lunch1@example.com" "+447700900001" && ((success++)) || ((failed++))
create_booking "lunch" "2026-01-06" "13:00" 4 "Test Lunch 2" "test.lunch2@example.com" "+447700900002" && ((success++)) || ((failed++))
create_booking "lunch" "2026-01-07" "12:00" 6 "Test Lunch 3" "test.lunch3@example.com" "+447700900003" && ((success++)) || ((failed++))

echo ""
echo "Testing DINNER bookings..."
echo "--------------------------"
create_booking "dinner" "2026-01-05" "18:00" 2 "Test Dinner 1" "test.dinner1@example.com" "+447700900004" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-06" "19:00" 4 "Test Dinner 2" "test.dinner2@example.com" "+447700900005" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-07" "20:00" 6 "Test Dinner 3" "test.dinner3@example.com" "+447700900006" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-08" "19:30" 8 "Test Dinner 4" "test.dinner4@example.com" "+447700900007" && ((success++)) || ((failed++))

echo ""
echo "Testing DRINKS bookings..."
echo "--------------------------"
create_booking "drinks" "2026-01-05" "15:00" 2 "Test Drinks 1" "test.drinks1@example.com" "+447700900008" && ((success++)) || ((failed++))
create_booking "drinks" "2026-01-06" "16:00" 4 "Test Drinks 2" "test.drinks2@example.com" "+447700900009" && ((success++)) || ((failed++))
create_booking "drinks" "2026-01-07" "18:00" 6 "Test Drinks 3" "test.drinks3@example.com" "+447700900010" && ((success++)) || ((failed++))

echo ""
echo "Testing LARGE party sizes..."
echo "----------------------------"
create_booking "dinner" "2026-01-09" "19:00" 10 "Test Large 1" "test.large1@example.com" "+447700900011" && ((success++)) || ((failed++))
create_booking "lunch" "2026-01-10" "12:30" 12 "Test Large 2" "test.large2@example.com" "+447700900012" && ((success++)) || ((failed++))

echo ""
echo "Testing SAME time slot (capacity test)..."
echo "------------------------------------------"
create_booking "dinner" "2026-01-15" "19:00" 4 "Same Slot 1" "sameslot1@example.com" "+447700900013" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-15" "19:00" 4 "Same Slot 2" "sameslot2@example.com" "+447700900014" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-15" "19:00" 4 "Same Slot 3" "sameslot3@example.com" "+447700900015" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-15" "19:00" 4 "Same Slot 4" "sameslot4@example.com" "+447700900016" && ((success++)) || ((failed++))
create_booking "dinner" "2026-01-15" "19:00" 4 "Same Slot 5" "sameslot5@example.com" "+447700900017" && ((success++)) || ((failed++))

echo ""
echo "=========================================="
echo "📊 RESULTS"
echo "=========================================="
echo -e "✅ Successful: ${GREEN}$success${NC}"
echo -e "❌ Failed: ${RED}$failed${NC}"
total=$((success + failed))
echo "📈 Success Rate: $((success * 100 / total))%"
echo ""

# Check if any bookings were confirmed with table assignments
echo "Checking table assignments..."
echo "Run this SQL in Supabase to verify:"
echo ""
echo "SELECT b.id, b.status, COUNT(bta.id) as tables"
echo "FROM bookings b"
echo "LEFT JOIN booking_table_assignments bta ON bta.booking_id = b.id"
echo "WHERE b.customer_email LIKE 'test.%@example.com'"
echo "   OR b.customer_email LIKE 'sameslot%@example.com'"
echo "GROUP BY b.id"
echo "ORDER BY b.created_at DESC;"
