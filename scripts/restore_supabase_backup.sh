#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/restore_supabase_backup.sh <path-to-sql-dump> --db "$SUPABASE_DB_URL"

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <path-to-sql-dump>" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL must be set in the environment to restore to target DB" >&2
  exit 2
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 3
fi

echo "Restoring $BACKUP_FILE to $SUPABASE_DB_URL"
psql "$SUPABASE_DB_URL" -f "$BACKUP_FILE"
echo "Restore complete."
