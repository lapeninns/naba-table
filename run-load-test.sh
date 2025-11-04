#!/bin/bash

# Start dev server in background
echo "🚀 Starting dev server..."
pnpm run dev > /tmp/sajilo-dev.log 2>&1 &
DEV_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if ! lsof -ti:3000 > /dev/null 2>&1; then
    echo "❌ Server failed to start. Check /tmp/sajilo-dev.log"
    exit 1
fi

echo "✅ Server is running on port 3000"

# Run the load test
echo "📊 Running load test..."
BASE_URL=http://localhost:3000 LOAD_TEST_DISABLE_EMAILS=true npx tsx scripts/booking-pack-fill.ts --date 2025-11-05 --slug old-crown-pub-girton --maxPerSlot 30

# Capture exit code
TEST_EXIT=$?

# Kill the dev server
echo "🛑 Stopping dev server..."
kill $DEV_PID 2>/dev/null

exit $TEST_EXIT
