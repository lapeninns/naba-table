#!/bin/bash
# Idempotent guest network setup (runs INSIDE the golden nabatable-ci VM,
# invoked by bin/sync-vm-config.sh after the config files are copied in).
# Everything it creates persists in the golden image, so every disposable job
# instance boots with the job network, proxy and egress policy in place.
#
# 1. records the guest's resolver for egress.sh (Lima host resolver)
# 2. creates the internal Docker job network 10.90.0.0/24 (nabatable-ci-jobs)
# 3. installs the tinyproxy config + allowlist and starts tinyproxy
# 4. points dockerd and apt at the local proxy
# 5. applies the nftables egress policy (phase test) and persists it
set -euo pipefail

CONF_DIR='/etc/nabatable-ci/network'
JOB_NETWORK='nabatable-ci-jobs'
JOB_SUBNET='10.90.0.0/24'
JOB_GATEWAY='10.90.0.1'
PROXY_URL='http://127.0.0.1:8888'
REGISTRY_ALIAS='ci-registry.local'

[ "$(id -u)" -eq 0 ] || {
  echo 'setup.sh: must run as root' >&2
  exit 1
}

for f in egress.sh allowlist.txt tinyproxy.conf; do
  [ -r "$CONF_DIR/$f" ] || {
    echo "setup.sh: missing $CONF_DIR/$f (run bin/sync-vm-config.sh)" >&2
    exit 1
  }
done
grep -q 'REPLACE_ME' "$CONF_DIR/allowlist.txt" "$CONF_DIR/tinyproxy.conf" && {
  echo 'setup.sh: placeholders present in proxy config; refusing' >&2
  exit 1
}

# 1. resolver (first IPv4 upstream reported by systemd-resolved)
if [ -z "${NABATABLE_CI_RESOLVER:-}" ]; then
  NABATABLE_CI_RESOLVER=$(resolvectl dns 2>/dev/null | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -n 1 || true)
fi
[ -n "$NABATABLE_CI_RESOLVER" ] || {
  echo 'setup.sh: could not determine resolver; set NABATABLE_CI_RESOLVER' >&2
  exit 1
}
printf '%s\n' "$NABATABLE_CI_RESOLVER" >"$CONF_DIR/resolver"

# 2. job network (internal: Docker adds no NAT and no default route; the
#    gateway address stays on the guest bridge so the proxy can listen on it)
if ! docker network inspect "$JOB_NETWORK" >/dev/null 2>&1; then
  docker network create \
    --internal \
    --subnet "$JOB_SUBNET" \
    --gateway "$JOB_GATEWAY" \
    --opt com.docker.network.bridge.name=nbci-jobs \
    --opt com.docker.network.bridge.enable_icc=false \
    "$JOB_NETWORK" >/dev/null
fi
ip -4 addr show dev nbci-jobs | grep -q "inet ${JOB_GATEWAY}/" || {
  echo "setup.sh: bridge nbci-jobs does not carry ${JOB_GATEWAY}; tinyproxy cannot listen for jobs" >&2
  exit 1
}
grep -q "$REGISTRY_ALIAS" /etc/hosts || echo "127.0.0.1 ${REGISTRY_ALIAS}" >>/etc/hosts

# 3. tinyproxy (listens on the job bridge, so start after docker has created it)
install -m 0644 "$CONF_DIR/tinyproxy.conf" /etc/tinyproxy/tinyproxy.conf
install -m 0644 "$CONF_DIR/allowlist.txt" /etc/tinyproxy/allowlist.txt
mkdir -p /etc/systemd/system/tinyproxy.service.d
cat >/etc/systemd/system/tinyproxy.service.d/override.conf <<'UNIT'
[Unit]
After=docker.service
Requires=docker.service

[Service]
Restart=on-failure
RestartSec=2
UNIT
systemctl daemon-reload
systemctl enable --now tinyproxy
systemctl restart tinyproxy

# 4. dockerd + apt go through the proxy (the guest has no other egress). The
#    registry alias is local and must bypass the proxy.
mkdir -p /etc/systemd/system/docker.service.d
cat >/etc/systemd/system/docker.service.d/proxy.conf <<UNIT
[Service]
Environment="HTTP_PROXY=${PROXY_URL}"
Environment="HTTPS_PROXY=${PROXY_URL}"
Environment="NO_PROXY=localhost,127.0.0.1,${REGISTRY_ALIAS}"
UNIT
cat >/etc/apt/apt.conf.d/90nabatable-ci-proxy <<APT
Acquire::http::Proxy "${PROXY_URL}";
Acquire::https::Proxy "${PROXY_URL}";
APT
systemctl daemon-reload
systemctl restart docker

# 5. egress policy (phase test, persisted for clones)
chmod 0755 "$CONF_DIR/egress.sh"
NABATABLE_CI_RESOLVER="$NABATABLE_CI_RESOLVER" "$CONF_DIR/egress.sh" apply
"$CONF_DIR/egress.sh" phase test
systemctl enable nftables
echo 'setup.sh: done'
