#!/bin/bash

# Extract database objects from migrations
OUTPUT_DIR="/Users/amankumarshrestha/Downloads/SajiloReserveX/database_export"
MIGRATIONS_DIR="/Users/amankumarshrestha/Downloads/SajiloReserveX/supabase/supabase/migrations"

echo "Extracting database objects from migrations..."

# Extract CREATE FUNCTION definitions
echo "## Database Functions" > "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"
echo "Extracted from migration files:" >> "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"

# Find all functions
grep -rh "CREATE.*FUNCTION\|CREATE OR REPLACE FUNCTION" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
  sed 's/^[[:space:]]*//' | \
  sort -u >> "$OUTPUT_DIR/database_functions.md"

# Extract CREATE VIEW definitions
echo "" >> "$OUTPUT_DIR/database_functions.md"
echo "## Database Views" >> "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"

grep -rh "CREATE.*VIEW\|CREATE OR REPLACE VIEW" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
  sed 's/^[[:space:]]*//' | \
  sort -u >> "$OUTPUT_DIR/database_functions.md"

# Extract CREATE TRIGGER definitions
echo "" >> "$OUTPUT_DIR/database_functions.md"
echo "## Database Triggers" >> "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"

grep -rh "CREATE.*TRIGGER\|CREATE OR REPLACE TRIGGER" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
  sed 's/^[[:space:]]*//' | \
  sort -u >> "$OUTPUT_DIR/database_functions.md"

# Extract RLS Policies
echo "" >> "$OUTPUT_DIR/database_functions.md"
echo "## RLS Policies" >> "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"

grep -rh "CREATE POLICY" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
  sed 's/^[[:space:]]*//' | \
  sort -u >> "$OUTPUT_DIR/database_functions.md"

# Extract CREATE INDEX definitions
echo "" >> "$OUTPUT_DIR/database_functions.md"
echo "## Database Indexes" >> "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"

grep -rh "CREATE.*INDEX" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
  sed 's/^[[:space:]]*//' | \
  sort -u >> "$OUTPUT_DIR/database_functions.md"

# Extract ENUM types
echo "" >> "$OUTPUT_DIR/database_functions.md"
echo "## Custom Types (ENUMs)" >> "$OUTPUT_DIR/database_functions.md"
echo "" >> "$OUTPUT_DIR/database_functions.md"

grep -rh "CREATE TYPE.*AS ENUM" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | \
  sed 's/^[[:space:]]*//' | \
  sort -u >> "$OUTPUT_DIR/database_functions.md"

echo "Database objects extracted to: $OUTPUT_DIR/database_functions.md"

# Create full migration dump
echo ""
echo "Creating full migration file list..."
ls -la "$MIGRATIONS_DIR"/*.sql > "$OUTPUT_DIR/migration_files_list.txt"

echo "Done!"
