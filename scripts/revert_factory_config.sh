#!/usr/bin/env bash
set -euo pipefail

# Revert ~/.factory/config.json to the most recent backup created by scripts/apply_factory_config.sh
BACKUP_DIR="$HOME/.factory"
LATEST_BACKUP=$(ls -1t "$BACKUP_DIR"/config.json.backup.* 2>/dev/null | head -n 1 || true)
if [[ -z "$LATEST_BACKUP" ]]; then
  echo "No backup found in $BACKUP_DIR" >&2
  exit 1
fi

echo "Reverting $HOME/.factory/config.json from $LATEST_BACKUP"
cp -p "$LATEST_BACKUP" "$HOME/.factory/config.json"
chmod 600 "$HOME/.factory/config.json"
echo "Reverted and set permissions to 600"