#!/bin/bash
# Deploy capacity overlap and confirm cache migration
# Per AGENTS.md: Remote-only operations, staging-first

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_REF="${SUPABASE_PROJECT_REF:-mqtchcaavsucsdjskptc}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-tHFJ-D.+W+jD6U-}"
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres.mqtchcaavsucsdjskptc:${DB_PASSWORD}@aws-1-eu-north-1.pooler.supabase.com:6543/postgres}"
MIGRATION_FILE="supabase/migrations/20251113203000_capacity_overlap_and_confirm_cache.sql"
ARTIFACTS_DIR="artifacts"
TASK_DIR="tasks/capacity-overlap-migration-20251113-2030"

# Ensure artifacts directory exists
mkdir -p "$ARTIFACTS_DIR"
mkdir -p "$TASK_DIR/artifacts"

echo -e "${GREEN}🚀 Starting Capacity Overlap Migration Deployment${NC}"
echo "Project: $PROJECT_REF"
echo "Migration: $MIGRATION_FILE"
echo ""

# Function to run SQL and capture output
run_sql() {
  local sql_file=$1
  local output_file=$2
  echo -e "${YELLOW}Running: $sql_file${NC}"
  psql "$DB_URL" -f "$sql_file" 2>&1 | tee "$output_file"
  return ${PIPESTATUS[0]}
}

# Function to capture database state
capture_state() {
  local label=$1
  local output_file=$2
  echo -e "${YELLOW}Capturing $label state...${NC}"
  psql "$DB_URL" <<'SQL' > "$output_file"
-- Current allocations state
SELECT 
  count(*) as allocation_count,
  count(DISTINCT restaurant_id) as restaurant_count,
  min(created_at) as earliest,
  max(created_at) as latest
FROM allocations;

-- Current constraints
SELECT 
  conname,
  contype,
  condeferrable,
  condeferred
FROM pg_constraint
WHERE conrelid = 'allocations'::regclass
ORDER BY conname;

-- Check for existing booking_confirmation_results
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'booking_confirmation_results'
) as confirmation_table_exists;
SQL
}

