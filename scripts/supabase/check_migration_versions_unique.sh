#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

migrations_dir="supabase/migrations"

if [[ ! -d "$migrations_dir" ]]; then
  echo "ERROR: missing $migrations_dir" >&2
  exit 1
fi

# Supabase identifies migrations primarily by the filename version prefix before the first underscore.
# If two files share the same prefix, the CLI cannot represent the history deterministically.
versions="$(
  ls -1 "$migrations_dir" \
    | sed -nE 's/^([0-9]{8,14})_.+\.sql$/\1/p' \
    | sort
)"

if [[ -z "$versions" ]]; then
  echo "ERROR: no migration files found in $migrations_dir" >&2
  exit 1
fi

dups="$(printf '%s\n' "$versions" | uniq -d || true)"

if [[ -n "$dups" ]]; then
  echo "ERROR: duplicate migration versions found in $migrations_dir:" >&2
  printf '%s\n' "$dups" >&2
  echo "" >&2
  echo "Fix: consolidate to a single canonical file per version prefix. Move legacy duplicates out of supabase/migrations (e.g. task artifacts)." >&2
  exit 1
fi

echo "OK: migration versions are unique."
