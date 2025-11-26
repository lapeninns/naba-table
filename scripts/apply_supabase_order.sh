#!/usr/bin/env bash
set -euo pipefail

# Usage:
#  SUPABASE_DB_URL="<staging-db-url>" ./scripts/apply_supabase_order.sh --env staging --confirm
# Dry-run:
#  SUPABASE_DB_URL="<staging-db-url>" ./scripts/apply_supabase_order.sh --env staging --dry-run

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION_FILE="$REPO_ROOT/supabase/migrations/20251126000000_enforce_bar_drinks_only.sql"
SEED_FILE="$REPO_ROOT/supabase/seeds/white-horse-service-periods.sql"
SANITY_FILE="$REPO_ROOT/tasks/reset-floorplan-20251125-2354/artifacts/sanity-queries.sql"

function usage() {
  cat <<EOF
Usage: $(basename "$0") --env <staging|production> [--confirm] [--dry-run]

This will:
  1) Run the migration: $MIGRATION_FILE
  2) Run the seed (reseed): $SEED_FILE
  3) Run sanity checks: $SANITY_FILE

Requires SUPABASE_DB_URL to be set in the environment (target remote DB URL).
EOF
}

ENV="staging"
DRY_RUN=0
CONFIRM=0

while [[ ${#} -gt 0 ]]; do
  case "$1" in
    --env) shift; ENV="$1"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --confirm) CONFIRM=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL must be set to the target Supabase DB url (staging first)." >&2
  exit 1
fi

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE" >&2
  exit 1
fi
if [[ ! -f "$SEED_FILE" ]]; then
  echo "Seed file not found: $SEED_FILE" >&2
  exit 1
fi
if [[ ! -f "$SANITY_FILE" ]]; then
  echo "Sanity checks file not found: $SANITY_FILE" >&2
  exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="$REPO_ROOT/backups/supabase-apply-order-$TIMESTAMP"
LOGFILE="$BACKUP_DIR/apply.log"

echo "Supabase apply order: env=$ENV"
echo "Target: $SUPABASE_DB_URL"
echo "Migration: $MIGRATION_FILE"
echo "Seed: $SEED_FILE"
echo "Sanity: $SANITY_FILE"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "\nDRY RUN: The following steps would be executed:";
  echo "  - mkdir -p $BACKUP_DIR";
  echo "  - pg_dump --format=p --no-owner --no-acl --file $BACKUP_DIR/pre-apply.sql '$SUPABASE_DB_URL'";
  echo "  - psql '$SUPABASE_DB_URL' -f $MIGRATION_FILE";
  echo "  - psql '$SUPABASE_DB_URL' -f $SEED_FILE";
  echo "  - psql '$SUPABASE_DB_URL' -f $SANITY_FILE";
  echo "Dry-run complete. No changes applied.";
  exit 0
fi

if [[ $CONFIRM -ne 1 ]]; then
  echo "This will apply changes to the remote database. Pass --confirm to proceed." >&2
  exit 2
fi

echo "Step 0: create backups"
mkdir -p "$BACKUP_DIR"
# Redirect stdout/stderr to a log file under backup dir so the operator can attach it to the task artifact
exec 2>&1 | tee -a "$LOGFILE"
echo "Exporting pre-apply SQL to $BACKUP_DIR/pre-apply.sql"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump --format=p --no-owner --no-acl --file "$BACKUP_DIR/pre-apply.sql" "$SUPABASE_DB_URL"
else
  echo "pg_dump not found. Skipping SQL backup step. You should ensure your remote has backups (PITR/PgDump)." >&2
fi

echo "Step 1: Apply migration"
echo "Step 1a: Pre-migration checks for bar drinks-only violations"
VIOLATION_COUNT=$(psql "$SUPABASE_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.booking_table_assignments bta JOIN public.bookings b ON b.id = bta.booking_id JOIN public.table_inventory t ON t.id = bta.table_id LEFT JOIN public.zones z ON z.id = t.zone_id WHERE (t.category = 'bar' OR z.name ILIKE 'bar%') AND b.booking_type <> 'drinks';")
echo "Violating assignments found: ${VIOLATION_COUNT}"
if [[ -n "$VIOLATION_COUNT" && "$VIOLATION_COUNT" != "0" ]]; then
  echo "Aborting: Pre-migration check found booking_table_assignments that would violate the new trigger." >&2
  echo "Run the pre-check SQL for details: psql '$SUPABASE_DB_URL' -f $REPO_ROOT/tasks/reset-floorplan-20251125-2354/artifacts/pre-migration-check.sql" >&2
  exit 3
fi
psql "$SUPABASE_DB_URL" -f "$MIGRATION_FILE"

echo "Step 2: Reseed zones/tables"
psql "$SUPABASE_DB_URL" -f "$SEED_FILE"

echo "Step 3: Run sanity checks"
psql "$SUPABASE_DB_URL" -f "$SANITY_FILE"

echo "All steps completed. Backups (if created) are located in: $BACKUP_DIR"
echo "If something looks wrong consider restoring with: psql '$SUPABASE_DB_URL' -f $BACKUP_DIR/pre-apply.sql"

echo "Success.";
exit 0
