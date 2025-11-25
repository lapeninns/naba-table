#!/usr/bin/env bash
set -euo pipefail

# Apply a config file to ~/.factory/config.json, replacing api_key values with the provided token
# This can be used to test VibeProxy by explicitly supplying a real token (not recommended long-term)
# Usage: scripts/apply_factory_config_with_token.sh --token <TOKEN> [--src <path>]

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_FILE="$REPO_ROOT/.factory/config.vibe.json"
DEST_DIR="$HOME/.factory"
DEST_FILE="$DEST_DIR/config.json"

TOKEN=""
while [[ ${#} -gt 0 ]]; do
  case "$1" in
    --token) shift; TOKEN="$1"; shift ;;
    --src) shift; SRC_FILE="$1"; shift ;;
    -h|--help) echo "Usage: $0 --token <TOKEN> [--src <path>]"; exit 0 ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TOKEN" ]]; then
  echo "No token provided. Use --token or set TOKEN env var." >&2
  exit 1
fi

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source file not found: $SRC_FILE" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
if [[ -f "$DEST_FILE" ]]; then
  BACKUP="$DEST_FILE.backup.$(date -u +%Y%m%dT%H%M%SZ)"
  echo "Backing up existing $DEST_FILE -> $BACKUP"
  cp -p "$DEST_FILE" "$BACKUP"
fi

TMP_FILE="$DEST_DIR/config.tmp.json"
cp "$SRC_FILE" "$TMP_FILE"

# Use Perl to replace api_key occurrences value with the real token. This keeps JSON formatting intact.
perl -0777 -pe "s/\"api_key\"\s*:\s*\".*?\"/\"api_key\" : \"$TOKEN\"/g" -i "$TMP_FILE"

mv "$TMP_FILE" "$DEST_FILE"
chmod 600 "$DEST_FILE"

echo "Applied config with token to $DEST_FILE (permissions 600)."
echo "If this file contains a real API key, be sure to remove it after testing or use environment variable alternatives."
