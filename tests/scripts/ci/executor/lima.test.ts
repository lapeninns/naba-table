import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  EgressPhaseError,
  egressPhaseCommand,
  parseEgressPhase,
  setEgressPhase,
} from '@/scripts/ci/executor/lima/egress';
import {
  LimaImageDigestError,
  LimaJobError,
  limaInstanceName,
  planLima,
  renderLimaTemplate,
  withLimaInstance,
} from '@/scripts/ci/executor/lima/instance';

import {
  BASE_IMAGE_DIGEST,
  cleanupTempDirs,
  FakeRunner,
  makeTempDir,
  okResult,
  when,
} from './helpers';

import type { LimaConfig } from '@/scripts/ci/executor/config';

afterEach(cleanupTempDirs);

function limaConfig(root: string): LimaConfig {
  return {
    baseImagePath: path.join(root, 'base.img'),
    baseImageDigest: BASE_IMAGE_DIGEST,
    instancePrefix: 'nabatable-ci',
    cpus: 6,
    memoryGiB: 16,
    diskGiB: 120,
    guestSpoolDir: '/home/ci/spool',
    dockerContext: 'nabatable-ci',
    protectedDockerContexts: ['default', 'desktop-linux'],
    egressScript: '/etc/nabatable-ci/network/egress.sh',
  };
}

