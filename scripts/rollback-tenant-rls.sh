#!/usr/bin/env bash
set -euo pipefail

# EMERGENCY ROLLBACK - TENANT RLS
# Removes RLS policies and reverts to non-scoped clients

TARGET_ENV="${1:-production}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║          EMERGENCY ROLLBACK - TENANT RLS                   ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

case "$TARGET_ENV" in
    production|prod)
        DB_URL="${SUPABASE_PRODUCTION_DB_URL:-}"
        if [ -z "$DB_URL" ]; then
            echo -e "${RED}ERROR: SUPABASE_PRODUCTION_DB_URL not set${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Target: PRODUCTION${NC}"
        read -p "Type 'ROLLBACK_PRODUCTION' to continue: " confirm
        if [ "$confirm" != "ROLLBACK_PRODUCTION" ]; then
            echo "Cancelled."
            exit 1
        fi
        ;;
    staging)
        DB_URL="${SUPABASE_STAGING_DB_URL:-}"
        if [ -z "$DB_URL" ]; then
            echo -e "${RED}ERROR: SUPABASE_STAGING_DB_URL not set${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Target: STAGING${NC}"
        ;;
    *)
        echo -e "${RED}Invalid environment: $TARGET_ENV${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}[1/3] Removing RLS policies from bookings table...${NC}"
psql "$DB_URL" <<SQL
-- Drop RLS policies
DROP POLICY IF EXISTS tenant_isolation_select ON public.bookings;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.bookings;
DROP POLICY IF EXISTS tenant_isolation_update ON public.bookings;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.bookings;

-- Drop policies from related tables
DROP POLICY IF EXISTS tenant_isolation_select ON public.booking_table_assignments;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.booking_table_assignments;
DROP POLICY IF EXISTS tenant_isolation_update ON public.booking_table_assignments;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.booking_table_assignments;

DROP POLICY IF EXISTS tenant_isolation_select ON public.table_hold_windows;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.table_hold_windows;
DROP POLICY IF EXISTS tenant_isolation_update ON public.table_hold_windows;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.table_hold_windows;

DROP POLICY IF EXISTS tenant_isolation_select ON public.capacity_outbox;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.capacity_outbox;

SELECT 'RLS policies removed' AS status;
SQL

echo ""
echo -e "${GREEN}[2/3] Verifying RLS disabled...${NC}"
result=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('bookings', 'booking_table_assignments', 'table_hold_windows', 'capacity_outbox');")

if [ "$result" -gt 0 ]; then
    echo -e "${RED}WARNING: Some policies still exist!${NC}"
    psql "$DB_URL" -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('bookings', 'booking_table_assignments', 'table_hold_windows', 'capacity_outbox');"
else
    echo -e "${GREEN}✓ All RLS policies removed${NC}"
fi

echo ""
echo -e "${GREEN}[3/3] Code rollback instructions:${NC}"
echo ""
echo "  1. Revert the tenant-scoped client changes:"
echo "     git revert <commit-sha>"
echo ""
echo "  2. Or manually revert /src/app/api/ops/bookings/[id]/route.ts:"
echo "     - Change getTenantServiceSupabaseClient() back to getServiceSupabaseClient()"
echo "     - Remove restaurant_id parameter"
echo ""
echo "  3. Rebuild and redeploy:"
echo "     pnpm run build"
echo "     # Deploy via your pipeline"
echo ""
echo -e "${GREEN}✓ Database rollback complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  • Verify booking operations work normally"
echo "  • Check error rates returned to baseline"
echo "  • Investigate root cause before re-attempting"
echo ""
