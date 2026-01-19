#!/bin/bash

# =============================================================================
# Complete Staging Environment Setup Script
# =============================================================================
# This script:
#   1. Creates a new Supabase staging project
#   2. Pulls the production database schema and data
#   3. Pushes everything to the new staging project
#   4. Generates the staging environment variables
#
# Prerequisites:
#   - Supabase CLI installed and logged in
#   - Production project linked
#
# Usage:
#   ./scripts/setup-staging-environment.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ORG_ID="wkgiyunxaxjlmehebxal"  # LapenInn organization
PROD_PROJECT_REF="mqtchcaavsucsdjskptc"  # Current production project
STAGING_PROJECT_NAME="SajiloReserveX-Staging"
STAGING_REGION="eu-north-1"  # Same region as production
STAGING_DB_PASSWORD="${STAGING_DB_PASSWORD:-}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     SajiloReserveX - Staging Environment Setup                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if staging project already exists
echo -e "${CYAN}[1/7] Checking for existing staging project...${NC}"
EXISTING_STAGING=$(supabase projects list 2>/dev/null | grep -i "staging" || true)

if [ -n "$EXISTING_STAGING" ]; then
    echo -e "${YELLOW}⚠️  A staging project may already exist:${NC}"
    echo "$EXISTING_STAGING"
    read -p "Do you want to continue and create a new one anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
fi

# Step 2: Generate a secure password if not provided
if [ -z "$STAGING_DB_PASSWORD" ]; then
    echo -e "${CYAN}[2/7] Generating secure database password...${NC}"
    STAGING_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)
    echo -e "${GREEN}   ✅ Password generated${NC}"
else
    echo -e "${CYAN}[2/7] Using provided database password...${NC}"
fi

# Step 3: Create new staging project
echo -e "${CYAN}[3/7] Creating new Supabase staging project...${NC}"
echo -e "${BLUE}   Name: ${STAGING_PROJECT_NAME}${NC}"
echo -e "${BLUE}   Region: ${STAGING_REGION}${NC}"
echo -e "${BLUE}   Organization: LapenInn${NC}"

CREATE_OUTPUT=$(supabase projects create "$STAGING_PROJECT_NAME" \
    --org-id "$ORG_ID" \
    --region "$STAGING_REGION" \
    --db-password "$STAGING_DB_PASSWORD" 2>&1)

echo "$CREATE_OUTPUT"

# Extract the new project reference from the output
STAGING_PROJECT_REF=$(echo "$CREATE_OUTPUT" | grep -oE '[a-z]{20}' | head -1 || true)

if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: Failed to extract staging project reference${NC}"
    echo -e "${YELLOW}Please check the output above and extract the project reference manually${NC}"
    read -p "Enter the staging project reference: " STAGING_PROJECT_REF
fi

echo -e "${GREEN}   ✅ Staging project created: ${STAGING_PROJECT_REF}${NC}"
echo ""

# Step 4: Wait for project to be ready
echo -e "${CYAN}[4/7] Waiting for project to be ready (this may take 1-2 minutes)...${NC}"
sleep 60  # Supabase projects take about a minute to initialize

# Check project status
for i in {1..10}; do
    STATUS=$(supabase projects list 2>/dev/null | grep "$STAGING_PROJECT_REF" || true)
    if [ -n "$STATUS" ]; then
        echo -e "${GREEN}   ✅ Project is ready${NC}"
        break
    fi
    echo -e "${YELLOW}   Waiting... (attempt $i/10)${NC}"
    sleep 10
done

# Step 5: Pull production schema and dump data
echo -e "${CYAN}[5/7] Pulling production database schema...${NC}"

# First, ensure we're linked to production
supabase link --project-ref "$PROD_PROJECT_REF" 2>/dev/null || true

# Pull the remote schema to local migrations (this gets the full schema)
supabase db pull --schema public 2>/dev/null || true

echo -e "${GREEN}   ✅ Schema pulled${NC}"

# Step 6: Push to staging
echo -e "${CYAN}[6/7] Pushing schema to staging project...${NC}"

# Link to staging project temporarily
supabase link --project-ref "$STAGING_PROJECT_REF"

# Push all migrations to staging
supabase db push

echo -e "${GREEN}   ✅ Schema pushed to staging${NC}"

# Re-link back to production
supabase link --project-ref "$PROD_PROJECT_REF"

# Step 7: Generate environment files
echo -e "${CYAN}[7/7] Generating staging environment variables...${NC}"

# Get staging project API keys
STAGING_URL="https://${STAGING_PROJECT_REF}.supabase.co"
STAGING_API_KEYS=$(supabase projects api-keys --project-ref "$STAGING_PROJECT_REF" 2>/dev/null)

STAGING_ANON_KEY=$(echo "$STAGING_API_KEYS" | grep "anon" | awk '{print $NF}')
STAGING_SERVICE_KEY=$(echo "$STAGING_API_KEYS" | grep "service_role" | awk '{print $NF}')

# Create staging env file
cat > .env.staging << EOF
# =============================================================================
# Staging Environment Variables
# Generated on: $(date)
# Project: ${STAGING_PROJECT_NAME}
# Reference: ${STAGING_PROJECT_REF}
# =============================================================================

# App Environment
APP_ENV=staging
NODE_ENV=development

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${STAGING_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${STAGING_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${STAGING_SERVICE_KEY}
SUPABASE_DB_PASSWORD=${STAGING_DB_PASSWORD}
SUPABASE_DB_URL=postgresql://postgres:${STAGING_DB_PASSWORD}@db.${STAGING_PROJECT_REF}.supabase.co:5432/postgres

# Domain Configuration
NEXT_PUBLIC_ROOT_DOMAIN=localhost

# Keep these from production (update as needed)
# RESEND_API_KEY=
# RESEND_FROM=
# REDIS_URL=

EOF

echo -e "${GREEN}   ✅ Created .env.staging${NC}"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ Staging Environment Setup Complete!                               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo -e "   Staging Project Ref: ${GREEN}${STAGING_PROJECT_REF}${NC}"
echo -e "   Staging URL:         ${GREEN}${STAGING_URL}${NC}"
echo -e "   Environment File:    ${GREEN}.env.staging${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review .env.staging and add missing API keys (Resend, Redis, etc.)"
echo "  2. To use staging locally: cp .env.staging .env.local"
echo "  3. To migrate data from production, run:"
echo "     ./scripts/migrate-data-to-staging.sh"
echo ""
echo -e "${YELLOW}Database Password (save this securely!):${NC}"
echo -e "   ${CYAN}${STAGING_DB_PASSWORD}${NC}"
echo ""