describe('withLimaInstance', () => {
  it('creates, starts, binds the context, runs the body and destroys the instance', async () => {
    const root = makeTempDir();
    const runner = new FakeRunner();
    const config = limaConfig(root);
    const input = {
      jobId: 'ci-main-000000000000-a1',
      config,
      jobDir: path.join(root, 'job'),
      limaHome: path.join(root, '.lima'),
    };
    const { value, destroy } = await withLimaInstance(
      input,
      {
        runner,
        pathEnv: '/usr/bin',
        digestFile: async () => BASE_IMAGE_DIGEST,
        dockerConfigDir: path.join(root, 'job', '.docker'),
      },
      async (handle) => {
        expect(handle.docker).toEqual({
          context: 'nabatable-ci',
          protectedContexts: ['default', 'desktop-linux'],
        });
        await handle.copyIn('/host/bundle', '/home/ci/spool/job.bundle');
        await handle.shell(['echo', 'hi'], 'echo');
        return 'done';
      },
    );
    expect(value).toBe('done');
    expect(destroy.failures).toEqual([]);
    const rendered = runner.rendered();
    const name = limaInstanceName(config, input.jobId);
    expect(rendered).toEqual([
      `limactl create --tty=false --name=${name} ${path.join(root, 'job', 'lima.yaml')}`,
      `limactl start --tty=false ${name}`,
      'docker context rm --force nabatable-ci',
      `docker context create nabatable-ci --docker host=unix://${path.join(root, '.lima', name, 'sock', 'docker.sock')}`,
      `limactl copy /host/bundle ${name}:/home/ci/spool/job.bundle`,
      `limactl shell --tty=false ${name} -- echo hi`,
      `limactl stop --force ${name}`,
      `limactl delete --force ${name}`,
      'docker context rm --force nabatable-ci',
    ]);
    expect(rendered.some((line) => line.includes('context use'))).toBe(false);
    expect(rendered.some((line) => line.includes('snapshot'))).toBe(false);
    for (const call of runner.calls) {
      expect(call.env?.DOCKER_CONFIG).toBe(path.join(root, 'job', '.docker'));
      expect(call.env?.LIMA_HOME).toBe(path.join(root, '.lima'));
    }
    const template = readFileSync(path.join(root, 'job', 'lima.yaml'), 'utf8');
    expect(template).toContain('mounts: []');
    expect(template).toContain(`digest: "${BASE_IMAGE_DIGEST}"`);
    expect(template).toContain('propagateProxyEnv: false');
    expect(template).toContain('ignore: true');
  });

  it('destroys the instance when the body fails and reports the cause', async () => {
    const root = makeTempDir();
    const runner = new FakeRunner();
    const config = limaConfig(root);
    const input = {
      jobId: 'ci-main-000000000000-a1',
      config,
      jobDir: path.join(root, 'job'),
      limaHome: path.join(root, '.lima'),
    };
    await expect(
      withLimaInstance(
        input,
        { runner, pathEnv: '/usr/bin', digestFile: async () => BASE_IMAGE_DIGEST },
        async () => {
          throw new Error('docker exploded');
        },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(LimaJobError);
      expect((error as LimaJobError).message).toBe('docker exploded');
      expect((error as LimaJobError).destroy.attempted).toEqual([
        'stop instance',
        'delete instance',
        'remove docker context',
      ]);
      return true;
    });
    expect(runner.find('limactl', 'delete', '--force').length).toBe(1);
    expect(runner.find('docker', 'context', 'rm').length).toBe(2);
  });

  it('destroys the instance when start fails and records cleanup failures', async () => {
    const root = makeTempDir();
    const runner = new FakeRunner([
      when('limactl', ['start'], okResult({ exitCode: 1, stderr: 'vz: boot failed' })),
      when('limactl', ['delete'], okResult({ exitCode: 1, stderr: 'busy' })),
    ]);
    const config = limaConfig(root);
    const input = {
      jobId: 'ci-main-000000000000-a1',
      config,
      jobDir: path.join(root, 'job'),
      limaHome: path.join(root, '.lima'),
    };
    const body = async () => 'never';
    let caught: unknown;
    try {
      await withLimaInstance(
        input,
        { runner, pathEnv: '/usr/bin', digestFile: async () => BASE_IMAGE_DIGEST },
        body,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LimaJobError);
    expect((caught as LimaJobError).message).toMatch(/start instance: exit 1/u);
    expect((caught as LimaJobError).destroy.failures).toEqual(['delete instance: exit 1']);
    expect(runner.find('limactl', 'stop').length).toBe(1);
  });

  it('refuses to create anything when the base image digest does not match', async () => {
    const root = makeTempDir();
    const runner = new FakeRunner();
    const config = limaConfig(root);
    const input = {
      jobId: 'ci-main-000000000000-a1',
      config,
      jobDir: path.join(root, 'job'),
      limaHome: path.join(root, '.lima'),
    };
    await expect(
      withLimaInstance(
        input,
        { runner, pathEnv: '/usr/bin', digestFile: async () => `sha256:${'0'.repeat(64)}` },
        async () => 'x',
      ),
    ).rejects.toBeInstanceOf(LimaImageDigestError);
    expect(runner.calls).toEqual([]);
    expect(existsSync(path.join(root, 'job', 'lima.yaml'))).toBe(false);
  });

  it('refuses to bind a protected docker context', async () => {
    const root = makeTempDir();
    const runner = new FakeRunner();
    const config = { ...limaConfig(root), dockerContext: 'default' };
    const input = {
      jobId: 'ci-main-000000000000-a1',
      config,
      jobDir: path.join(root, 'job'),
      limaHome: path.join(root, '.lima'),
    };
    await expect(
      withLimaInstance(
        input,
        { runner, pathEnv: '/usr/bin', digestFile: async () => BASE_IMAGE_DIGEST },
        async () => 'x',
      ),
    ).rejects.toThrow(/protected/u);
    expect(runner.calls).toEqual([]);
  });

  it('plans the same commands without executing', () => {
    const config = limaConfig('/root');
    const plan = planLima(
      { jobId: 'ci-main-000000000000-a1', config, jobDir: '/job', limaHome: '/lima' },
      '/spool/b.bundle',
    );
    expect(plan.map((step) => step.purpose)).toEqual([
      'verify base image digest',
      'create disposable instance (cold clone)',
      'start instance',
      'bind docker context to the instance socket',
      'copy bundle into guest',
      'destroy: stop instance',
      'destroy: delete instance',
      'destroy: remove docker context',
    ]);
    expect(renderLimaTemplate(config)).toContain('file:///root/base.img');
  });
});

describe('egress phase control', () => {
  it('builds sudo commands for the guest script and validates the path', () => {
    expect(egressPhaseCommand('/etc/nabatable-ci/network/egress.sh', 'prep')).toEqual([
      'sudo',
      '-n',
      '/etc/nabatable-ci/network/egress.sh',
      'phase',
      'prep',
    ]);
    expect(() => egressPhaseCommand('relative/egress.sh', 'test')).toThrow(EgressPhaseError);
    expect(() => egressPhaseCommand('/etc/../x.sh', 'test')).toThrow(EgressPhaseError);
    expect(() => egressPhaseCommand('/etc/x.sh; rm', 'test')).toThrow(EgressPhaseError);
  });

  it('parses the status output and refuses an unverified switch', async () => {
    expect(parseEgressPhase('phase: prep\ntable inet nabatable_ci {')).toBe('prep');
    expect(parseEgressPhase('phase: (not applied)')).toBeNull();
    const shells: string[][] = [];
    const guest = {
      shell: async (args: readonly string[]) => {
        shells.push([...args]);
        return args.includes('status') ? 'phase: prep\n' : '';
      },
    };
    await setEgressPhase(guest, '/etc/nabatable-ci/network/egress.sh', 'prep');
    expect(shells).toEqual([
      ['sudo', '-n', '/etc/nabatable-ci/network/egress.sh', 'phase', 'prep'],
      ['sudo', '-n', '/etc/nabatable-ci/network/egress.sh', 'status'],
    ]);
    await expect(
      setEgressPhase(guest, '/etc/nabatable-ci/network/egress.sh', 'test'),
    ).rejects.toThrow(/guest egress phase is prep after requesting test/u);
  });
});
