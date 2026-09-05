import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { infraRoot, nonCommentLines, readInfraFile, runShell, syntaxCheck } from './helpers';

const allowlist = nonCommentLines(readInfraFile('network/proxy/allowlist.txt'));
const tinyproxy = nonCommentLines(readInfraFile('network/proxy/tinyproxy.conf'));
const egress = readInfraFile('network/egress.sh');
const setup = readInfraFile('network/setup.sh');
const egressScript = path.join(infraRoot, 'network/egress.sh');

const hostnamePattern = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

describe('infra/local-ci/network/proxy/allowlist.txt', () => {
  it('contains only exact lowercase hostnames (no wildcards, regex, ports, or paths)', () => {
    expect(allowlist.length).toBeGreaterThan(0);
    for (const host of allowlist) {
      expect(host, `${host} is not an exact hostname`).toMatch(hostnamePattern);
      expect(host).not.toMatch(/[*?[\]()|\\^$/:]/);
    }
    expect(new Set(allowlist).size).toBe(allowlist.length);
  });

  it('covers the npm registry, Playwright CDN, container registries, and Ubuntu archives', () => {
    for (const host of [
      'registry.npmjs.org',
      'cdn.playwright.dev',
      'playwright.download.prss.microsoft.com',
      'ghcr.io',
      'registry-1.docker.io',
      'auth.docker.io',
      'production.cloudfront.docker.com',
      'ports.ubuntu.com',
      'archive.ubuntu.com',
      'security.ubuntu.com',
      'download.docker.com',
    ]) {
      expect(allowlist).toContain(host);
    }
  });

  it('never allows private-space, metadata, localhost, or the local registry alias', () => {
    for (const host of allowlist) {
      expect(host).not.toMatch(/(^|\.)(localhost|local|internal|lan|home|corp)$/);
      expect(host).not.toMatch(/^\d/);
    }
    expect(allowlist).not.toContain('ci-registry.local');
  });
});

describe('infra/local-ci/network/proxy/tinyproxy.conf', () => {
  const directive = (name: string): readonly string[] =>
    tinyproxy
      .filter((line) => line.split(/\s+/)[0] === name)
      .map((line) => line.slice(name.length).trim());

  it('listens only on the job gateway and loopback and allows only those clients', () => {
    expect(directive('Listen')).toEqual(['10.90.0.1', '127.0.0.1']);
    expect(directive('Allow')).toEqual(['127.0.0.1', '10.90.0.0/24']);
    expect(directive('Port')).toEqual(['8888']);
  });

  it('is default-deny with hostname filtering and no upstream', () => {
    expect(directive('FilterDefaultDeny')).toEqual(['Yes']);
    expect(directive('FilterURLs')).toEqual(['Off']);
    expect(directive('FilterType')).toEqual(['fnmatch']);
    expect(directive('Filter')).toEqual(['"/etc/tinyproxy/allowlist.txt"']);
    expect(directive('Upstream')).toEqual([]);
    expect(directive('ReversePath')).toEqual([]);
    expect(directive('DisableViaHeader')).toEqual(['Yes']);
    expect(directive('ConnectPort')).toEqual(['443']);
    expect(directive('User')).toEqual(['tinyproxy']);
  });
});

