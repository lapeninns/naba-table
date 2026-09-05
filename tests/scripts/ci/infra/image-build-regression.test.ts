import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { infraRoot, readInfraFile } from './helpers';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), 'nabatable-image-regression-'));
  roots.push(root);
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const log = path.join(root, 'calls');
  writeFileSync(log, '');
  const tool = (name: string, body: string) => {
    const file = path.join(bin, name);
    writeFileSync(file, `#!/bin/sh\nset -eu\n${body}\n`);
    chmodSync(file, 0o755);
  };
  const env = { HOME: root, PATH: `${bin}:/usr/bin:/bin`, CALL_LOG: log, TEST_ROOT: root };
  return { root, bin, log, tool, env };
}

function runBuilder(
  failure: 'build' | 'push' | 'phase-test' | 'cleanup' | 'none',
  disks: readonly ('disk' | 'diffdisk')[] = [],
) {
  const f = sandbox();
  cpSync(infraRoot, path.join(f.root, 'infra/local-ci'), { recursive: true });
  writeFileSync(path.join(f.root, 'infra/local-ci/bin/render-lima.sh'), '#!/bin/sh\ntouch "$2"\n');
  writeFileSync(
    path.join(f.root, 'infra/local-ci/bin/sync-vm-config.sh'),
    '#!/bin/sh\necho guest-config >> "$CALL_LOG"\n',
  );
  f.tool('id', 'if [ "$1" = -un ]; then echo nabatable-ci; else echo 501; fi');
  const instanceDir = path.join(f.root, '.lima/nabatable-ci-golden');
  mkdirSync(instanceDir, { recursive: true });
  for (const disk of disks) writeFileSync(path.join(instanceDir, disk), `synthetic-${disk}`);
  f.tool('qemu-img', 'echo "qemu-img $*" >> "$CALL_LOG"; /bin/cp "$5" "$6"');
  f.tool(
    'docker',
    `
    echo "docker $*" >> "$CALL_LOG"
    case "$*" in
      "build "*) [ "$TEST_FAILURE" != build ] || exit 42 ;;
      "push "*) [ "$TEST_FAILURE" != push ] || exit 43 ;;
      "rm --force --volumes ci-registry") [ "$TEST_FAILURE" != cleanup ] || exit 45 ;;
      "image inspect "*) echo "ci-registry.local/nabatable/ci-job@sha256:$(printf '%064d' 0)" ;;
    esac
  `,
  );
  f.tool(
    'egress',
    `
    echo "egress $*" >> "$CALL_LOG"
    if [ "$TEST_FAILURE" = phase-test ] && [ "$*" = 'phase test' ]; then exit 44; fi
  `,
  );
  // Execute only the captured guest shell payload, with every absolute guest
  // path redirected into this fixture. No real limactl, sudo, Docker or VM runs.
  const lima = path.join(f.bin, 'limactl');
  writeFileSync(
    lima,
    `#!${process.execPath}\n
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, 'lima ' + args.slice(0, 3).join(' ') + '\\n');
if (args[0] === 'shell' && args[3] === 'sudo') {
  const script = args[6]
    .replaceAll('/etc/nabatable-ci/network/egress.sh', process.env.TEST_ROOT + '/bin/egress')
    .replaceAll('/tmp/ci-job', process.env.TEST_ROOT + '/guest-ci-job');
  const result = spawnSync('/bin/sh', ['-c', script], {env: process.env, encoding: 'utf8'});
  if ((result.stdout || '').includes('ci-registry.local/nabatable/ci-job@sha256:'))
    fs.appendFileSync(process.env.CALL_LOG, 'guest-digest-produced\\n');
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exit(result.status ?? 99);
}
`,
  );
  chmodSync(lima, 0o755);
  const result = spawnSync(
    '/bin/sh',
    [path.join(f.root, 'infra/local-ci/bin/build-base-image.sh')],
    {
      env: {
        ...f.env,
        TEST_FAILURE: failure,
        NABATABLE_CI_NODE_IMAGE_DIGEST: `sha256:${'a'.repeat(64)}`,
        NABATABLE_CI_REGISTRY_IMAGE_DIGEST: `sha256:${'b'.repeat(64)}`,
        TMPDIR: f.root,
      },
      encoding: 'utf8',
      timeout: 15_000,
    },
  );
  return { result, calls: readFileSync(f.log, 'utf8'), instanceDir };
}

