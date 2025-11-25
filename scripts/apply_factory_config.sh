#!/usr/bin/env bash
# Apply the .factory/config.json from the repository to the user's home folder (~/.factory/config.json).
# It will backup any existing file, copy the file, and validate that the JSON is correct.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_FILE="$REPO_ROOT/.factory/config.json"
DEST_DIR="$HOME/.factory"
DEST_FILE="$DEST_DIR/config.json"

usage() {
  cat <<-EOF
Usage: $(basename "$0") [--dry-run] [--src <path>]

Options:
  --dry-run       Show what would be done but don't copy anything
  --src <path>    Use <path> instead of the repo .factory/config.json
  -h|--help       Show this message
EOF
}

DRY_RUN=0
while [[ ${#} -gt 0 ]]; do
  case "$1" in
    --) shift ;;
    --silent) # some package runners pass --silent through; ignore and continue
      shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --src) shift; SRC_FILE="$1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source file not found: $SRC_FILE"
  exit 1
fi

echo "Source: $SRC_FILE"
echo "Destination: $DEST_FILE"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run: not copying."
  exit 0
fi

mkdir -p "$DEST_DIR"

if [[ -f "$DEST_FILE" ]]; then
  BACKUP="$DEST_FILE.backup.$(date -u +%Y%m%dT%H%M%SZ)"
  echo "Found existing file at $DEST_FILE. Backing up to $BACKUP"
  cp -p "$DEST_FILE" "$BACKUP"
fi

echo "Copying $SRC_FILE -> $DEST_FILE"
cp -f "$SRC_FILE" "$DEST_FILE"

# Validate JSON
echo "Validating JSON..."
if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool "$DEST_FILE" >/dev/null
  echo "JSON valid (checked with python3)."
elif command -v jq >/dev/null 2>&1; then
  jq . "$DEST_FILE" >/dev/null
  echo "JSON valid (checked with jq)."
else
  echo "Could not find python3 or jq to validate JSON. Please install python3 or jq and validate manually."
fi

echo "Done. $DEST_FILE is ready."
