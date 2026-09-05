#!/bin/bash
# Nabatable local CI guest egress policy (runs INSIDE a nabatable-ci VM).
#
# Installed to /etc/nabatable-ci/network/egress.sh by bin/sync-vm-config.sh and
# baked into the golden image, so every disposable job instance boots with the
# ruleset already persisted in /etc/nftables.conf (phase `test`).
#
#   egress.sh apply          install/replace the nftables ruleset (idempotent, phase test)
#   egress.sh phase prep     jobs may reach the proxy (dependency preparation)
#   egress.sh phase test     jobs are fully isolated (default after apply/boot)
#   egress.sh status         first line `phase: prep|test|unknown`, then the live ruleset
#   egress.sh print          print the ruleset that would be applied
#   egress.sh flush          remove the ruleset (operator use only)
#
# The executor (scripts/ci/executor/lima/egress.ts) runs
# `sudo -n /etc/nabatable-ci/network/egress.sh phase <prep|test>` and then
# `status`, and refuses to continue unless the reported phase is the one it
# requested. The phase is derived from the live chain, never from a file, so a
# missing or stale ruleset reports `unknown` and the job aborts.
#
# Model
# -----
# All egress from the guest goes through tinyproxy running as the `tinyproxy`
# user on 10.90.0.1:8888 (job side: gateway of the internal job network) and
# 127.0.0.1:8888 (guest side for dockerd, apt and image builds). tinyproxy is
# the only principal allowed to open outbound 80/443 and systemd-resolved is
# the only principal allowed to resolve names (via the fixed resolver). Job
# containers live on the pre-created `--internal` Docker network
# nabatable-ci-jobs (10.90.0.0/24) and can talk to exactly one destination,
# the proxy, and only while the executor holds the network in phase `prep`.
#
# Denied everywhere, in both directions where it matters:
#   - RFC1918 (10/8, 172.16/12, 192.168/16), CGNAT 100.64/10, link-local
#     169.254/16 (includes the cloud metadata address 169.254.169.254),
#     loopback of the host as seen from the guest, multicast, and IPv6 (fd00::/8
#     and everything else: IPv6 is disabled at the sysctl level and dropped here
#     as defence in depth)
#   - DNS (53/udp, 53/tcp) from anything except systemd-resolved to the single
#     configured resolver; jobs have no DNS path at all
#   - any forwarding of job traffic, and any direct egress from other
#     containers (the default Docker pool 10.200/16; image builds use
#     --network=host + the loopback proxy)
#
# DNS rebinding: jobs never resolve names (no DNS path exists for them) and
# only ever CONNECT to the proxy by IP. The proxy resolves allowlisted
# hostnames itself, and its *outbound* traffic is filtered by destination
# address, so a hostname that rebinds to a private/link-local address is
# dropped at the proxy's output hook regardless of what the resolver returned.
set -euo pipefail

TABLE='nabatable_ci'
JOB_SUBNET='10.90.0.0/24'
JOB_GATEWAY='10.90.0.1'
DOCKER_POOL='10.200.0.0/16'
PROXY_PORT='8888'
LIMA_HOST_NET='192.168.5.0/24'
METADATA_ADDR='169.254.169.254'
RESOLVER_FILE='/etc/nabatable-ci/network/resolver'

log() { printf 'egress: %s\n' "$*" >&2; }
die() {
  log "$*"
  exit 1
}

require_root() {
  [ "$(id -u)" -eq 0 ] || die 'must run as root'
}

resolver_address() {
  local addr="${NABATABLE_CI_RESOLVER:-}"
  if [ -z "$addr" ] && [ -r "$RESOLVER_FILE" ]; then
    addr=$(head -n 1 "$RESOLVER_FILE" | tr -d '[:space:]')
  fi
  case "$addr" in
    '' | *REPLACE_ME*) die "resolver is unconfigured (set NABATABLE_CI_RESOLVER or write $RESOLVER_FILE)" ;;
  esac
  printf '%s\n' "$addr" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' || die "resolver '$addr' is not an IPv4 address"
  printf '%s' "$addr"
}

