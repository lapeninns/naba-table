#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_PATH="$ROOT_DIR/cloudflare/booking-short-links/wrangler.jsonc"

npx wrangler d1 migrations apply BOOKING_SHORT_LINKS_DB --remote --config "$CONFIG_PATH"
npx wrangler deploy --config "$CONFIG_PATH"
