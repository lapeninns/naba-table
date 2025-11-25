#!/usr/bin/env bash
set -euo pipefail

# Replace 'dummy-not-used' api_key values with an empty string for VibeProxy use
# This is useful when Factory would otherwise add an Authorization header that
# gets forwarded upstream and causes a 401.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/.factory/config.json"
DEST="$REPO_ROOT/.factory/config.vibe.json"

if [[ ! -f "$SRC" ]]; then
  echo "Source file not found: $SRC" >&2
  exit 1
fi

cp "$SRC" "$DEST"

echo "Patching api_key values in $DEST (dummy-not-used -> \"\")"
perl -0777 -pe "s/\"api_key\"\s*:\s*\"dummy-not-used\"/\"api_key\" : \"\"/g" -i "$DEST"

echo "Patched file created at $DEST"
echo "You can copy this to ~/.factory/config.json or use scripts/apply_factory_config.sh --src $DEST"
