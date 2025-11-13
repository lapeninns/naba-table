#!/bin/bash
# Update schema.sql from remote Supabase database
# Per AGENTS.md: Remote-only operations required

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-mqtchcaavsucsdjskptc}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-tHFJ-D.+W+jD6U-}"
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres.mqtchcaavsucsdjskptc:${DB_PASSWORD}@aws-1-eu-north-1.pooler.supabase.com:6543/postgres}"

echo "📦 Exporting schema from remote Supabase database..."
echo "Project: $PROJECT_REF"

# Use pg_dump directly to export the public schema
pg_dump "$DB_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-security-labels \
  --no-subscriptions \
  > supabase/schema.sql

echo "✅ Schema exported to supabase/schema.sql"
echo "📊 File size: $(wc -c < supabase/schema.sql) bytes"
echo "📝 Lines: $(wc -l < supabase/schema.sql)"
