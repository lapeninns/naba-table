#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  revert_remote_only_migrations_linked.sh [--dry-run]

Description:
  Supabase CLI `db push` requires that every "applied" migration version recorded on the
  remote exists in the local `supabase/migrations/` directory. In real projects, schema
  changes may have been applied via the Supabase SQL Editor, leaving remote-only versions
  in `supabase_migrations.schema_migrations`.

  This script finds remote migration versions that are present on the remote but NOT in
  the local migrations directory, and marks those versions as "reverted" (metadata only)
  via `supabase migration repair`.

  This enables the "baseline + forward-only" model where the repo's migrations directory
  becomes the canonical history going forward.

Options:
  --dry-run   Print the versions that would be marked reverted, but do not modify remote history.

Notes:
  - This is metadata-only; it does NOT execute or rollback SQL.
  - If `SUPABASE_DB_PASSWORD` is set, it will be used for non-interactive remote access.

Example:
  bash scripts/supabase/revert_remote_only_migrations_linked.sh --dry-run
  bash scripts/supabase/revert_remote_only_migrations_linked.sh
EOF
}

dry_run="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run="true"
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

password_args=()
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  password_args=(-p "$SUPABASE_DB_PASSWORD")
fi

list_out="$(mktemp)"
trap 'rm -f "$list_out"' EXIT

supabase migration list --linked "${password_args[@]}" >"$list_out"

# Parse the table output:
# - We only want rows where Local is blank and Remote is non-blank.
# - Exclude the header row which contains "Remote".
remote_only="$(
  awk -F'|' '
    NF>=3 {
      l=$1; r=$2;
      gsub(/^[ \t]+|[ \t]+$/, "", l);
      gsub(/^[ \t]+|[ \t]+$/, "", r);
      if (l=="" && r!="" && r!="Remote") print r
    }
  ' "$list_out"
)"

if [[ -z "$remote_only" ]]; then
  echo "No remote-only applied migrations found. Nothing to do."
  exit 0
fi

count="$(printf '%s\n' "$remote_only" | wc -l | tr -d ' ')"
echo "Remote-only applied migration versions to revert (count=$count):"
printf '%s\n' "$remote_only"

if [[ "$dry_run" == "true" ]]; then
  echo "DRY RUN: not modifying remote migration history."
  exit 0
fi

printf '%s\n' "$remote_only" \
  | xargs -n 20 supabase migration repair --linked --status reverted --yes "${password_args[@]}"

echo "Done. Verify with:"
echo "  supabase migration list --linked"

