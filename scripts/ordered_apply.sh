#!/usr/bin/env bash
set -euo pipefail

# Wrapper: apply order to staging, run sanity checks, then (with explicit owner's confirmation) apply to production.
# Example usage:
#   SUPABASE_DB_URL="<staging-url>" bash scripts/ordered_apply.sh

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Please set SUPABASE_DB_URL to the staging DB URL before running this script. Exiting." >&2
  exit 1
fi

echo "Starting ordered apply: (staging first)"
echo "Stage: staging -> staging db $SUPABASE_DB_URL"
echo "Running dry-run against staging..."
bash scripts/apply_supabase_order.sh --env staging --dry-run

read -rp "Confirm you have inspected the dry-run and want to proceed to apply to staging? (type YES to proceed): " PROCEED
if [[ "$PROCEED" != "YES" ]]; then
  echo "Aborted by user."; exit 2
fi

echo "Applying to staging now..."
bash scripts/apply_supabase_order.sh --env staging --confirm

echo "Run sanity checks locally (psql) or run test suite. Then, if everything looks good, you can run production apply." 
read -rp "Proceed to production? (type PROCEED_TO_PROD to continue): " PROD_CONFIRM
if [[ "$PROD_CONFIRM" != "PROCEED_TO_PROD" ]]; then
  echo "Not proceeding to production. Exiting."; exit 0
fi

if [[ -z "${PROD_SUPABASE_DB_URL:-}" ]]; then
  read -rp "Enter production SUPABASE_DB_URL and press Enter: " PROD_SUPABASE_DB_URL
fi

export SUPABASE_DB_URL="$PROD_SUPABASE_DB_URL"
echo "Applying to production: $SUPABASE_DB_URL"
bash scripts/apply_supabase_order.sh --env production --confirm

echo "Done.";
exit 0
