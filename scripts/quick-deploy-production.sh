#!/usr/bin/env bash
set -euo pipefail

# Quick Production Deployment - Using .env.local
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  set -a
  source "$PROJECT_ROOT/.env.local"
  set +a
fi

# Use SUPABASE_DB_URL from .env.local as production
export SUPABASE_PRODUCTION_DB_URL="${SUPABASE_DB_URL}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     TENANT RLS DEPLOYMENT - PRODUCTION                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "${SUPABASE_PRODUCTION_DB_URL}" ]; then
  echo -e "${RED}ERROR: Could not load SUPABASE_DB_URL from .env.local${NC}"
  exit 1
fi

DB_HOST=$(echo "$SUPABASE_PRODUCTION_DB_URL" | grep -o '@[^:]*' | sed 's/@//')
echo -e "${GREEN}✓ Loaded production DB from .env.local${NC}"
echo -e "  Host: ${DB_HOST}"
echo ""

echo -e "${YELLOW}⚠️  WARNING: Deploying to PRODUCTION${NC}"
echo ""
echo "This will:"
echo "  1. Apply tenant RLS migrations to production database"
echo "  2. Enable row-level security policies"
echo "  3. Require app code deployment afterward"
echo ""
read -p "Type 'YES' to continue: " confirm

if [ "$confirm" != "YES" ]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo -e "${BLUE}[1/3] Applying migrations...${NC}"
"$SCRIPT_DIR/apply-tenant-rls-migrations.sh" production

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Migration failed!${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}[2/3] Building application...${NC}"
cd "$PROJECT_ROOT"
pnpm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Build failed!${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Pre-deployment complete!${NC}"
echo ""
echo -e "${BLUE}[3/3] Next steps:${NC}"
echo ""
echo "  1. Deploy to your hosting platform:"
echo "     • If Vercel: git push (auto-deploy)"
echo "     • If Railway: git push"
echo "     • If manual: upload build artifacts"
echo ""
echo "  2. After deployment, test immediately:"
echo "     • Update one booking via API"
echo "     • Verify it succeeds"
echo "     • Check logs for errors"
echo ""
echo "  3. Monitor for 1-2 hours:"
echo "     • Error rates"
echo "     • Response times"
echo "     • Database load"
echo ""
echo -e "${YELLOW}If issues occur:${NC}"
echo "  ./scripts/rollback-tenant-rls.sh production"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
