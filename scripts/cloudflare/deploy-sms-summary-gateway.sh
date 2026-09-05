#!/usr/bin/env bash
# Deploys the SMS summary gateway.
#   bash scripts/cloudflare/deploy-sms-summary-gateway.sh [--env staging|production] [--hosted] [--interactive]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/cloudflare/deploy-common.sh
source "$ROOT_DIR/scripts/cloudflare/deploy-common.sh"

run_worker_deploy sms-summary-gateway "$@"
