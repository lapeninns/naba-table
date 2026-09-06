#!/usr/bin/env bash
# Warm the self-hosted runner's persistent caches.
#
# WHY THIS IS NOT OPTIONAL
# ------------------------
# This host's uplink measures ~0.6 MB/s (verified against the macOS host
# directly, not just the guest -- see the networking note in
# lima/nabatable-runner.yaml). At that rate:
#
#   - a cold `pnpm install` for this workspace (1,359 packages, ~1.4 GB store)
#     cannot finish inside quality-gates' `timeout-minutes: 15` on fast-gates;
#   - Playwright's Chromium download adds a further ~170 MB per cold job.
#
# Unlike GitHub-hosted runners, which start cold every time, a self-hosted
# runner keeps these caches between jobs. Warming them once converts the
# repository's slowest CI dependency into a one-time cost. This is the single
# biggest practical advantage of the local plane on a slow link.
#
# WHAT IT DOES NOT DO
# -------------------
# No repository credential enters the guest. Only pnpm-lock.yaml and the
# workspace manifests are copied in; `pnpm fetch` populates the store from the
# lockfile alone and needs no source checkout and no git auth.
#
# Usage:
#   infra/local-ci/bin/runner-warm-caches.sh
#
# Safe to re-run: pnpm fetch and playwright install are both incremental.
set -euo pipefail

INSTANCE="${NABATABLE_RUNNER_INSTANCE:-nabatable-runner}"
PLAYWRIGHT_VERSION="${NABATABLE_PLAYWRIGHT_VERSION:-1.58.1}"
NODE_BIN='/opt/actions-runner/_work/_tool/node/22.23.2/arm64/bin'
WARM_DIR='/home/runner/warm'
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

die() { echo "warm-caches: $*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

command -v limactl >/dev/null || die 'limactl not found on PATH'
[ "$(limactl list --format '{{.Status}}' "$INSTANCE" 2>/dev/null)" = 'Running' ] \
  || die "Lima instance '$INSTANCE' is not running"

step 'Copying lockfile and manifests into the guest (no credentials)'
limactl shell "$INSTANCE" -- sudo install -d -m 0755 -o runner -g runner "$WARM_DIR"
for f in pnpm-lock.yaml package.json pnpm-workspace.yaml; do
  [ -f "$REPO_ROOT/$f" ] || die "missing $f in $REPO_ROOT"
  limactl copy "$REPO_ROOT/$f" "${INSTANCE}:/tmp/$f"
  limactl shell "$INSTANCE" -- sudo bash -c \
    "mv '/tmp/$f' '$WARM_DIR/$f' && chown runner:runner '$WARM_DIR/$f'"
done

step 'Populating the pnpm store from the lockfile (pnpm fetch)'
limactl shell "$INSTANCE" -- sudo -u runner bash -c "
  set -euo pipefail
  export PATH='$NODE_BIN':\$PATH
  cd '$WARM_DIR'
  corepack prepare pnpm@10.34.5 --activate >/dev/null 2>&1 || true
  pnpm fetch
"

step 'Installing Playwright Chromium and its system dependencies'
limactl shell "$INSTANCE" -- sudo -u runner bash -c "
  set -euo pipefail
  export PATH='$NODE_BIN':\$PATH
  sudo -n env PATH=\"\$PATH\" npx --yes playwright@${PLAYWRIGHT_VERSION} install-deps chromium
  npx --yes playwright@${PLAYWRIGHT_VERSION} install chromium
"

step 'Cache sizes'
limactl shell "$INSTANCE" -- sudo -u runner bash -c '
  printf "  pnpm store   %s\n" "$(du -sh /home/runner/.local/share/pnpm/store 2>/dev/null | cut -f1)"
  printf "  playwright   %s\n" "$(du -sh /home/runner/.cache/ms-playwright 2>/dev/null | cut -f1)"
  printf "  node toolcache %s\n" "$(du -sh /opt/actions-runner/_work/_tool 2>/dev/null | cut -f1)"
'

echo
echo 'Caches warm. Re-run after a significant pnpm-lock.yaml change.'
