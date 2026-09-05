#!/usr/bin/env bash
# Deploys the email queue gateway.
#   bash scripts/cloudflare/deploy-email-gateway.sh [--env staging|production] [--hosted] [--interactive]
# The previous macOS-only `script -q /dev/null` invocation is now behind --interactive and
# works on Linux too; --hosted delegates to scripts/deploy/workers.ts for CI use.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/cloudflare/deploy-common.sh
source "$ROOT_DIR/scripts/cloudflare/deploy-common.sh"

run_worker_deploy email-queue-gateway "$@"
