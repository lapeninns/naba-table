#!/usr/bin/env bash
set -euo pipefail

# PRODUCTION DEPLOYMENT - TENANT RLS FOUNDATION
# ⚠️ WARNING: This skips staging validation
# Use only if you accept the risks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          PRODUCTION DEPLOYMENT - TENANT RLS                ║${NC}"
echo -e "${RED}║          ⚠️  SKIPPING STAGING VALIDATION  ⚠️                ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}RISKS:${NC}"
echo "  • Untested RLS policies could expose cross-tenant data"
echo "  • Performance impact unknown"
echo "  • Rollback may be required if issues arise"
echo ""
echo -e "${YELLOW}SAFEGUARDS IN PLACE:${NC}"
echo "  ✓ Verification queries after each migration"
echo "  ✓ Rollback SQL documented"
echo "  ✓ Code changes minimal and reviewed"
echo ""
read -p "Type 'DEPLOY_TO_PRODUCTION' to continue: " confirmation

if [ "$confirmation" != "DEPLOY_TO_PRODUCTION" ]; then
  echo -e "${RED}Deployment cancelled.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}[1/4] Checking environment...${NC}"

if [ -z "${SUPABASE_PRODUCTION_DB_URL:-}" ]; then
  echo -e "${RED}ERROR: SUPABASE_PRODUCTION_DB_URL not set${NC}"
  echo "Set it with: export SUPABASE_PRODUCTION_DB_URL='postgresql://...'"
  exit 1
fi

echo -e "${GREEN}[2/4] Applying database migrations...${NC}"
"$SCRIPT_DIR/apply-tenant-rls-migrations.sh" production

if [ $? -ne 0 ]; then
  echo -e "${RED}Migration failed! Check output above.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}[3/4] Deploying application code...${NC}"
echo "  → Building production bundle..."
pnpm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed! Cannot deploy.${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}[4/4] Next steps:${NC}"
echo "  1. Deploy via your hosting platform (Vercel/Railway/etc)"
echo "  2. Monitor error rates for 1 hour: watch api.ops.bookings errors"
echo "  3. Test one booking update manually in production"
echo "  4. If issues arise, run rollback script immediately"
echo ""
echo -e "${GREEN}✓ Pre-deployment complete!${NC}"
echo ""
echo -e "${YELLOW}ROLLBACK PROCEDURE:${NC}"
echo "  ./scripts/rollback-tenant-rls.sh production"
echo ""
