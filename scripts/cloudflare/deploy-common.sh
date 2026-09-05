#!/usr/bin/env bash
# Shared deploy driver for the three customer Workers.
#
# Usage (from the worker-specific wrappers):
#   run_worker_deploy <worker> [--env staging|production] [--hosted] [--interactive] [-- <extra wrangler args>]
#
# Modes:
#   default      local operator path: wrangler deploy (plus D1 migrations for short links)
#   --hosted     delegates to scripts/deploy/workers.ts (versions upload/deploy, /ready
#                verification, separation-evidence check, rollback evidence). Used by CI.
#   --interactive wraps wrangler in a pseudo-terminal so interactive prompts work; portable
#                across macOS (`script -q /dev/null cmd`) and Linux (`script -qec cmd /dev/null`).
set -euo pipefail

deploy_common_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

run_with_pty() {
  if ! command -v script >/dev/null 2>&1; then
    echo "warning: 'script' not available; running without a pseudo-terminal" >&2
    "$@"
    return
  fi
  if [[ "$(uname -s)" == "Darwin" ]]; then
    script -q /dev/null "$@"
  else
    local quoted=""
    local arg
    for arg in "$@"; do
      quoted+=" $(printf '%q' "$arg")"
    done
    script -qec "${quoted# }" /dev/null
  fi
}

run_worker_deploy() {
  local worker="$1"
  shift
  local root_dir
  root_dir="$(deploy_common_root)"
  local config_path="$root_dir/cloudflare/$worker/wrangler.jsonc"
  local target="production"
  local hosted="0"
  local interactive="0"
  local extra=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env)
        [[ $# -ge 2 ]] || { echo "--env requires staging|production" >&2; return 2; }
        target="$2"
        shift 2
        ;;
      --env=*)
        target="${1#--env=}"
        shift
        ;;
      --hosted)
        hosted="1"
        shift
        ;;
      --interactive)
        interactive="1"
        shift
        ;;
      --)
        shift
        extra=("$@")
        break
        ;;
      *)
        echo "unknown argument: $1" >&2
        return 2
        ;;
    esac
  done

  case "$target" in
    staging|production) ;;
    *)
      echo "--env must be staging or production (received '$target')" >&2
      return 2
      ;;
  esac

  if [[ "$hosted" == "1" ]]; then
    (cd "$root_dir" && pnpm exec tsx scripts/deploy/workers.ts --env "$target" --worker "$worker" ${extra[@]+"${extra[@]}"})
    return
  fi

  local env_args=()
  if [[ "$target" == "staging" ]]; then
    env_args=(--env staging)
  fi

  local runner=()
  if [[ "$interactive" == "1" ]]; then
    runner=(run_with_pty)
  fi

  # `${arr[@]+"${arr[@]}"}` expands to nothing for an empty array under `set -u` on bash 3.2
  # (macOS default) as well as bash 5.
  if [[ "$worker" == "booking-short-links" ]]; then
    ${runner[@]+"${runner[@]}"} npx wrangler d1 migrations apply BOOKING_SHORT_LINKS_DB --remote \
      --config "$config_path" ${env_args[@]+"${env_args[@]}"}
  fi
  ${runner[@]+"${runner[@]}"} npx wrangler deploy --config "$config_path" \
    ${env_args[@]+"${env_args[@]}"} ${extra[@]+"${extra[@]}"}
}
