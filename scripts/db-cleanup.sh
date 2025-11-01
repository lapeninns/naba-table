#!/usr/bin/env bash
# Safely orchestrate Supabase schema cleanup tasks.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/db-cleanup.sh [--apply]

Without --apply the script runs in dry-run mode and only prints the commands it would execute.

Steps performed:
  1. Verify required tooling (supabase CLI, pg_dump, git) and environment (SUPABASE_DB_URL).
  2. Create a timestamped Postgres schema backup via pg_dump\* (remote only per AGENTS.md).
  3. Archive redundant migrations into supabase/migrations/_archive_<timestamp>/ for review.
  4. Regenerate supabase/schema.sql via `supabase db pull` and Supabase types via `supabase gen types`.
  5. Optionally draft a fresh baseline migration using `supabase db diff`.

\* The backup step targets the remote database indicated by SUPABASE_DB_URL.
USAGE
}

log() {
  printf '➡️  %s\n' "$1"
}

warn() {
  printf '⚠️  %s\n' "$1" >&2
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'DRY-RUN ❯ %s\n' "$*"
  else
    eval "$@"
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    warn "Missing required command: $1"
    MISSING+=("$1")
  fi
}

ensure_prereqs() {
  MISSING=()
  require_command supabase
  require_command pg_dump
  require_command git

  if [[ ${#MISSING[@]} -gt 0 ]]; then
    warn "Install missing tooling before proceeding: ${MISSING[*]}"
    exit 1
  fi

  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    warn "SUPABASE_DB_URL is not set. Export the remote database URL (do NOT use local instances)."
    exit 1
  fi
}

mk_timestamp() {
  date -u +"%Y%m%d-%H%M%S"
}

backup_database() {
  local ts backup_dir dump_file
  ts=$(mk_timestamp)
  backup_dir="backups/schema-cleanup-${ts}"
  dump_file="${backup_dir}/pre-cleanup-schema.sql"

  run "mkdir -p ${backup_dir}"
  run "pg_dump --schema-only --no-owner --file='${dump_file}' \"${SUPABASE_DB_URL}\""
  log "Schema backup staged at ${dump_file}"
}

archive_redundant_migrations() {
  local ts archive_dir
  ts=$(mk_timestamp)
  archive_dir="supabase/migrations/_archive_${ts}"
  run "mkdir -p ${archive_dir}"

  local migrations=(
    "supabase/migrations/20251020235523_remote_schema.sql"
    "supabase/migrations/20251026160304_remote_schema.sql"
    "supabase/migrations/20251026160713_remote_schema.sql"
    "supabase/migrations/20251101093000_create_strategic_configs.sql"
  )

  for file in "${migrations[@]}"; do
    if [[ -f "$file" ]]; then
      run "git mv '$file' '${archive_dir}/'"
    else
      warn "Migration not found (already moved?): $file"
    fi
  done

  log "Archived redundant/comment-only migrations to ${archive_dir}"
}

regenerate_schema_and_types() {
  log "Refreshing schema snapshot (supabase/schema.sql)"
  run "supabase db pull"

  log "Regenerating TypeScript bindings (types/supabase.ts)"
  run "supabase gen types typescript --schema public > types/supabase.ts"
}

create_baseline_migration() {
  local ts baseline_file
  ts=$(mk_timestamp)
  baseline_file="supabase/migrations/${ts}_baseline_clean.sql"
  log "Drafting baseline migration at ${baseline_file}"
  run "supabase db diff --use-migra --linked --file '${baseline_file}'"
}

summarize_actions() {
  cat <<'SUMMARY'
Next steps after running this script:
  • Review the archived migrations and delete them once team consensus is reached.
  • Combine the assign_tables_atomic* and refresh_table_status* migration chains into consolidated migrations.
  • Add CREATE TABLE migrations for leads, waiting_list, and any other drifted tables before generating the baseline.
  • Validate seeds (supabase/seeds/seed.sql) against the regenerated schema.
  • Run CI (lint/tests) to ensure Supabase typings compile with new schema definitions.
SUMMARY
}

main() {
  DRY_RUN=1
  if [[ "${1:-}" == "--apply" ]]; then
    DRY_RUN=0
  elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  elif [[ $# -gt 0 ]]; then
    usage
    exit 1
  fi

  ensure_prereqs
  log "Starting database cleanup helper (dry-run=${DRY_RUN})"

  backup_database
  archive_redundant_migrations
  regenerate_schema_and_types
  create_baseline_migration
  summarize_actions
}

main "$@"
