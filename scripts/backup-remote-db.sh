#!/usr/bin/env bash

set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/backup-remote-db.sh [output-directory]

Creates a timestamped pg_dump backup of the remote Supabase database.

Required environment variables:
  SUPABASE_DB_URL   Postgres connection string for the remote project.

Optional arguments:
  output-directory  Directory where the backup file will be written (default: backups/remote).

Example:
  SUPABASE_DB_URL="postgres://..." scripts/backup-remote-db.sh
USAGE
  exit 0
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL environment variable is not set" >&2
  exit 1
fi

OUTPUT_DIR="${1:-backups/remote}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%SZ)"
FILENAME="supabase-backup-${TIMESTAMP}.dump"

mkdir -p "${OUTPUT_DIR}"

echo "→ Creating backup ${OUTPUT_DIR}/${FILENAME}"
pg_dump \
  --dbname="${SUPABASE_DB_URL}" \
  --format=custom \
  --no-owner \
  --file="${OUTPUT_DIR}/${FILENAME}"

echo "✓ Backup complete: ${OUTPUT_DIR}/${FILENAME}"
