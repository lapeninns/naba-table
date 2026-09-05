#!/usr/bin/env bash
# Deploys the booking short links worker (applies remote D1 migrations first).
#   bash scripts/cloudflare/deploy-booking-short-links.sh [--env staging|production] [--hosted] [--interactive]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/cloudflare/deploy-common.sh
source "$ROOT_DIR/scripts/cloudflare/deploy-common.sh"

run_worker_deploy booking-short-links "$@"