ruleset() {
  local resolver="$1"
  cat <<NFT
table inet ${TABLE} {
  set private_v4 {
    type ipv4_addr
    flags interval
    elements = {
      0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16,
      172.16.0.0/12, 192.0.0.0/24, 192.168.0.0/16, 198.18.0.0/15,
      224.0.0.0/4, 240.0.0.0/4
    }
  }

  set resolver {
    type ipv4_addr
    elements = { ${resolver} }
  }

  # Phase gate. Empty in phase "test" (fall through to the drop that follows
  # every jump), a single "accept" in phase "prep".
  chain job_to_proxy {
  }

  chain input {
    type filter hook input priority -10; policy accept;
    iifname "lo" accept
    meta nfproto ipv6 counter drop comment "no ipv6"
    ip saddr ${JOB_SUBNET} ip daddr ${JOB_GATEWAY} tcp dport ${PROXY_PORT} jump job_to_proxy
    ip saddr ${JOB_SUBNET} counter drop comment "jobs: proxy only, phase gated"
    ip saddr ${DOCKER_POOL} counter drop comment "other containers: no guest services"
    ct state established,related accept
  }

  chain forward {
    type filter hook forward priority -10; policy accept;
    meta nfproto ipv6 counter drop comment "no ipv6"
    ip daddr ${METADATA_ADDR} counter drop comment "metadata endpoint"
    ip saddr ${JOB_SUBNET} counter drop comment "jobs: never forwarded"
    ip daddr ${JOB_SUBNET} counter drop comment "jobs: never reachable"
    ip saddr ${DOCKER_POOL} counter drop comment "containers: no direct egress"
    ip daddr @private_v4 counter drop comment "no host/LAN/link-local/loopback"
  }

  chain output {
    type filter hook output priority -10; policy accept;
    oifname "lo" accept
    meta nfproto ipv6 counter drop comment "no ipv6 egress (fd00::/8 and all)"
    ip daddr ${METADATA_ADDR} counter drop comment "metadata endpoint"
    ip daddr ${JOB_SUBNET} tcp sport ${PROXY_PORT} jump job_to_proxy
    ip daddr ${JOB_SUBNET} counter drop comment "jobs: proxy replies only, phase gated"
    ct state established,related accept
    meta skuid "systemd-resolve" ip daddr @resolver udp dport 53 accept
    meta skuid "systemd-resolve" ip daddr @resolver tcp dport 53 accept
    meta skuid "systemd-timesync" udp dport 123 accept
    udp dport 53 counter drop comment "dns: systemd-resolved to the resolver set only"
    tcp dport 53 counter drop comment "dns: systemd-resolved to the resolver set only"
    meta skuid "tinyproxy" ip daddr @private_v4 counter drop comment "proxy: rebinding to private space"
    meta skuid "tinyproxy" tcp dport { 80, 443 } accept
    meta skuid "tinyproxy" counter drop comment "proxy: 80/443 only"
    ip daddr ${LIMA_HOST_NET} accept comment "lima guest agent / ssh replies"
    ip daddr @private_v4 counter drop comment "guest: no host/LAN"
    counter drop comment "guest: egress only via proxy"
  }
}
NFT
}

live_phase() {
  # Derived from the live chain so it can never disagree with enforcement.
  if ! nft list table inet "$TABLE" >/dev/null 2>&1; then
    printf 'unknown'
    return
  fi
  if nft list chain inet "$TABLE" job_to_proxy 2>/dev/null | grep -q 'accept'; then
    printf 'prep'
  else
    printf 'test'
  fi
}

apply() {
  require_root
  command -v nft >/dev/null || die 'nft not installed'
  local resolver
  resolver=$(resolver_address)
  getent passwd tinyproxy >/dev/null || die 'tinyproxy user missing (install tinyproxy first)'
  local tmp
  tmp=$(mktemp)
  {
    printf 'table inet %s\n' "$TABLE"
    printf 'delete table inet %s\n' "$TABLE"
    ruleset "$resolver"
  } >"$tmp"
  nft -c -f "$tmp" || die 'ruleset failed validation; nothing changed'
  nft -f "$tmp"
  rm -f "$tmp"
  # Persist for reboot and for every clone of the golden image (phase test);
  # nftables.service loads /etc/nftables.conf.
  {
    printf '#!/usr/sbin/nft -f\nflush ruleset\n'
    ruleset "$resolver"
  } >/etc/nftables.conf
  chmod 0644 /etc/nftables.conf
  log "applied (resolver=${resolver}, phase=test)"
}

phase() {
  require_root
  local next="${1:-}"
  case "$next" in
    prep | test) ;;
    *) die 'usage: egress.sh phase <prep|test>' ;;
  esac
  nft list table inet "$TABLE" >/dev/null 2>&1 || die 'ruleset not applied; run "egress.sh apply" first'
  nft flush chain inet "$TABLE" job_to_proxy
  if [ "$next" = 'prep' ]; then
    nft add rule inet "$TABLE" job_to_proxy accept
  else
    # Existing flows are already dead (the jump precedes the established rule)
    # but clear conntrack so state does not linger into the test phase.
    if command -v conntrack >/dev/null; then
      conntrack -D -s "$JOB_SUBNET" >/dev/null 2>&1 || true
      conntrack -D -d "$JOB_SUBNET" >/dev/null 2>&1 || true
    fi
  fi
  [ "$(live_phase)" = "$next" ] || die "phase switch to $next did not take effect"
  log "phase=${next}"
}

status() {
  printf 'phase: %s\n' "$(live_phase)"
  nft list table inet "$TABLE" 2>/dev/null || printf 'ruleset: (not applied)\n'
}

flush() {
  require_root
  nft delete table inet "$TABLE" 2>/dev/null || true
  log 'flushed'
}

case "${1:-}" in
  apply) apply ;;
  phase) phase "${2:-}" ;;
  status) status ;;
  flush) flush ;;
  print)
    # Resolve first so an unconfigured resolver fails the command instead of
    # dying inside a subshell and printing a ruleset with an empty set.
    resolver=$(resolver_address)
    ruleset "$resolver"
    ;;
  *)
    echo 'usage: egress.sh <apply|phase prep|phase test|status|flush|print>' >&2
    exit 2
    ;;
esac
