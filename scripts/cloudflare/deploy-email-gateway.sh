#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_PATH="$ROOT_DIR/cloudflare/email-queue-gateway/wrangler.jsonc"

script -q /dev/null npx wrangler deploy --config "$CONFIG_PATH"
