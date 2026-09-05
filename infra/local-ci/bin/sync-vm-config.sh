#!/bin/sh
# Copy guest-side configuration (seccomp profile, egress policy, proxy config)
# into a running Lima instance and apply it. Idempotent; used by
# bin/build-base-image.sh against the golden instance and re-runnable by an
# operator after every reviewed release. Uses limactl copy (scp over Lima's
# SSH channel) because the VM has no host mounts by design.
#
#   sync-vm-config.sh [instance-name]     default: nabatable-ci-golden
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
vm="${1:-nabatable-ci-golden}"

case "$vm" in
  nabatable-ci-golden | nabatable-ci-golden-*) ;;
  *)
    echo "sync-vm-config.sh: refusing to configure '$vm'; only golden instances (nabatable-ci-golden*) are configured by hand. Job instances are clones and must never be modified." >&2
    exit 2
    ;;
esac

command -v limactl >/dev/null || {
  echo 'sync-vm-config.sh: limactl not found' >&2
  exit 1
}
limactl list --format '{{.Name}} {{.Status}}' 2>/dev/null | grep -q "^${vm} Running$" || {
  echo "sync-vm-config.sh: VM ${vm} is not running (limactl start ${vm})" >&2
  exit 1
}

for f in \
  infra/local-ci/seccomp/ci-job.json \
  infra/local-ci/network/egress.sh \
  infra/local-ci/network/setup.sh \
  infra/local-ci/network/proxy/allowlist.txt \
  infra/local-ci/network/proxy/tinyproxy.conf; do
  [ -f "$root/$f" ] || {
    echo "sync-vm-config.sh: missing $root/$f" >&2
    exit 1
  }
  # Shell scripts validate their dynamic inputs at runtime; their rejection
  # patterns mention REPLACE_ME deliberately. Scan static configuration only.
  if [ "${f##*.}" != sh ] && grep -q 'REPLACE_ME' "$root/$f"; then
    echo "sync-vm-config.sh: $f contains REPLACE_ME placeholders; refusing" >&2
    exit 1
  fi
done

stage="/tmp/nabatable-ci-config.$$"
limactl shell "$vm" -- mkdir -p "$stage"
limactl copy "$root/infra/local-ci/seccomp/ci-job.json" "${vm}:${stage}/ci-job.json"
limactl copy "$root/infra/local-ci/network/egress.sh" "${vm}:${stage}/egress.sh"
limactl copy "$root/infra/local-ci/network/setup.sh" "${vm}:${stage}/setup.sh"
limactl copy "$root/infra/local-ci/network/proxy/allowlist.txt" "${vm}:${stage}/allowlist.txt"
limactl copy "$root/infra/local-ci/network/proxy/tinyproxy.conf" "${vm}:${stage}/tinyproxy.conf"

limactl shell "$vm" -- sudo sh -c "
  set -eu
  install -d -m 0755 /etc/nabatable-ci/seccomp /etc/nabatable-ci/network
  install -m 0644 '${stage}/ci-job.json' /etc/nabatable-ci/seccomp/ci-job.json
  install -m 0755 '${stage}/egress.sh' /etc/nabatable-ci/network/egress.sh
  install -m 0755 '${stage}/setup.sh' /etc/nabatable-ci/network/setup.sh
  install -m 0644 '${stage}/allowlist.txt' /etc/nabatable-ci/network/allowlist.txt
  install -m 0644 '${stage}/tinyproxy.conf' /etc/nabatable-ci/network/tinyproxy.conf
  rm -rf '${stage}'
  /etc/nabatable-ci/network/setup.sh
"
echo "sync-vm-config.sh: guest configuration applied to ${vm}"
