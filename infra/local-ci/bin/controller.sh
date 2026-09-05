#!/bin/sh
# launchd wrapper for the Nabatable local CI controller.
#
# Runs as the `nabatable-ci` service account inside its login session. It sets
# a fixed PATH, loads the non-secret controller configuration, resolves the VM
# resource mode from infra/local-ci/operating.json, verifies that the Keychain
# items the controller and executor need exist, materialises the GitHub App
# private key into a 0600 file the controller reads
# (NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH, see scripts/ci/controller/main.ts ENV),
# and then execs `pnpm ci:controller` from the reviewed release checkout.
#
# Secret handling: the heartbeat token and the R2 credentials are read by the
# controller/executor themselves from the Keychain; this script only checks
# that the items exist. The GitHub App key is the one item the controller
# wants as a file, so it is copied straight from the Keychain into a private
# run directory (umask 077) without ever passing through argv, stdout, or a
# log line. The controller accepts the PEM verbatim or single-line base64.
# Portable to /bin/sh on macOS (bash 3.2 syntax only).
set -eu

export PATH='/opt/homebrew/opt/node@22/bin:/Users/nabatable-ci/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
umask 077

NABATABLE_CI_HOME="${NABATABLE_CI_HOME:-$HOME/nabatable-ci}"
release_dir="$NABATABLE_CI_HOME/current"
config_file="$NABATABLE_CI_HOME/config/controller.env"
run_dir="$NABATABLE_CI_HOME/run"

# Keychain contract: service = item name, account = nabatable-ci. Must match
# infra/local-ci/operating.json (controller.keychainItems), bin/install.sh,
# scripts/ci/controller/main.ts (DEFAULT_HEARTBEAT_KEYCHAIN_SERVICE,
# DEFAULT_KEYCHAIN_ACCOUNT) and scripts/ci/executor/config.ts
# (loadOperatingFacts).
KC_ACCOUNT='nabatable-ci'
KC_APP_KEY='nabatable-ci/github-app/nabatable-local-ci/private-key'
KC_HEARTBEAT='nabatable-ci/monitoring/heartbeat-token'
KC_R2_ACCESS_KEY_ID='nabatable-ci/r2/evidence/access-key-id'
KC_R2_SECRET_ACCESS_KEY='nabatable-ci/r2/evidence/secret-access-key'

log() { printf '%s controller.sh: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() {
  log "$*"
  exit 1
}

[ "$(id -un)" = 'nabatable-ci' ] || die "must run as the nabatable-ci service account (got $(id -un))"
[ -d "$release_dir" ] || die "release checkout missing at $release_dir (see docs/runbooks/local-ci.md, Updates)"
[ -f "$release_dir/package.json" ] || die "$release_dir is not a repository checkout"
[ -r "$config_file" ] || die "config missing at $config_file (bin/install.sh writes a template)"

# controller.env holds only non-secret settings (KEY=value, no expansion).
# Reject anything that looks like a secret or an unreplaced placeholder.
if grep -Eiq '^(NABATABLE_LOCAL_CI_PRIVATE_KEY|NABATABLE_CI_R2_ACCESS_KEY_ID|NABATABLE_CI_R2_SECRET_ACCESS_KEY|.*TOKEN|.*SECRET|.*PASSWORD)=' "$config_file"; then
  die "$config_file must not contain secrets; use Keychain items"
fi
if grep -q 'REPLACE_ME' "$config_file"; then
  die "$config_file still contains REPLACE_ME placeholders"
fi
# shellcheck disable=SC1090
set -a
. "$config_file"
set +a

# VM resource mode -> executor limits, from the single source of truth.
vm_mode="${NABATABLE_CI_VM_MODE:-normal}"
case "$vm_mode" in
  normal | dedicated) ;;
  *) die "NABATABLE_CI_VM_MODE must be normal or dedicated (got $vm_mode)" ;;
esac
mode_env=$(sh "$release_dir/infra/local-ci/bin/vm-mode.sh" "$vm_mode") || die 'vm-mode.sh failed'
# vm-mode.sh output is validated numeric KEY=value lines; safe to eval.
set -a
eval "$mode_env"
set +a

# Proxy URL the executor hands to prepare steps, from operating.json.
operating_json="$release_dir/infra/local-ci/operating.json"
proxy_url=$(sed -n 's/^ *"egressProxyUrl": *"\(http:\/\/[0-9.]*:[0-9]*\)",*$/\1/p' "$operating_json" | head -n 1)
[ -n "$proxy_url" ] || die "egressProxyUrl missing from $operating_json"
export NABATABLE_CI_EGRESS_PROXY_URL="${NABATABLE_CI_EGRESS_PROXY_URL:-$proxy_url}"
export NABATABLE_CI_OPERATING_JSON="$operating_json"
export NABATABLE_CI_DOCKER_CONTEXT='nabatable-ci'
export NABATABLE_CI_KEYCHAIN_ACCOUNT="$KC_ACCOUNT"
export NABATABLE_CI_HEARTBEAT_KEYCHAIN_SERVICE="$KC_HEARTBEAT"
export NABATABLE_CI_HEARTBEAT_KEYCHAIN_ACCOUNT="$KC_ACCOUNT"

# Existence checks only (no -w): the value is never printed.
for item in "$KC_HEARTBEAT" "$KC_R2_ACCESS_KEY_ID" "$KC_R2_SECRET_ACCESS_KEY"; do
  if ! security find-generic-password -s "$item" -a "$KC_ACCOUNT" >/dev/null 2>&1; then
    die "Keychain item '$item' (account $KC_ACCOUNT) is missing or the login Keychain is locked (log in as nabatable-ci once; see runbook)"
  fi
done

# GitHub App private key: Keychain -> 0600 file (PEM or base64 PEM; the
# controller decodes either). Written under umask 077, never echoed.
mkdir -p "$run_dir"
chmod 700 "$run_dir"
pem="$run_dir/github-app.pem"
rm -f "$pem.tmp"
if ! security find-generic-password -s "$KC_APP_KEY" -a "$KC_ACCOUNT" -w >"$pem.tmp" 2>/dev/null; then
  rm -f "$pem.tmp"
  die "Keychain item '$KC_APP_KEY' (account $KC_ACCOUNT) is missing or the login Keychain is locked"
fi
if [ ! -s "$pem.tmp" ]; then
  rm -f "$pem.tmp"
  die 'GitHub App key Keychain item is empty'
fi
mv "$pem.tmp" "$pem"
chmod 600 "$pem"
export NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH="$pem"

command -v limactl >/dev/null || die 'limactl not on PATH'
command -v docker >/dev/null || die 'docker CLI not on PATH'
command -v pnpm >/dev/null || die 'pnpm not on PATH (corepack enable as the service account)'

cd "$release_dir"
log "starting pnpm ci:controller from $release_dir (vm mode $vm_mode)"
exec pnpm ci:controller
