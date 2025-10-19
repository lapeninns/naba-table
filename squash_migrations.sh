#!/bin/bash
set -euo pipefail

echo "🚀 Starting migration squash process..."
echo ""

# Step 1: Backup
TS_BACKUP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="backups/${TS_BACKUP}"
echo "📦 Step 1: Creating backups in ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"
cp -r supabase/migrations "${BACKUP_DIR}/migrations_backup"
supabase db dump --file "${BACKUP_DIR}/database_backup.sql"
echo "✅ Backups created in ${BACKUP_DIR}"
echo ""

# Step 2: Extract schema
SCHEMA_DUMP="current_clean_schema.sql"
echo "📋 Step 2: Extracting clean schema to ${SCHEMA_DUMP}..."
supabase db dump --schema public --file "${SCHEMA_DUMP}"
echo "✅ Clean schema extracted"
echo ""

# Step 3: Remove old migrations
MIGRATIONS_DIR="supabase/migrations"
echo "🗑️  Step 3: Removing old migrations from ${MIGRATIONS_DIR}..."
rm -f "${MIGRATIONS_DIR}"/*.sql
echo "✅ Old migrations removed"
echo ""

# Step 4: Create consolidated migration
MIGRATION_TS="$(date +%Y%m%d%H%M%S)"
CONSOLIDATED_FILE="${MIGRATIONS_DIR}/${MIGRATION_TS}_consolidated_schema.sql"
echo "📝 Step 4: Creating consolidated migration ${CONSOLIDATED_FILE}..."
cp "${SCHEMA_DUMP}" "${CONSOLIDATED_FILE}"
echo "✅ Consolidated migration created"
echo ""

# Step 5: Test locally (note: ensure this aligns with team policy before running)
echo "🧪 Step 5: Testing migration via supabase db reset..."
supabase db reset
echo "✅ Local database reset successfully"
echo ""

# Step 6: Verify

 echo "🔍 Step 6: Verifying migration state..."
echo "Migration status:"
supabase migration list
echo ""
echo "Schema differences:"
supabase db diff || true

echo "✅ Verification step completed (check diff output above)"
echo ""

# Step 7: Cleanup

echo "🧹 Step 7: Cleaning up temporary schema dump..."
rm -f "${SCHEMA_DUMP}"
echo "✅ Temporary files removed"
echo ""

echo "🎉 Migration squash complete!"
echo ""
echo "📁 Backup location: ${BACKUP_DIR}"
echo "📄 New migration: ${CONSOLIDATED_FILE}"
echo ""

echo "Next steps:"
echo "1. Review the consolidated migration file"
echo "2. Test your application thoroughly"
echo "3. Commit changes: git add supabase/migrations/ && git commit -m 'Squash migrations'"
echo ""
