import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { infraRoot, readInfraFile, runShell } from './helpers';

type PortForward = {
  readonly guestIP?: string;
  readonly guestPortRange?: readonly number[];
  readonly ignore?: boolean;
};

type ProvisionStep = { readonly mode: string; readonly script: string };

type LimaTemplate = {
  readonly vmType: string;
  readonly os: string;
  readonly arch: string;
  readonly images: readonly { location: string; arch: string; digest: string }[];
  readonly cpus: number;
  readonly memory: string;
  readonly disk: string;
  readonly mounts: readonly unknown[];
  readonly ssh: {
    readonly forwardAgent: boolean;
    readonly forwardX11: boolean;
    readonly forwardX11Trusted: boolean;
    readonly loadDotSSHPubKeys: boolean;
  };
  readonly portForwards: readonly PortForward[];
  readonly propagateProxyEnv: boolean;
  readonly env: Record<string, unknown>;
  readonly containerd: { readonly system: boolean; readonly user: boolean };
  readonly rosetta: { readonly enabled: boolean };
  readonly provision: readonly ProvisionStep[];
  readonly probes: readonly { readonly hint: string }[];
};

type OperatingConfig = {
  readonly vm: {
    readonly goldenName: string;
    readonly disk: string;
    readonly guestSpoolDir: string;
    readonly modes: Record<string, { readonly cpus: number; readonly memory: string }>;
  };
  readonly job: {
    readonly image: { readonly localRegistryAlias: string };
    readonly network: { readonly containerPool: string };
  };
};

const templateSource = readInfraFile('lima/nabatable-ci.yaml');
const template = parse(templateSource) as LimaTemplate;
const operating = JSON.parse(readInfraFile('operating.json')) as OperatingConfig;

