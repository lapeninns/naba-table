# Guest network policy

Files here are copied into the golden `nabatable-ci-golden` VM by
`bin/sync-vm-config.sh` and applied by `network/setup.sh`. The result is baked
into the golden image, so every disposable job instance boots with the job
network, the proxy and the egress policy (phase `test`) already active.
Nothing in this directory runs on the Mac.

| File                   | Guest path                            | Purpose                                               |
| ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| `egress.sh`            | `/etc/nabatable-ci/network/egress.sh` | nftables ruleset + `phase prep\|test` gate + `status` |
| `setup.sh`             | `/etc/nabatable-ci/network/setup.sh`  | job network, tinyproxy, dockerd/apt proxy             |
| `proxy/allowlist.txt`  | `/etc/tinyproxy/allowlist.txt`        | exact hostnames the proxy may connect to              |
| `proxy/tinyproxy.conf` | `/etc/tinyproxy/tinyproxy.conf`       | proxy listening on `10.90.0.1:8888` / `127.0.0.1`     |

## Flow

```
job container (nabatable-ci-jobs, --internal, 10.90.0.0/24, no DNS, no route)
   │  phase prep only: TCP 10.90.0.1:8888 (CONNECT host:443)
   ▼
tinyproxy (guest, uid tinyproxy) ── resolves allowlisted hostname via
   │                                systemd-resolved → Lima resolver
   │  output hook: drop private_v4 / link-local / metadata / IPv6
   ▼
internet: allowlisted hosts, ports 80/443 only
```

- `egress.sh apply` installs the ruleset in phase `test` (jobs isolated). The
  executor (`scripts/ci/executor/lima/egress.ts`) runs
  `sudo -n egress.sh phase prep` immediately before its `prepare` steps
  (`pnpm install --frozen-lockfile`) and `sudo -n egress.sh phase test`
  immediately after, before any repository code executes, and reads
  `egress.sh status` to confirm the phase it requested. The gate is a jump to
  a chain that is either empty (drop) or `accept`, evaluated before the
  `established` rule, so flipping to `test` kills in-flight connections too.
- `status` derives the phase from the live chain (`prep` if it contains
  `accept`, `test` if empty, `unknown` if the table is missing), so a stale or
  missing ruleset can never be reported as a valid phase.
- Image builds run with `--network=host` and `HTTPS_PROXY=http://127.0.0.1:8888`
  so they are subject to the same allowlist. Containers on Docker's default
  pool (10.200/16) have no forwarding at all.

## DNS-rebinding mitigation

1. Jobs cannot resolve names: the job network is `internal` (Docker's embedded
   DNS does not forward external queries for internal networks) and the guest
   drops any 53/udp+tcp from the job subnet. Jobs only ever `CONNECT` through
   the proxy by IP.
2. Only `systemd-resolve` may talk to the single resolver in the `resolver`
   set; every other DNS packet is dropped.
3. tinyproxy resolves allowlisted hostnames itself, but its outbound
   connections are filtered by _address_ in the `output` hook: anything that
   resolves into RFC1918, CGNAT, link-local, loopback, multicast, or IPv6 is
   dropped, so a rebinding record cannot reach the host, the LAN, the Lima
   host network, or the metadata address.
4. tinyproxy has no `Upstream` and `DisableViaHeader Yes`; it never learns
   about, or forwards to, another proxy.

## Qualification notes

Phase 2 list in the runbook: from a job container in phase `prep`,
`getent hosts registry.npmjs.org` must fail,
`curl -x http://10.90.0.1:8888 https://registry.npmjs.org/` must succeed, and
`curl -x http://10.90.0.1:8888 http://169.254.169.254/` and
`https://<rebinding test host>/` must be refused. In phase `test` every call
must fail with a connection error.

Known risk to verify on the pinned Docker Engine: the design relies on
containers on an `--internal` bridge network being able to reach the bridge's
own gateway address (`10.90.0.1`) on the guest. If the pinned engine blocks
host access from internal networks, `setup.sh` must switch the job network to
a plain bridge (`--opt com.docker.network.bridge.enable_ip_masquerade=false`)
and rely on `egress.sh` alone for isolation; the nftables rules already deny
everything except the phase-gated proxy port for the job subnet.
