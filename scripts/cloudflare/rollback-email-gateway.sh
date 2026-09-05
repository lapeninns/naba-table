#!/usr/bin/env bash
# Rolls the email queue gateway back to a previous version.
#   bash scripts/cloudflare/rollback-email-gateway.sh <version-id> [message] [--env staging|production]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_PATH="$ROOT_DIR/cloudflare/email-queue-gateway/wrangler.jsonc"
# shellcheck source=scripts/cloudflare/deploy-common.sh
source "$ROOT_DIR/scripts/cloudflare/deploy-common.sh"

TARGET="production"
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      TARGET="$2"
      shift 2
      ;;
    --env=*)
      TARGET="${1#--env=}"
      shift
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

ENV_ARGS=()
if [[ "$TARGET" == "staging" ]]; then
  ENV_ARGS=(--env staging)
elif [[ "$TARGET" != "production" ]]; then
  echo "--env must be staging or production (received '$TARGET')" >&2
  exit 2
fi

if [[ ${#POSITIONAL[@]} -lt 1 ]]; then
  echo "Usage: $0 <version-id> [message] [--env staging|production]" >&2
  echo "Recent versions:" >&2
  npx wrangler deployments list --config "$CONFIG_PATH" ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} >&2
  exit 1
fi

VERSION_ID="${POSITIONAL[0]}"
MESSAGE="${POSITIONAL[1]:-Rollback email gateway to $VERSION_ID}"

run_with_pty npx wrangler rollback "$VERSION_ID" --config "$CONFIG_PATH" ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} --message "$MESSAGE" --yes
