#!/usr/bin/env bash

set -euo pipefail

show_help() {
  cat <<'HELP'
Usage: scripts/clean-remote-db.sh [--skip-confirm] [--env <path>]

Wipes the remote Supabase public schema, reapplies migrations, and seeds data.

Required environment variables:
  Either:
    • SUPABASE_DB_URL                               (full Postgres URI)
  Or:
    • PROJECT_URL (e.g. mqtchcaavsucsdjskptc)
    • SUPABASE_DB_PASSWORD (password for the postgres user)
    • Optional: SUPABASE_DB_USER (defaults to 'postgres')

Options:
  --env <path>       Source the provided env file before running (e.g. .env.local)
  --skip-confirm     Do not prompt before destructive operations

Workflow:
  1. Drops and recreates the public schema (supabase/wipe-public-schema.sql)
  2. Replays full schema via supabase/create-database.sql
  3. Seeds data via supabase/seed.sql

Run a backup before executing:
  SUPABASE_DB_URL="postgres://..." scripts/backup-remote-db.sh
HELP
}

ENV_FILE=""
CONFIRM_PROMPT=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      show_help
      exit 0
      ;;
    --skip-confirm)
      CONFIRM_PROMPT=0
      shift
      ;;
    --env)
      if [[ -z "${2:-}" ]]; then
        echo "error: --env flag requires a path argument" >&2
        exit 1
      fi
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "error: unknown argument $1" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${ENV_FILE}" ]]; then
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "error: env file '${ENV_FILE}' not found" >&2
    exit 1
  fi
  set -o allexport
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +o allexport
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  if [[ -n "${PROJECT_URL:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    DB_USER="${SUPABASE_DB_USER:-postgres}"
    SUPABASE_DB_URL="postgres://${DB_USER}:${SUPABASE_DB_PASSWORD}@db.${PROJECT_URL}.supabase.co:5432/postgres"
  fi
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'ERR'
error: Unable to determine SUPABASE_DB_URL.

Provide one of the following:
  • Export SUPABASE_DB_URL with the full Postgres URI, or
  • Export PROJECT_URL and SUPABASE_DB_PASSWORD (optionally SUPABASE_DB_USER).
You can also supply them via an env file: scripts/clean-remote-db.sh --env .env.local
ERR
  exit 1
fi

if [[ "${CONFIRM_PROMPT}" -eq 1 ]]; then
  read -r -p "This will DESTROY and recreate the remote public schema. Have you taken a backup? (yes/no) " response
  if [[ "${response}" != "yes" ]]; then
    echo "Aborting. Confirmation not received."
    exit 1
  fi
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ Wiping public schema"
psql "${SUPABASE_DB_URL}" --echo-errors --file="${ROOT_DIR}/supabase/wipe-public-schema.sql"

echo "→ Replaying schema migrations"
psql "${SUPABASE_DB_URL}" --echo-errors --file="${ROOT_DIR}/supabase/create-database.sql"

echo "→ Seeding data"
psql "${SUPABASE_DB_URL}" --echo-errors --file="${ROOT_DIR}/supabase/seed.sql"

echo "✓ Remote database clean cycle complete"