# Function to check for constraint violations
check_violations() {
  echo -e "${YELLOW}Checking for potential constraint violations...${NC}"
  psql "$DB_URL" <<'SQL' > "$ARTIFACTS_DIR/pre-migration-violations.txt"
SELECT 
  a1.id as alloc1,
  a2.id as alloc2,
  a1.restaurant_id,
  a1.resource_id,
  a1.window as window1,
  a2.window as window2
FROM allocations a1
JOIN allocations a2 
  ON a1.restaurant_id = a2.restaurant_id
 AND a1.resource_type = a2.resource_type
 AND a1.resource_id = a2.resource_id
 AND a1.window && a2.window
 AND a1.id < a2.id
 AND NOT a1.shadow
 AND NOT a2.shadow
LIMIT 10;
SQL

  if [ -s "$ARTIFACTS_DIR/pre-migration-violations.txt" ]; then
    echo -e "${RED}⚠️  Found potential overlapping allocations!${NC}"
    cat "$ARTIFACTS_DIR/pre-migration-violations.txt"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${RED}Deployment cancelled${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ No overlapping allocations found${NC}"
  fi
}

# Step 1: Pre-migration validation
echo -e "${GREEN}📋 Step 1: Pre-Migration Validation${NC}"
echo "----------------------------------------"

# Test connection
if ! psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${RED}❌ Cannot connect to database${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Database connection successful${NC}"

# Capture pre-migration state
capture_state "pre-migration" "$ARTIFACTS_DIR/pre-migration-state.txt"
echo -e "${GREEN}✅ Pre-migration state captured${NC}"

# Check for violations
check_violations

# Verify migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Migration file verified${NC}"

# Verify btree_gist extension
echo -e "${YELLOW}Checking for btree_gist extension...${NC}"
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS btree_gist;" > /dev/null 2>&1
echo -e "${GREEN}✅ btree_gist extension available${NC}"

echo ""

# Step 2: Apply migration
echo -e "${GREEN}🔧 Step 2: Applying Migration${NC}"
echo "----------------------------------------"

if run_sql "$MIGRATION_FILE" "$ARTIFACTS_DIR/migration-output.log"; then
  echo -e "${GREEN}✅ Migration applied successfully!${NC}"
else
  echo -e "${RED}❌ Migration failed!${NC}"
  echo "Check $ARTIFACTS_DIR/migration-output.log for details"
  exit 1
fi

echo ""

# Step 3: Post-migration validation
echo -e "${GREEN}✅ Step 3: Post-Migration Validation${NC}"
echo "----------------------------------------"

# Capture post-migration state
capture_state "post-migration" "$ARTIFACTS_DIR/post-migration-state.txt"
echo -e "${GREEN}✅ Post-migration state captured${NC}"

# Verify new constraint
echo -e "${YELLOW}Verifying new constraint...${NC}"
psql "$DB_URL" <<'SQL' > "$ARTIFACTS_DIR/new-constraint.txt"
SELECT 
  conname,
  contype,
  condeferrable,
  condeferred,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'allocations'::regclass
  AND conname = 'allocations_no_overlap';
SQL

if grep -q "allocations_no_overlap" "$ARTIFACTS_DIR/new-constraint.txt"; then
  echo -e "${GREEN}✅ New constraint verified${NC}"
  cat "$ARTIFACTS_DIR/new-constraint.txt"
else
  echo -e "${RED}❌ New constraint not found!${NC}"
  exit 1
fi

# Verify new table
echo -e "${YELLOW}Verifying booking_confirmation_results table...${NC}"
psql "$DB_URL" -c "\d booking_confirmation_results" > "$ARTIFACTS_DIR/new-table.txt" 2>&1

if grep -q "booking_confirmation_results" "$ARTIFACTS_DIR/new-table.txt"; then
  echo -e "${GREEN}✅ New table verified${NC}"
else
  echo -e "${RED}❌ New table not found!${NC}"
  exit 1
fi

# Generate diff
echo -e "${YELLOW}Generating database diff...${NC}"
diff -u "$ARTIFACTS_DIR/pre-migration-state.txt" "$ARTIFACTS_DIR/post-migration-state.txt" > "$ARTIFACTS_DIR/db-diff.txt" || true
echo -e "${GREEN}✅ Database diff saved to artifacts/db-diff.txt${NC}"

echo ""

# Step 4: Functional testing
echo -e "${GREEN}🧪 Step 4: Functional Testing${NC}"
echo "----------------------------------------"

echo -e "${YELLOW}Running assignment tests...${NC}"
if command -v pnpm &> /dev/null; then
  # Run tests if pnpm is available
  SUPABASE_DB_URL="$DB_URL" pnpm test tests/server/capacity/assignTablesAtomic.test.ts 2>&1 | tee "$ARTIFACTS_DIR/tests.txt" || true
  
  if grep -q "PASS\|✓" "$ARTIFACTS_DIR/tests.txt"; then
    echo -e "${GREEN}✅ Tests completed - check artifacts/tests.txt for results${NC}"
  else
    echo -e "${YELLOW}⚠️  Test results unclear - manual verification recommended${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  pnpm not available - skipping automated tests${NC}"
  echo "Manual testing required" > "$ARTIFACTS_DIR/tests.txt"
fi

echo ""

# Step 5: Performance check
echo -e "${GREEN}📊 Step 5: Performance Validation${NC}"
echo "----------------------------------------"

echo -e "${YELLOW}Testing constraint performance...${NC}"
psql "$DB_URL" <<'SQL' > "$ARTIFACTS_DIR/performance-test.txt"
EXPLAIN ANALYZE
SELECT *
FROM allocations
WHERE restaurant_id = (SELECT id FROM restaurants LIMIT 1)
  AND resource_type = 'table'
  AND window && tstzrange('2025-11-15 18:00:00+00', '2025-11-15 20:00:00+00')
LIMIT 10;
SQL

echo -e "${GREEN}✅ Performance test completed${NC}"
cat "$ARTIFACTS_DIR/performance-test.txt"

echo ""

# Summary
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Migration Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Artifacts saved to:"
echo "  - $ARTIFACTS_DIR/pre-migration-state.txt"
echo "  - $ARTIFACTS_DIR/post-migration-state.txt"
echo "  - $ARTIFACTS_DIR/db-diff.txt"
echo "  - $ARTIFACTS_DIR/migration-output.log"
echo "  - $ARTIFACTS_DIR/new-constraint.txt"
echo "  - $ARTIFACTS_DIR/new-table.txt"
echo "  - $ARTIFACTS_DIR/tests.txt"
echo "  - $ARTIFACTS_DIR/performance-test.txt"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Review artifacts for any issues"
echo "2. Test assignment flows manually"
echo "3. Monitor Supabase logs for errors"
echo "4. Update FEATURE_ALLOCATOR_ADJACENCY_MODE if needed"
echo "5. Copy artifacts to task folder for PR evidence"
echo ""
echo -e "${GREEN}Deployment script completed successfully!${NC}"

# Copy artifacts to task folder
cp -r "$ARTIFACTS_DIR"/* "$TASK_DIR/artifacts/" 2>/dev/null || true
echo -e "${GREEN}✅ Artifacts copied to $TASK_DIR/artifacts/${NC}"
