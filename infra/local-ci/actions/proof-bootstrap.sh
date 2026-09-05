#!/usr/bin/env bash
# Run as root only in a disposable, mount-free qualification VM.
set -euo pipefail
test "$(id -u)" = 0
test "$(uname -m)" = aarch64
useradd --create-home --uid 1100 --shell /bin/bash runnerproof
install -d -o runnerproof -g runnerproof -m 0700 /opt/actions-proof
install -d -m 0755 /etc/nabatable-ci
install -o root -g root -m 0444 /tmp/actions-proof.json /etc/nabatable-ci/actions-proof.json
install -o root -g root -m 0555 /tmp/proof-admission.sh /etc/nabatable-ci/proof-admission.sh
printf '%s  %s\n' '9b1dc70626422526e3c94767cf024896beb15da5342a3f4819bf2feac13e0393' /tmp/actions-runner.tar.gz | sha256sum -c -
tar -xzf /tmp/actions-runner.tar.gz -C /opt/actions-proof
chown -R runnerproof:runnerproof /opt/actions-proof
# The runner account can use the guest DNS stub and public HTTPS only.
# Private/link-local/host networks remain denied even on port 443.
nft -f - <<'NFT'
table inet actions_proof {
  chain output {
    type filter hook output priority -10; policy accept;
    meta skuid != 1100 return
    ip daddr 127.0.0.53 udp dport 53 accept
    ip daddr 127.0.0.53 tcp dport 53 accept
    ip daddr { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.168.0.0/16, 198.18.0.0/15, 224.0.0.0/4, 240.0.0.0/4 } reject
    ip6 daddr { ::/128, ::1/128, ::ffff:0:0/96, fc00::/7, fe80::/10, ff00::/8 } reject
    tcp dport 443 accept
    reject
  }
}
NFT
# The golden image also denies guest egress outside its proxy. Add a proof-only
# exception for this account, with private destinations rejected first.
nft insert rule inet nabatable_ci output meta nfproto ipv4 meta skuid 1100 tcp dport 443 accept
nft insert rule inet nabatable_ci output meta skuid 1100 ip daddr @private_v4 tcp dport 443 reject
sudo -u runnerproof bash -c 'cd /opt/actions-proof && ./bin/Runner.Listener --version'
sudo -u runnerproof python3 - <<'PY'
import socket
import urllib.request
with urllib.request.urlopen('https://api.github.com', timeout=15) as response:
    assert response.status == 200
for address in ['127.0.0.1', '192.168.5.2', '10.0.0.1', '169.254.169.254']:
    for port in [80, 443]:
        try:
            socket.create_connection((address, port), timeout=2)
        except OSError:
            continue
        raise SystemExit('Private network unexpectedly reachable')
print('Public HTTPS passed; private HTTP/HTTPS denied')
PY
# A controlled listener distinguishes firewall denial from an absent service.
python3 - <<'PY'
import socket
import subprocess
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 443))
    listener.listen(2)
    with socket.create_connection(('127.0.0.1', 443), timeout=2):
        accepted, _ = listener.accept()
        accepted.close()
    probe = subprocess.run(['sudo', '-n', '-u', 'runnerproof', 'python3', '-c', '''
import socket, sys
try:
    socket.create_connection(('127.0.0.1', 443), timeout=2)
except OSError:
    sys.exit(0)
sys.exit(1)
'''], timeout=5, check=False)
    if probe.returncode != 0:
        raise SystemExit('Runner reached the controlled private HTTPS listener')
print('Controlled private listener reachable by root, denied to runner')
PY