describe('infra/local-ci/lima/nabatable-ci.yaml', () => {
  it('targets the Virtualization.framework driver on Ubuntu arm64 with a digest-pinned image', () => {
    expect(template.vmType).toBe('vz');
    expect(template.os).toBe('Linux');
    expect(template.arch).toBe('aarch64');
    expect(template.images).toHaveLength(1);
    const [image] = template.images;
    expect(image.arch).toBe('aarch64');
    expect(image.location).toContain('ubuntu-24.04-server-cloudimg-arm64.img');
    expect(image.location.startsWith('https://cloud-images.ubuntu.com/releases/noble/')).toBe(true);
    expect(image.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(image.location).toMatch(/release-\d{8}\//u);
  });

  it('shares nothing with the host: no mounts, no port forwards, no agent/X11, no env', () => {
    expect(template.mounts).toEqual([]);
    expect(template.ssh.forwardAgent).toBe(false);
    expect(template.ssh.forwardX11).toBe(false);
    expect(template.ssh.forwardX11Trusted).toBe(false);
    expect(template.ssh.loadDotSSHPubKeys).toBe(false);
    expect(template.propagateProxyEnv).toBe(false);
    expect(template.env).toEqual({});

    // Exactly one rule, and it ignores the whole guest port range.
    expect(template.portForwards).toHaveLength(1);
    const [rule] = template.portForwards;
    expect(rule.ignore).toBe(true);
    expect(rule.guestPortRange).toEqual([1, 65535]);
    expect(rule.guestIP).toBe('0.0.0.0');
  });

  it('disables Lima containerd/nerdctl and Rosetta', () => {
    expect(template.containerd).toEqual({ system: false, user: false });
    expect(template.rosetta.enabled).toBe(false);
  });

  it('uses the normal-mode allocation and the 120GiB disk from operating.json', () => {
    expect(template.cpus).toBe(operating.vm.modes.normal.cpus);
    expect(template.memory).toBe(operating.vm.modes.normal.memory);
    expect(template.disk).toBe('120GiB');
    expect(operating.vm.disk).toBe(template.disk);
    expect(operating.vm.modes.normal).toEqual({ cpus: 6, memory: '16GiB' });
    expect(operating.vm.modes.dedicated).toEqual({ cpus: 10, memory: '24GiB' });
  });

  it('provisions a pinned Docker Engine and refuses the version placeholder', () => {
    const system = template.provision.find((step) => step.mode === 'system');
    expect(system).toBeDefined();
    const script = system?.script ?? '';
    expect(script).toContain("DOCKER_CE_VERSION='5:29.7.2-1~ubuntu.24.04~noble'");
    expect(script).toContain('*REPLACE_ME*)');
    expect(script).toContain('exit 1');
    expect(script).toContain('"docker-ce=${DOCKER_CE_VERSION}"');
    expect(script).toContain('apt-mark hold docker-ce');
    expect(script).not.toMatch(/apt-get install[^\n]*docker-ce\s/);
    expect(script).not.toMatch(/get\.docker\.com/);
    expect(script).toContain('"userns-remap": "default"');
    expect(script).toContain('"no-new-privileges": true');
    expect(script).toContain('net.ipv6.conf.all.disable_ipv6 = 1');
    expect(script).not.toContain('nerdctl');
  });

  it('bakes the executor contract into the golden image: container pool, registry alias, spool dir', () => {
    const script = template.provision.find((step) => step.mode === 'system')?.script ?? '';
    const pool = operating.job.network.containerPool;
    expect(script).toContain(`"default-address-pools": [{ "base": "${pool}", "size": 24 }]`);
    // The job network itself is created by network/setup.sh (docker must be up).
    expect(script).not.toMatch(/docker network create/);
    expect(script).toContain(
      `"insecure-registries": ["${operating.job.image.localRegistryAlias}"]`,
    );
    expect(script).toContain(`127.0.0.1 ${operating.job.image.localRegistryAlias}`);
    expect(script).toMatch(
      new RegExp(
        `install -d -m 0750 -o "\\$\\{LIMA_CIDATA_USER\\}" -g docker /home/ci ${operating.vm.guestSpoolDir}`,
      ),
    );
    expect(script).toContain('usermod -aG docker "${LIMA_CIDATA_USER}"');
  });

  it('is the golden image builder, never a job instance', () => {
    expect(templateSource).toContain('golden');
    expect(template.probes[0]?.hint).toContain(operating.vm.goldenName);
    // The `nabatable-ci` docker context is created on the host by bin/install.sh
    // and rebound by the executor; the guest must not try to reach back.
    expect(templateSource).not.toMatch(/docker context create/);
  });
});

describe('infra/local-ci/bin/render-lima.sh', () => {
  const script = path.join(infraRoot, 'bin/render-lima.sh');

  it('renders the dedicated mode with 10 vCPU / 24GiB and keeps everything else identical', () => {
    const rendered = runShell('sh', [script, 'dedicated']);
    expect(rendered.status).toBe(0);
    const dedicated = parse(rendered.stdout) as LimaTemplate;
    expect(dedicated.cpus).toBe(10);
    expect(dedicated.memory).toBe('24GiB');
    expect({ ...dedicated, cpus: template.cpus, memory: template.memory }).toEqual(template);
  });

  it('renders the normal mode byte-for-byte equal to the source template', () => {
    const rendered = runShell('sh', [script, 'normal']);
    expect(rendered.status).toBe(0);
    expect(rendered.stdout).toBe(templateSource);
  });

  it('rejects unknown modes', () => {
    const rendered = runShell('sh', [script, 'huge']);
    expect(rendered.status).toBe(2);
    expect(rendered.stderr).toContain('usage');
  });
});

describe('infra/local-ci/bin/vm-mode.sh', () => {
  const script = path.join(infraRoot, 'bin/vm-mode.sh');

  it('resolves both modes to the executor environment variables', () => {
    const normal = runShell('sh', [script, 'normal']);
    expect(normal.status).toBe(0);
    expect(normal.stdout).toBe(
      'NABATABLE_CI_LIMA_CPUS=6\nNABATABLE_CI_LIMA_MEMORY_GIB=16\nNABATABLE_CI_LIMA_DISK_GIB=120\n',
    );
    const dedicated = runShell('sh', [script, 'dedicated']);
    expect(dedicated.status).toBe(0);
    expect(dedicated.stdout).toBe(
      'NABATABLE_CI_LIMA_CPUS=10\nNABATABLE_CI_LIMA_MEMORY_GIB=24\nNABATABLE_CI_LIMA_DISK_GIB=120\n',
    );
  });

  it('rejects unknown modes and unreadable operating files', () => {
    expect(runShell('sh', [script, 'huge']).status).toBe(2);
    expect(runShell('sh', [script]).status).toBe(2);
    const missing = runShell('sh', [
      '-c',
      `NABATABLE_CI_OPERATING_JSON=/nonexistent sh '${script}' normal`,
    ]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('not readable');
  });
});
