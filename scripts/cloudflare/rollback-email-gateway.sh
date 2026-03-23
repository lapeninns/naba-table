#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_PATH="$ROOT_DIR/cloudflare/email-queue-gateway/wrangler.jsonc"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <version-id> [message]" >&2
  echo "Recent versions:" >&2
  script -q /dev/null npx wrangler deployments list --config "$CONFIG_PATH" >&2
  exit 1
fi

VERSION_ID="$1"
MESSAGE="${2:-Rollback email gateway to $VERSION_ID}"

script -q /dev/null npx wrangler rollback "$VERSION_ID" --config "$CONFIG_PATH" --message "$MESSAGE" --yes
