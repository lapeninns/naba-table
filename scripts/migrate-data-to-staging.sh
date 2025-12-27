#!/bin/bash

# =============================================================================
# Migrate Data from Production to Staging
# =============================================================================
# This script uses Supabase CLI to dump data from production and restore to staging
#
# Prerequisites:
#   - Both production and staging projects exist
#   - Supabase CLI installed and logged in
#
# Usage:
#   export STAGING_PROJECT_REF=your_staging_ref
#   ./scripts/migrate-data-to-staging.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROD_PROJECT_REF="mqtchcaavsucsdjskptc"
STAGING_PROJECT_REF="${STAGING_PROJECT_REF:-}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Data Migration: Production → Staging                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check staging project ref
if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${YELLOW}Please provide your staging project reference.${NC}"
    echo -e "${YELLOW}You can find this in the Supabase dashboard URL or by running: supabase projects list${NC}"
    read -p "Enter staging project reference: " STAGING_PROJECT_REF
fi

if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: Staging project reference is required${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${CYAN}Configuration:${NC}"
echo -e "   Production: ${PROD_PROJECT_REF}"
echo -e "   Staging:    ${STAGING_PROJECT_REF}"
echo ""

echo -e "${YELLOW}⚠️  WARNING: This will REPLACE data in the staging database!${NC}"
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

# Step 1: Link to production and dump data
echo ""
echo -e "${CYAN}[1/4] Linking to production project...${NC}"
supabase link --project-ref "$PROD_PROJECT_REF"

echo -e "${CYAN}[2/4] Dumping production data...${NC}"
DUMP_FILE="${BACKUP_DIR}/prod_data_${TIMESTAMP}.sql"

# Use supabase db dump for data only
supabase db dump --data-only -f "$DUMP_FILE"

echo -e "${GREEN}   ✅ Data dumped to: ${DUMP_FILE}${NC}"
echo -e "${BLUE}   Size: $(du -h "$DUMP_FILE" | cut -f1)${NC}"

# Step 3: Link to staging and restore
echo ""
echo -e "${CYAN}[3/4] Linking to staging project...${NC}"
supabase link --project-ref "$STAGING_PROJECT_REF"

echo -e "${CYAN}[4/4] Restoring data to staging...${NC}"

# Get staging DB connection string
STAGING_DB_URL=$(supabase status 2>/dev/null | grep "DB URL" | awk '{print $NF}' || true)

if [ -z "$STAGING_DB_URL" ]; then
    echo -e "${YELLOW}Could not auto-detect staging DB URL${NC}"
    echo -e "${YELLOW}Please provide your staging database password:${NC}"
    read -s -p "Staging DB Password: " STAGING_DB_PASSWORD
    echo ""
    STAGING_DB_URL="postgresql://postgres:${STAGING_DB_PASSWORD}@db.${STAGING_PROJECT_REF}.supabase.co:5432/postgres"
fi

# Restore data using psql
psql "$STAGING_DB_URL" -f "$DUMP_FILE"

echo -e "${GREEN}   ✅ Data restored to staging!${NC}"

# Re-link to production
echo ""
echo -e "${CYAN}Re-linking to production project...${NC}"
supabase link --project-ref "$PROD_PROJECT_REF"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ Data Migration Complete!                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo -e "   Backup file: ${DUMP_FILE}"
echo -e "   Data migrated from: ${PROD_PROJECT_REF}"
echo -e "   Data migrated to:   ${STAGING_PROJECT_REF}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify data in staging Supabase dashboard"
echo "  2. Test your application with staging environment"
echo ""
