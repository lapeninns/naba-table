#!/bin/sh
# Host preflight for the Nabatable local CI runner (macOS, bash 3.2 / sh).
# Read-only: prints PASS/WARN/FAIL lines and exits non-zero on any FAIL.
# Never starts, stops, or modifies Docker contexts, containers, or VMs.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
failures=0
warnings=0

pass() { printf 'PASS  %s\n' "$*"; }
warn() {
  warnings=$((warnings + 1))
  printf 'WARN  %s\n' "$*"
}
fail() {
  failures=$((failures + 1))
  printf 'FAIL  %s\n' "$*"
}

# Architecture and OS
if [ "$(uname -s)" = 'Darwin' ] && [ "$(uname -m)" = 'arm64' ]; then
  pass 'macOS on Apple silicon'
else
  fail "requires macOS on arm64 (got $(uname -s) $(uname -m))"
fi
macos_major=$(sw_vers -productVersion 2>/dev/null | cut -d. -f1 || echo 0)
if [ "${macos_major:-0}" -ge 14 ]; then
  pass "macOS ${macos_major} (Virtualization.framework vz driver)"
else
  fail 'macOS 14 or newer is required for the vz Lima driver used here'
fi

# Tooling
if command -v limactl >/dev/null 2>&1; then
  pass "limactl $(limactl --version 2>/dev/null | head -n 1)"
else
  fail 'limactl not found (brew install lima)'
fi
if command -v qemu-img >/dev/null 2>&1; then
  pass 'qemu-img present (golden image export)'
else
  warn 'qemu-img not found (brew install qemu); only needed by bin/build-base-image.sh'
fi
if command -v docker >/dev/null 2>&1; then
  pass 'docker CLI present'
  if docker context inspect nabatable-ci >/dev/null 2>&1; then
    pass 'docker context nabatable-ci exists'
  else
    warn 'docker context nabatable-ci not created yet (bin/install.sh creates it; the default context is never touched)'
  fi
else
  fail 'docker CLI not found (brew install docker  # CLI only; Docker Desktop is not required)'
fi
if command -v pnpm >/dev/null 2>&1; then
  pass "pnpm $(pnpm --version 2>/dev/null)"
else
  fail 'pnpm not found (corepack enable)'
fi

# Power: the controller refuses to schedule on battery.
if pmset -g batt 2>/dev/null | grep -q 'AC Power'; then
  pass 'on AC power'
else
  fail 'not on AC power (connect the charger; controller will not run on battery)'
fi

# Disk: golden image + per-job clones + spool need headroom.
free_gib=$(df -g "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')
if [ -n "${free_gib:-}" ] && [ "$free_gib" -ge 100 ]; then
  pass "free disk ${free_gib}GiB (>= 100GiB)"
else
  fail "free disk ${free_gib:-unknown}GiB (< 100GiB required)"
fi

# FileVault: informational. After a cold reboot the agent cannot start until
# the disk is unlocked and the service account session exists.
if fdesetup status 2>/dev/null | grep -q 'FileVault is On'; then
  warn 'FileVault is On: after a cold reboot unlock the disk as nabatable-ci so its session and Keychain come up (runbook: FileVault)'
else
  warn 'FileVault is Off: consider enabling it; the service account keychain is stored on this disk'
fi

# VPN: split-tunnel/full-tunnel changes alter the host route table but not
# the guest policy; informational.
if scutil --nc list 2>/dev/null | grep -q '(Connected)'; then
  warn 'a VPN configuration is connected: see runbook "VPN changes" (guest egress still goes only via the proxy)'
elif ifconfig 2>/dev/null | grep -q '^utun'; then
  warn 'utun interfaces present (VPN or Tailscale-style client): see runbook "VPN changes"'
else
  pass 'no VPN connection detected'
fi

# Sleep: the controller relies on the Mac staying awake while a job runs.
if pmset -g 2>/dev/null | grep -Eq '^ *sleep +0'; then
  pass 'system sleep disabled on AC'
else
  warn 'system sleep is enabled on AC; the controller holds caffeinate -i while a job runs (runbook: Lid, display, and sleep)'
fi

# Placeholders in the template must be replaced before the golden image is built.
template="$root/infra/local-ci/lima/nabatable-ci.yaml"
if [ -f "$template" ]; then
  if grep -Eq '^[[:space:]]*(- location:|digest:|DOCKER_CE_VERSION=).*REPLACE_ME' "$template"; then
    fail 'lima/nabatable-ci.yaml still contains REPLACE_ME placeholders (image digest / Docker version)'
  else
    pass 'lima template has no placeholders'
  fi
else
  fail "lima template missing at $template"
fi

printf '\n%d failure(s), %d warning(s)\n' "$failures" "$warnings"
[ "$failures" -eq 0 ]
