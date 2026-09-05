import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveExecutorProfile } from '@/scripts/ci/executor/profiles';
import { classifyStep, runSupervisor, stepLogPaths } from '@/scripts/ci/executor/supervisor/run';

import { cleanupTempDirs, FakeRunner, mainRequest, makeTempDir, okResult, when } from './helpers';

import type { CommandSpec } from '@/scripts/ci/executor/runner';
import type { ExecutorProfile, StopSignal } from '@/scripts/ci/executor/types';

afterEach(cleanupTempDirs);

const docker = { context: 'nabatable-ci', protectedContexts: ['default'] };

/** A small profile: prepare + two suites, one step each, derived from the real main profile shape. */
function smallProfile(): ExecutorProfile {
  const real = resolveExecutorProfile({
    request: mainRequest(),
    changedPaths: null,
    allocation: null,
  });
  const prepare = real.steps[0];
  const lint = { ...real.steps.find((step) => step.id === 'lint')!, timeoutMs: 10_000 };
  const test = { ...real.steps.find((step) => step.id === 'test:ci')!, timeoutMs: 10_000 };
  return {
    ...real,
    steps: [prepare, lint, test],
    suites: [
      real.suites[0],
      {
        id: 'fast-static-gates',
        displayName: 'Fast static gates',
        kind: 'static',
        stepIds: ['lint'],
        hardLimitMs: 60_000,
        p95BudgetMs: 30_000,
      },
      {
        id: 'coverage-and-performance-evidence',
        displayName: 'Coverage',
        kind: 'vitest',
        stepIds: ['test:ci'],
        hardLimitMs: 60_000,
        p95BudgetMs: 30_000,
      },
    ],
    skippedSuites: [],
    profileTimeoutMs: 600_000,
  };
}

function stepOf(spec: CommandSpec): string {
  // docker exec argv ends with the container followed by the step command.
  const index = spec.args.indexOf('ci-x-job');
  return spec.args.slice(index + 1).join(' ');
}

function baseInput(
  profile: ExecutorProfile,
  logDir: string,
  extra: Partial<Parameters<typeof runSupervisor>[0]> = {},
) {
  return {
    profile,
    docker,
    container: 'ci-x-job',
    user: '10001:10001',
    dockerEnv: { PATH: '/usr/bin', DOCKER_CONFIG: '/job/.docker' },
    logDir,
    prepareEnv: {
      HTTP_PROXY: 'http://10.90.0.1:8888',
      HTTPS_PROXY: 'http://10.90.0.1:8888',
      NO_PROXY: '',
    },
    ...extra,
  };
}

describe('classifyStep', () => {
  it('classifies timeout, oom, crash, storage exhaustion, tooling errors and plain failures', () => {
    expect(classifyStep(okResult({ timedOut: true, exitCode: null }), null)).toBe('timeout');
    expect(classifyStep(okResult(), null)).toBe('passed');
    expect(classifyStep(okResult({ exitCode: 137 }), null)).toBe('oom');
    expect(classifyStep(okResult({ exitCode: 137 }), true)).toBe('oom');
    expect(classifyStep(okResult({ exitCode: 137 }), false)).toBe('crashed');
    expect(classifyStep(okResult({ exitCode: null, signal: 'SIGKILL' }), null)).toBe('oom');
    expect(classifyStep(okResult({ exitCode: 139 }), null)).toBe('crashed');
    expect(classifyStep(okResult({ exitCode: 134 }), null)).toBe('crashed');
    expect(
      classifyStep(okResult({ exitCode: 1, stderr: 'ENOSPC: no space left on device' }), null),
    ).toBe('storage-exhausted');
    expect(classifyStep(okResult({ exitCode: 126 }), null)).toBe('infrastructure-error');
    expect(classifyStep(okResult({ exitCode: 1 }), null)).toBe('failed');
  });
});