describe('golden image build recovery', () => {
  it.each(['build', 'push', 'phase-test', 'cleanup'] as const)(
    'restores restricted egress and removes the registry after %s fails',
    (failure) => {
      const { result, calls } = runBuilder(failure);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).not.toBe(0);
      expect(calls).toContain('egress phase prep');
      expect(calls).toContain('egress phase test');
      expect(calls).toContain('docker rm --force --volumes ci-registry');
      expect(calls).not.toContain('lima stop');
      expect(result.stderr).toContain('guest image build or cleanup failed');
      if (failure === 'cleanup') expect(calls).toContain('guest-digest-produced');
      expect(calls).not.toContain('qemu-img convert');
      expect(calls.indexOf('lima start')).toBeLessThan(calls.indexOf('guest-config'));
      expect(calls.indexOf('guest-config')).toBeLessThan(calls.indexOf('docker run'));
      expect(calls).toContain('docker build --network=nabatable-ci-jobs');
      expect(calls).toContain('HTTP_PROXY=http://10.90.0.1:8888');
      const build = calls.split('\n').find((line) => line.startsWith('docker build')) ?? '';
      expect(build).not.toContain('--network=host');
      expect(build).not.toContain('--userns=host');
      const registry = calls.split('\n').find((line) => line.startsWith('docker run')) ?? '';
      expect(registry).toContain('--network=host --userns=host');
      expect(registry).toContain('REGISTRY_HTTP_ADDR=127.0.0.1:80');
    },
    20_000,
  );
});

describe('golden image disk export', () => {
  it.each([
    { disks: ['disk'] as const, selected: 'disk' },
    { disks: ['disk', 'diffdisk'] as const, selected: 'disk' },
    { disks: ['diffdisk'] as const, selected: 'diffdisk' },
  ])(
    'exports $selected from available $disks after stopping the guest',
    ({ disks, selected }) => {
      const { result, calls, instanceDir } = runBuilder('none', disks);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(calls).toContain(`qemu-img convert -O qcow2 -c ${instanceDir}/${selected} `);
      expect(calls.indexOf('lima stop')).toBeLessThan(calls.indexOf('qemu-img convert'));
      expect(calls.indexOf('qemu-img convert')).toBeLessThan(calls.indexOf('lima delete'));
      const outputPath = /NABATABLE_CI_BASE_IMAGE_PATH=(.+)/.exec(result.stdout)?.[1];
      expect(outputPath).toBeDefined();
      expect(readFileSync(outputPath!, 'utf8')).toBe(`synthetic-${selected}`);
    },
    20_000,
  );

  it('fails without exporting or deleting the golden instance when both disk names are missing', () => {
    const { result, calls } = runBuilder('none');
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('disk');
    expect(calls).toContain('lima stop');
    expect(calls).not.toContain('qemu-img convert');
    expect(calls).not.toContain('lima delete');
  }, 20_000);
});

describe('golden image daemon provisioning', () => {
  it('restarts the daemon after writing userns configuration, before completing provisioning', () => {
    const f = sandbox();
    for (const directory of ['etc/apt/sources.list.d', 'etc/sysctl.d', 'home'])
      mkdirSync(path.join(f.root, directory), { recursive: true });
    writeFileSync(path.join(f.root, 'etc/os-release'), 'VERSION_CODENAME=noble\n');
    writeFileSync(path.join(f.root, 'etc/hosts'), '127.0.0.1 localhost\n');
    f.tool('curl', 'while [ "$1" != -o ]; do shift; done; shift; : > "$1"');
    f.tool('dpkg', 'echo arm64');
    // Only mkdir is needed from install in this provisioning script; all target
    // paths are redirected before execution. Ownership/group changes are stubbed.
    f.tool(
      'install',
      'for arg in "$@"; do case "$arg" in "$TEST_ROOT"/*) /bin/mkdir -p "$arg";; esac; done',
    );
    for (const tool of ['apt-get', 'apt-mark', 'modprobe', 'sysctl', 'usermod'])
      f.tool(tool, `echo '${tool}' "$@" >> "$CALL_LOG"`);
    f.tool(
      'systemctl',
      `
      echo "systemctl $*" >> "$CALL_LOG"
      if [ "$*" = 'restart docker' ]; then
        test -s "$TEST_ROOT/etc/docker/daemon.json"
        grep -q '"userns-remap": "default"' "$TEST_ROOT/etc/docker/daemon.json"
        echo configured-daemon-restarted >> "$CALL_LOG"
      fi
    `,
    );
    const template = parse(readInfraFile('lima/nabatable-ci.yaml')) as {
      provision: { mode: string; script: string }[];
    };
    const provision = template.provision.find((step) => step.mode === 'system');
    expect(provision).toBeDefined();
    const script = provision!.script
      .replaceAll('/etc/', `${f.root}/etc/`)
      .replaceAll('/home/ci', `${f.root}/home/ci`);
    const result = spawnSync('/bin/bash', ['-c', script], {
      env: { ...f.env, LIMA_CIDATA_USER: 'synthetic-ci-user' },
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(f.log, 'utf8');
    expect(calls).toContain('configured-daemon-restarted');
    expect(calls.indexOf('apt-get install')).toBeLessThan(
      calls.indexOf('systemctl restart docker'),
    );
    expect(calls.indexOf('configured-daemon-restarted')).toBeLessThan(calls.indexOf('usermod'));
  }, 20_000);
});
