#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  repair_migration_history_linked.sh [--through <version>] [--dry-run]

Description:
  Repairs (baselines) Supabase remote migration history for the linked project by marking
  selected migration versions as "applied" in supabase_migrations.schema_migrations.

  This is metadata-only and prevents `supabase db push` from replaying historical migrations
  against a database that already contains the schema (e.g., a production clone).

Options:
  --through <version>   Only mark versions <= <version> as applied.
                        Use this to avoid accidentally marking future migrations as applied.
  --dry-run             Print the versions that would be repaired, but do not modify remote history.

Example:
  bash scripts/supabase/repair_migration_history_linked.sh --through 20260207144113
EOF
}

through=""
dry_run="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --through)
      through="${2:-}"
      shift 2
      ;;
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

if [[ -n "$through" ]] && [[ ! "$through" =~ ^[0-9]{8,14}$ ]]; then
  echo "ERROR: --through must be an 8-14 digit version prefix (e.g., 20260207144113)." >&2
  exit 1
fi

migrations_dir="supabase/migrations"

if [[ ! -d "$migrations_dir" ]]; then
  echo "ERROR: missing $migrations_dir" >&2
  exit 1
fi

# Enumerate migration versions deterministically.
versions="$(
  ls -1 "$migrations_dir" \
    | sed -nE 's/^([0-9]{8,14})_.+\.sql$/\1/p' \
    | sort -u
)"

if [[ -z "$versions" ]]; then
  echo "ERROR: no migration versions found under $migrations_dir" >&2
  exit 1
fi

if [[ -n "$through" ]]; then
  versions="$(printf '%s\n' "$versions" | awk -v t="$through" '$0 <= t')"
fi

if [[ -z "$versions" ]]; then
  echo "ERROR: no migration versions selected (check --through value)." >&2
  exit 1
fi

echo "Selected migration versions (count=$(printf '%s\n' "$versions" | wc -l | tr -d ' ')):"
printf '%s\n' "$versions"

if [[ "$dry_run" == "true" ]]; then
  echo "DRY RUN: not repairing remote migration history."
  exit 0
fi

# Supabase CLI remote commands typically require a DB password. In automation (and for
# non-interactive agent runs), we prefer passing it via env to avoid prompts.
password_args=()
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  password_args=(-p "$SUPABASE_DB_PASSWORD")
fi

# Repair in small batches to avoid command length limits.
printf '%s\n' "$versions" \
  | xargs -n 20 supabase migration repair --linked --status applied --yes "${password_args[@]}"

echo "Done. Verify with: supabase migration list --linked"