describe('infra/local-ci/network/egress.sh', () => {
  it('is valid bash', () => {
    expect(syntaxCheck('bash', 'network/egress.sh')).toBe('');
    expect(syntaxCheck('bash', 'network/setup.sh')).toBe('');
  });

  it('denies host, LAN, link-local, loopback, CGNAT, multicast, and the metadata address', () => {
    for (const cidr of [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '169.254.0.0/16',
      '127.0.0.0/8',
      '100.64.0.0/10',
      '224.0.0.0/4',
    ]) {
      expect(egress).toContain(cidr);
    }
    expect(egress).toContain("METADATA_ADDR='169.254.169.254'");
    expect(egress).toMatch(/ip daddr \$\{METADATA_ADDR\} counter drop/);
    expect(egress).toMatch(/ip daddr @private_v4 counter drop/);
  });

  it('drops all IPv6 in input, forward, and output hooks', () => {
    const ipv6Drops = egress.match(/meta nfproto ipv6 counter drop/g) ?? [];
    expect(ipv6Drops.length).toBe(3);
    expect(egress).toContain('fd00::/8');
  });

  it('allows DNS only from systemd-resolved to the configured resolver', () => {
    expect(egress).toContain('meta skuid "systemd-resolve" ip daddr @resolver udp dport 53 accept');
    expect(egress).toContain('meta skuid "systemd-resolve" ip daddr @resolver tcp dport 53 accept');
    expect(egress).toContain('udp dport 53 counter drop');
    expect(egress).toContain('tcp dport 53 counter drop');
    // The resolver must be configured; placeholders are refused.
    expect(egress).toContain("'' | *REPLACE_ME*) die");
  });

  it('gates job to proxy traffic by phase in both directions, before the established rule', () => {
    expect(egress).toContain("JOB_SUBNET='10.90.0.0/24'");
    expect(egress).toContain("JOB_GATEWAY='10.90.0.1'");
    expect(egress).toContain("PROXY_PORT='8888'");
    const input = egress.slice(egress.indexOf('chain input'), egress.indexOf('chain forward'));
    const forward = egress.slice(egress.indexOf('chain forward'), egress.indexOf('chain output'));
    const output = egress.slice(egress.indexOf('chain output'), egress.indexOf('live_phase()'));
    for (const chain of [input, output]) {
      const jump = chain.indexOf('jump job_to_proxy');
      const established = chain.indexOf('ct state established,related accept');
      expect(jump).toBeGreaterThan(-1);
      expect(established).toBeGreaterThan(jump);
    }
    expect(egress).toContain(
      'ip saddr ${JOB_SUBNET} ip daddr ${JOB_GATEWAY} tcp dport ${PROXY_PORT} jump job_to_proxy',
    );
    expect(egress).toContain('ip daddr ${JOB_SUBNET} tcp sport ${PROXY_PORT} jump job_to_proxy');
    expect(forward).toContain('ip saddr ${JOB_SUBNET} counter drop');
    expect(forward).toContain('ip daddr ${JOB_SUBNET} counter drop');
    expect(forward).toContain('ip saddr ${DOCKER_POOL} counter drop');
    expect(egress).toMatch(/prep \| test\) ;;/);
    expect(egress).toContain('nft add rule inet "$TABLE" job_to_proxy accept');
    expect(egress).toContain('nft flush chain inet "$TABLE" job_to_proxy');
  });

  it('reports the phase from the live chain, the format the executor parses, and fails closed as unknown', () => {
    // scripts/ci/executor/lima/egress.ts parses /^phase:\s*(prep|test)\s*$/m.
    expect(egress).toContain('printf \'phase: %s\\n\' "$(live_phase)"');
    expect(egress).toContain("printf 'unknown'");
    expect(egress).toContain("grep -q 'accept'");
    expect(egress).not.toContain('PHASE_FILE');
    // A phase switch that did not take effect is an error, not a log line.
    expect(egress).toContain('[ "$(live_phase)" = "$next" ] || die');
  });

  it('restricts the proxy user to 80/443 and denies private space for it', () => {
    expect(egress).toContain('meta skuid "tinyproxy" ip daddr @private_v4 counter drop');
    expect(egress).toContain('meta skuid "tinyproxy" tcp dport { 80, 443 } accept');
    expect(egress).toContain('meta skuid "tinyproxy" counter drop');
  });

  it('validates the ruleset before loading it and persists it for clones', () => {
    expect(egress).toContain('nft -c -f "$tmp"');
    expect(egress).toContain('>/etc/nftables.conf');
  });

  it('prints a complete ruleset for a configured resolver and refuses an unconfigured one', () => {
    const printed = runShell('bash', [
      '-c',
      `NABATABLE_CI_RESOLVER=192.168.5.3 bash '${egressScript}' print`,
    ]);
    expect(printed.status).toBe(0);
    expect(printed.stdout).toContain('table inet nabatable_ci {');
    expect(printed.stdout).toContain('elements = { 192.168.5.3 }');
    expect(printed.stdout).toContain('chain job_to_proxy {');
    expect(printed.stdout).toContain(
      'ip saddr 10.90.0.0/24 ip daddr 10.90.0.1 tcp dport 8888 jump job_to_proxy',
    );
    expect(printed.stdout).toContain(
      'ip daddr 169.254.169.254 counter drop comment "metadata endpoint"',
    );
    expect(
      printed.stdout.match(/type filter hook (input|forward|output) priority -10; policy accept;/g),
    ).toHaveLength(3);

    const unconfigured = runShell('bash', [
      '-c',
      `NABATABLE_CI_RESOLVER=REPLACE_ME_RESOLVER bash '${egressScript}' print`,
    ]);
    expect(unconfigured.status).toBe(1);
    expect(unconfigured.stdout).toBe('');
    expect(unconfigured.stderr).toContain('unconfigured');

    const notAnAddress = runShell('bash', [
      '-c',
      `NABATABLE_CI_RESOLVER=dns.example bash '${egressScript}' print`,
    ]);
    expect(notAnAddress.status).toBe(1);
    expect(notAnAddress.stderr).toContain('not an IPv4 address');

    expect(runShell('bash', [egressScript, 'bogus']).status).toBe(2);
    // phase requires root; without it the script dies before touching nft.
    const phase = runShell('bash', [egressScript, 'phase', 'prep']);
    expect(phase.status).toBe(1);
    expect(phase.stderr).toContain('must run as root');
  });
});

describe('infra/local-ci/network/setup.sh', () => {
  it('creates the internal job network the executor joins and refuses placeholder proxy config', () => {
    expect(setup).toContain("JOB_NETWORK='nabatable-ci-jobs'");
    expect(setup).toContain("JOB_SUBNET='10.90.0.0/24'");
    expect(setup).toContain("JOB_GATEWAY='10.90.0.1'");
    expect(setup).toContain('--internal');
    expect(setup).toContain('enable_icc=false');
    expect(setup).toContain('com.docker.network.bridge.name=nbci-jobs');
    expect(setup).toMatch(/grep -q 'REPLACE_ME'[^\n]*&& \{/);
  });

  it('routes dockerd and apt through the loopback proxy and applies phase test', () => {
    expect(setup).toContain('Acquire::https::Proxy');
    expect(setup).toContain('HTTPS_PROXY=${PROXY_URL}');
    expect(setup).toContain('NO_PROXY=localhost,127.0.0.1,${REGISTRY_ALIAS}');
    expect(setup).toContain('"$CONF_DIR/egress.sh" apply');
    expect(setup).toContain('"$CONF_DIR/egress.sh" phase test');
    expect(setup).toContain('systemctl enable nftables');
  });
});
