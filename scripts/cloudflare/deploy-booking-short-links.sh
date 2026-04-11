#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_PATH="$ROOT_DIR/cloudflare/booking-short-links/wrangler.jsonc"

npx wrangler deploy --config "$CONFIG_PATH"