describe('runSupervisor', () => {
  it('runs every step in order, switches phases once each and passes', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const profile = smallProfile();
    const phases: string[] = [];
    const runner = new FakeRunner([
      when('docker', ['exec'], (spec) =>
        okResult({ stdout: `ran ${stepOf(spec)}\n`, durationMs: 5 }),
      ),
    ]);
    const result = await runSupervisor(
      baseInput(profile, logDir, { onPhase: async (phase) => void phases.push(phase) }),
      { runner },
    );
    expect(result.outcome).toBe('passed');
    expect(result.profile).toBe('main');
    expect(result.stopSignal).toBe('continue');
    expect(result.steps.map((step) => [step.id, step.outcome])).toEqual([
      ['prepare:install', 'passed'],
      ['lint', 'passed'],
      ['test:ci', 'passed'],
    ]);
    expect(phases).toEqual(['prepare', 'test']);
    const execs = runner.find('docker', 'exec');
    expect(execs.map(stepOf)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm lint',
      'pnpm test:ci',
    ]);
    // Proxy env reaches the prepare step only.
    expect(execs[0].args).toContain('HTTP_PROXY=http://10.90.0.1:8888');
    expect(execs[0].args).toContain('NO_PROXY=');
    expect(execs[1].args.some((arg) => arg.startsWith('HTTP_PROXY='))).toBe(false);
    for (const call of runner.calls) {
      expect(call.env).toEqual({ PATH: '/usr/bin', DOCKER_CONFIG: '/job/.docker' });
    }
    expect(readFileSync(stepLogPaths(logDir, 'test:ci').stdout, 'utf8')).toBe('ran pnpm test:ci\n');
  });

  it('halts after a failing step and marks the rest not-run', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const runner = new FakeRunner([
      when('docker', ['exec', 'pnpm', 'lint'], okResult({ exitCode: 1, stderr: 'lint failed\n' })),
    ]);
    const result = await runSupervisor(baseInput(smallProfile(), logDir), { runner });
    expect(result.outcome).toBe('failed');
    expect(result.reason).toBe('step lint failed');
    expect(result.steps.map((step) => step.outcome)).toEqual(['passed', 'failed', 'not-run']);
    expect(runner.find('docker', 'exec', 'pnpm', 'test:ci')).toEqual([]);
    expect(readFileSync(stepLogPaths(logDir, 'lint').stderr, 'utf8')).toBe('lint failed\n');
  });

  it('classifies a timed-out step, kills the container and stops', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const runner = new FakeRunner([
      when(
        'docker',
        ['exec', 'pnpm', 'lint'],
        okResult({ exitCode: null, timedOut: true, durationMs: 10_000 }),
      ),
    ]);
    const result = await runSupervisor(baseInput(smallProfile(), logDir), { runner });
    expect(result.outcome).toBe('timeout');
    expect(result.steps[1]).toMatchObject({ id: 'lint', outcome: 'timeout', timedOut: true });
    expect(runner.find('docker', 'kill', 'ci-x-job').length).toBe(1);
    // The per-step timeout handed to the runner is the step's own limit.
    expect(runner.find('docker', 'exec', 'pnpm', 'lint')[0].timeoutMs).toBe(10_000);
  });

  it('detects OOM through the inspect probe on exit 137', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const runner = new FakeRunner([
      when('docker', ['exec', 'pnpm', 'test:ci'], okResult({ exitCode: 137 })),
    ]);
    const oom = await runSupervisor(
      baseInput(smallProfile(), logDir, { oomProbe: async () => true }),
      { runner },
    );
    expect(oom.outcome).toBe('oom');
    const crashed = await runSupervisor(
      baseInput(smallProfile(), path.join(makeTempDir(), 'logs'), { oomProbe: async () => false }),
      {
        runner: new FakeRunner([
          when('docker', ['exec', 'pnpm', 'test:ci'], okResult({ exitCode: 137 })),
        ]),
      },
    );
    expect(crashed.outcome).toBe('crashed');
  });

  it('classifies crashes and storage exhaustion', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const segv = await runSupervisor(baseInput(smallProfile(), logDir), {
      runner: new FakeRunner([
        when('docker', ['exec', 'pnpm', 'lint'], okResult({ exitCode: 139 })),
      ]),
    });
    expect(segv.outcome).toBe('crashed');
    const enospc = await runSupervisor(
      baseInput(smallProfile(), path.join(makeTempDir(), 'logs')),
      {
        runner: new FakeRunner([
          when(
            'docker',
            ['exec', 'pnpm', 'lint'],
            okResult({ exitCode: 1, stderr: 'Error: ENOSPC: no space left on device, write' }),
          ),
        ]),
      },
    );
    expect(enospc.outcome).toBe('storage-exhausted');
  });

  it('honours controller cancel/preempt only at suite boundaries', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    let signal: StopSignal = 'continue';
    const runner = new FakeRunner([
      when('docker', ['exec', 'pnpm', 'lint'], () => {
        signal = 'preempt';
        return okResult();
      }),
    ]);
    const result = await runSupervisor(
      baseInput(smallProfile(), logDir, { stopSignal: () => signal }),
      { runner },
    );
    expect(result.outcome).toBe('cancelled');
    expect(result.stopSignal).toBe('preempt');
    expect(result.steps.map((step) => step.outcome)).toEqual(['passed', 'passed', 'cancelled']);
    expect(runner.find('docker', 'exec', 'pnpm', 'test:ci')).toEqual([]);
  });

  it('aborts with an infrastructure error when the test phase switch fails, before running tests', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const runner = new FakeRunner();
    const result = await runSupervisor(
      baseInput(smallProfile(), logDir, {
        onPhase: async (phase) => {
          if (phase === 'test') throw new Error('nft unavailable');
        },
      }),
      { runner },
    );
    expect(result.outcome).toBe('infrastructure-error');
    expect(result.reason).toMatch(/entering phase test failed: nft unavailable/u);
    expect(result.steps.map((step) => step.outcome)).toEqual(['passed', 'not-run', 'not-run']);
    expect(runner.find('docker', 'exec', 'pnpm', 'lint')).toEqual([]);
  });

  it('enforces the suite hard limit and the profile hard limit', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    let nowMs = 0;
    const now = () => new Date(nowMs);
    const runner = new FakeRunner([
      when('docker', ['exec'], () => {
        nowMs += 60_000;
        return okResult({ durationMs: 60_000 });
      }),
    ]);
    const profile = smallProfile();
    const twoStepSuite: ExecutorProfile = {
      ...profile,
      steps: [
        profile.steps[0],
        profile.steps[1],
        { ...profile.steps[2], suiteId: 'fast-static-gates' },
      ],
      suites: [
        profile.suites[0],
        { ...profile.suites[1], stepIds: ['lint', 'test:ci'], hardLimitMs: 60_000 },
      ],
    };
    const result = await runSupervisor(baseInput(twoStepSuite, logDir), { runner, now });
    // prepare (60s) passes; lint (60s) exhausts the 60s suite limit; test:ci cannot start.
    expect(result.outcome).toBe('timeout');
    expect(result.reason).toBe('suite fast-static-gates exceeded its hard limit');
    expect(result.steps[2]).toMatchObject({ id: 'test:ci', outcome: 'timeout', timedOut: true });

    nowMs = 0;
    const tight = { ...smallProfile(), profileTimeoutMs: 50_000 };
    const profileResult = await runSupervisor(baseInput(tight, path.join(makeTempDir(), 'logs')), {
      runner: new FakeRunner([
        when('docker', ['exec'], () => {
          nowMs += 60_000;
          return okResult({ durationMs: 60_000 });
        }),
      ]),
      now,
    });
    expect(profileResult.outcome).toBe('timeout');
    expect(profileResult.reason).toBe('profile exceeded its hard limit');
  });

  it('bounds log files and records truncation', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const runner = new FakeRunner([
      when('docker', ['exec'], (spec) => {
        spec.onStdout?.(Buffer.alloc(4096, 0x61));
        return okResult({ stdoutTruncated: true });
      }),
    ]);
    const result = await runSupervisor(baseInput(smallProfile(), logDir, { maxLogBytes: 100 }), {
      runner,
    });
    const log = readFileSync(stepLogPaths(logDir, 'lint').stdout, 'utf8');
    expect(log.length).toBeLessThan(200);
    expect(log).toContain('[log truncated at 100 bytes]');
    expect(result.steps[1].stdoutTruncated).toBe(true);
    expect(existsSync(stepLogPaths(logDir, 'prepare:install').stderr)).toBe(true);
  });

  it('records the profile fixed before start regardless of container output', async () => {
    const logDir = path.join(makeTempDir(), 'logs');
    const runner = new FakeRunner([
      when('docker', ['exec'], okResult({ stdout: '{"profile":"nightly","outcome":"passed"}\n' })),
    ]);
    const result = await runSupervisor(baseInput(smallProfile(), logDir), { runner });
    expect(result.profile).toBe('main');
    expect(result.profileTimeoutMs).toBe(600_000);
  });
});
