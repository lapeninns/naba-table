#!/bin/bash
set -euo pipefail

# Script to dump current database data into seed SQL files
# This pulls the actual data from your Supabase production instance

echo "🔍 Dumping seed data from Supabase database..."

# Source environment variables
if [ -f .env.local ]; then
  source .env.local
else
  echo "❌ .env.local not found!"
  exit 1
fi

# Check if SUPABASE_DB_URL is set
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ SUPABASE_DB_URL not set in .env.local"
  exit 1
fi

OUTPUT_DIR="supabase/seeds/dumps"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📦 Output directory: $OUTPUT_DIR"

# Tables to dump (in order to respect foreign key constraints)
TABLES=(
  "restaurants"
  "service_periods"
  "zones"
  "tables"
  "allowed_capacities"
  "table_adjacencies"
  "occasions"
  "bookings"
  "booking_table_assignments"
  "booking_status_changes"
  "team_memberships"
  "team_invitations"
)

echo "📊 Dumping tables..."

for TABLE in "${TABLES[@]}"; do
  echo "  → Dumping $TABLE..."
  
  OUTPUT_FILE="$OUTPUT_DIR/${TABLE}-${TIMESTAMP}.sql"
  
  # Use pg_dump to get INSERT statements for the table
  # --data-only: only data, no schema
  # --inserts: use INSERT statements instead of COPY
  # --no-owner: skip ownership commands
  # --no-privileges: skip privilege commands
  # --table: specific table
  
  PGPASSWORD="${SUPABASE_DB_PASSWORD}" pg_dump \
    --host="aws-1-eu-north-1.pooler.supabase.com" \
    --port=6543 \
    --username="postgres.mqtchcaavsucsdjskptc" \
    --dbname="postgres" \
    --data-only \
    --inserts \
    --no-owner \
    --no-privileges \
    --table="public.$TABLE" \
    --file="$OUTPUT_FILE" 2>/dev/null || echo "    ⚠️  No data or table doesn't exist"
  
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    echo "    ✅ Saved to $OUTPUT_FILE"
  else
    rm -f "$OUTPUT_FILE" 2>/dev/null || true
    echo "    ⏭️  Skipped (empty or no data)"
  fi
done

# Create a combined seed file
COMBINED_FILE="$OUTPUT_DIR/full-seed-${TIMESTAMP}.sql"
echo ""
echo "📝 Creating combined seed file..."

{
  echo "-- Full database seed dump"
  echo "-- Generated: $(date)"
  echo "-- Database: Production Supabase"
  echo ""
  echo "-- IMPORTANT: This will TRUNCATE all tables and reset data!"
  echo "-- Run with: psql \"\$SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 -f $COMBINED_FILE"
  echo ""
  echo "BEGIN;"
  echo ""
  echo "-- Truncate tables (respects FK constraints with CASCADE)"
  for TABLE in $(echo "${TABLES[@]}" | tr ' ' '\n' | tac); do
    echo "TRUNCATE TABLE public.$TABLE CASCADE;"
  done
  echo ""
  
  # Append all dumped files in order
  for TABLE in "${TABLES[@]}"; do
    FILE="$OUTPUT_DIR/${TABLE}-${TIMESTAMP}.sql"
    if [ -f "$FILE" ]; then
      echo ""
      echo "-- ============================================"
      echo "-- $TABLE"
      echo "-- ============================================"
      echo ""
      cat "$FILE"
    fi
  done
  
  echo ""
  echo "COMMIT;"
  echo ""
  echo "-- Seed data dump completed successfully"
} > "$COMBINED_FILE"

echo "✅ Combined seed file created: $COMBINED_FILE"
echo ""
echo "📋 Summary:"
echo "   Individual files: $OUTPUT_DIR/*-${TIMESTAMP}.sql"
echo "   Combined file:    $COMBINED_FILE"
echo ""
echo "🚀 To restore this data:"
echo "   psql \"\$SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 -f $COMBINED_FILE"
echo ""
echo "✨ Done!"
