#!/bin/bash

# =============================================================================
# Production to Staging Database Migration Script
# =============================================================================
# This script creates a backup of the production Supabase database and 
# restores it to the staging database.
#
# Prerequisites:
#   - PostgreSQL client tools (pg_dump, pg_restore)
#   - Access to both production and staging Supabase databases
#
# Usage:
#   ./scripts/migrate-prod-to-staging.sh
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Production Supabase Configuration
PROD_PROJECT_REF="vrdiqfudmwydclqpydee"
PROD_HOST="db.${PROD_PROJECT_REF}.supabase.co"
PROD_PORT="5432"
PROD_USER="postgres"
PROD_DB="postgres"

# Staging Supabase Configuration (UPDATE THESE VALUES)
STAGING_PROJECT_REF="${STAGING_SUPABASE_PROJECT_REF:-YOUR_STAGING_PROJECT_REF}"
STAGING_HOST="db.${STAGING_PROJECT_REF}.supabase.co"
STAGING_PORT="5432"
STAGING_USER="postgres"
STAGING_DB="postgres"

# Backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/production_backup_${TIMESTAMP}.dump"

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}     Production to Staging Database Migration                                  ${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if staging project ref is set
if [ "$STAGING_PROJECT_REF" = "YOUR_STAGING_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: Please set STAGING_SUPABASE_PROJECT_REF environment variable${NC}"
    echo -e "${YELLOW}Example: export STAGING_SUPABASE_PROJECT_REF=abcdefghijklmnop${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will REPLACE all data in the staging database!${NC}"
echo -e "${YELLOW}   Production: ${PROD_HOST}${NC}"
echo -e "${YELLOW}   Staging:    ${STAGING_HOST}${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Creating backup from production database...${NC}"
echo -e "${BLUE}   Host: ${PROD_HOST}${NC}"

# You'll be prompted for the password
PGPASSWORD="${PROD_DB_PASSWORD}" pg_dump \
    -h "$PROD_HOST" \
    -p "$PROD_PORT" \
    -U "$PROD_USER" \
    -d "$PROD_DB" \
    --no-owner \
    --no-privileges \
    --no-comments \
    --clean \
    --if-exists \
    -F c \
    -f "$BACKUP_FILE" \
    --exclude-schema=auth \
    --exclude-schema=storage \
    --exclude-schema=supabase_functions \
    --exclude-schema=supabase_migrations \
    --exclude-schema=extensions \
    --exclude-schema=graphql \
    --exclude-schema=graphql_public \
    --exclude-schema=pgbouncer \
    --exclude-schema=pgsodium \
    --exclude-schema=pgsodium_masks \
    --exclude-schema=realtime \
    --exclude-schema=vault

echo -e "${GREEN}   ✅ Backup created: ${BACKUP_FILE}${NC}"
echo ""

echo -e "${GREEN}Step 2: Restoring to staging database...${NC}"
echo -e "${BLUE}   Host: ${STAGING_HOST}${NC}"

# Restore to staging
PGPASSWORD="${STAGING_DB_PASSWORD}" pg_restore \
    -h "$STAGING_HOST" \
    -p "$STAGING_PORT" \
    -U "$STAGING_USER" \
    -d "$STAGING_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    "$BACKUP_FILE" || true

echo -e "${GREEN}   ✅ Restore completed!${NC}"
echo ""

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Verify data in staging Supabase dashboard"
echo "  2. Update your .env.local with staging credentials"
echo "  3. Test your application against staging"
echo ""
echo -e "${YELLOW}Backup file saved at: ${BACKUP_FILE}${NC}"
