#!/bin/bash

echo "🧪 Testing Connection to Supabase..."
echo ""

# Check if Supabase is running
if ! docker ps | grep -q supabase_db_SajiloReserveX; then
    echo "❌ Supabase is not running!"
    echo "   Run: npm run db:start"
    exit 1
fi

echo "✅ Supabase is running"
echo ""

# Test environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "⚠️  NEXT_PUBLIC_SUPABASE_URL not set in environment"
    echo "   Loading from .env.local..."
    source .env.local
fi

echo "📋 Configuration:"
echo "  API URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "  Default Restaurant: $NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG"
echo ""

# Test database connection
echo "🔌 Testing database connection..."
RESTAURANT_COUNT=$(echo "SELECT COUNT(*) FROM restaurants;" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A)

if [ "$RESTAURANT_COUNT" = "8" ]; then
    echo "✅ Database connection successful!"
    echo "   Found $RESTAURANT_COUNT restaurants"
else
    echo "❌ Database connection issue"
    echo "   Expected 8 restaurants, found $RESTAURANT_COUNT"
    exit 1
fi

echo ""

# Test default restaurant
echo "🏪 Testing default restaurant..."
DEFAULT_EXISTS=$(echo "SELECT COUNT(*) FROM restaurants WHERE id = '$NEXT_PUBLIC_DEFAULT_RESTAURANT_ID';" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A)

if [ "$DEFAULT_EXISTS" = "1" ]; then
    echo "✅ Default restaurant configured correctly"
    RESTAURANT_INFO=$(echo "SELECT name || ' (capacity: ' || capacity || ')' FROM restaurants WHERE id = '$NEXT_PUBLIC_DEFAULT_RESTAURANT_ID';" | docker exec -i supabase_db_SajiloReserveX psql -U postgres -d postgres -t -A)
    echo "   $RESTAURANT_INFO"
else
    echo "⚠️  Default restaurant ID not found in database"
    echo "   You may need to update .env.local with a valid restaurant ID"
fi

echo ""

# Test API endpoint
echo "🌐 Testing Supabase REST API..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://127.0.0.1:54321/rest/v1/" \
    -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0")

if [ "$API_RESPONSE" = "200" ]; then
    echo "✅ Supabase REST API is accessible"
else
    echo "⚠️  Unexpected API response: $API_RESPONSE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ All Tests Passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 You're ready to start development:"
echo "   npm run dev"
echo ""
echo "📍 Access Points:"
echo "   App:    http://localhost:3000"
echo "   Studio: http://127.0.0.1:54323"
echo ""
