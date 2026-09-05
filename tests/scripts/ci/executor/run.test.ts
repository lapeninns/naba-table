import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { CiResultSchema } from '@/scripts/ci/contracts/result';
import { validateWith } from '@/scripts/ci/contracts/validation';
import { ExecutorUnconfiguredError } from '@/scripts/ci/executor/config';
import { CiRequestError } from '@/scripts/ci/executor/request';
import {
  executeRequest,
  ExecutorFailure,
  ExecutorRefusalError,
  renderDryRunPlan,
} from '@/scripts/ci/executor/run';
import { SpoolMergeConflictError } from '@/scripts/ci/executor/spool/bundle';

import {
  argsContain,
  BASE_IMAGE_DIGEST,
  cleanupTempDirs,
  configuredEnv,
  COVERAGE_SUMMARY,
  FakeRunner,
  IMAGE_DIGEST,
  JUNIT_XML,
  mainRequest,
  okResult,
  prRequest,
  repositoryRoot,
  SHA_BASE,
  SHA_HEAD,
  when,
  type RunnerRule,
} from './helpers';

import type { FetchLike } from '@/scripts/ci/executor/r2/upload';
import type { CommandSpec } from '@/scripts/ci/executor/runner';

afterEach(cleanupTempDirs);

const NOW = new Date('2026-09-04T10:00:00Z');

/** Everything a successful main-profile run needs from git, limactl and docker. */
function happyRules(options: { failStep?: string; failDockerRun?: boolean } = {}): RunnerRule[] {
  let phase: 'prep' | 'test' = 'test';
  const execStep = (spec: CommandSpec): string => {
    const container = spec.args.findIndex((arg) => arg.endsWith('-job'));
    return spec.args.slice(container + 1).join(' ');
  };
  return [
    // git spool
    when('git', ['cat-file', '-t'], okResult({ stdout: 'commit\n' })),
    when('git', ['bundle', 'list-heads'], (spec) => {
      const bundle = spec.args[spec.args.length - 1];
      const jobId = path.basename(bundle, '.bundle');
      return okResult({
        stdout: [
          `${SHA_HEAD} refs/ci/${jobId}/head`,
          `${SHA_BASE} refs/ci/${jobId}/base`,
          `${SHA_HEAD} refs/ci/${jobId}/tested`,
        ].join('\n'),
      });
    }),
    when('git', ['bundle', 'create'], (spec) => {
      const target = spec.args[spec.args.indexOf('create') + 2];
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'bundle-bytes');
      return okResult();
    }),
    when('git', ['diff', '--name-only'], okResult({ stdout: 'src/app/page.tsx\0' })),
    // guest egress phase control
    when(
      'limactl',
      ['shell', 'sudo', '-n', '/etc/nabatable-ci/network/egress.sh', 'phase'],
      (spec) => {
        phase = spec.args[spec.args.length - 1] as 'prep' | 'test';
        return okResult();
      },
    ),
    when('limactl', ['shell', 'sudo', '-n', '/etc/nabatable-ci/network/egress.sh', 'status'], () =>
      okResult({ stdout: `phase: ${phase}\n` }),
    ),
    // docker
    when('docker', ['network', 'inspect'], okResult({ stdout: 'true\n' })),
    when(
      'docker',
      ['run'],
      okResult({
        exitCode: options.failDockerRun ? 125 : 0,
        stderr: options.failDockerRun ? 'no such image' : '',
      }),
    ),
    when('docker', ['exec', 'git', 'rev-parse', 'HEAD'], okResult({ stdout: `${SHA_HEAD}\n` })),
    when('docker', ['exec', 'node', '--version'], okResult({ stdout: 'v22.23.1\n' })),
    when('docker', ['exec', 'pnpm', '--version'], okResult({ stdout: '10.34.5\n' })),
    when('docker', ['exec'], (spec) => {
      const step = execStep(spec);
      if (options.failStep && step === options.failStep) {
        return okResult({ exitCode: 1, stderr: `${step} failed\n` });
      }
      return okResult({ stdout: `ran ${step}\n` });
    }),
    when('docker', ['cp'], (spec) => {
      const target = spec.args[spec.args.length - 1];
      const source = spec.args[spec.args.length - 2];
      if (source.endsWith(':/workspace/coverage')) {
        mkdirSync(target, { recursive: true });
        writeFileSync(path.join(target, 'coverage-summary.json'), COVERAGE_SUMMARY);
        return okResult();
      }
      if (source.endsWith(':/workspace/test-results')) {
        mkdirSync(path.join(target, 'vitest'), { recursive: true });
        writeFileSync(path.join(target, 'vitest', 'junit.xml'), JUNIT_XML);
        return okResult();
      }
      return okResult({ exitCode: 1, stderr: 'no such path' });
    }),
  ];
}

interface Captured {
  readonly method: string;
  readonly url: string;
}

function fakeFetch(captured: Captured[]): FetchLike {
  const stored = new Map<string, Uint8Array>();
  return async (url, init) => {
    captured.push({ method: init.method ?? 'GET', url });
    if (init.method === 'PUT') {
      stored.set(url, init.body as Uint8Array);
      return new Response(null, { status: 200 });
    }
    const object = stored.get(url);
    if (!object) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 200,
      headers: {
        'content-length': String(object.length),
        'x-amz-meta-sha256': createHash('sha256').update(object).digest('hex'),
      },
    });
  };
}

function deps(env: Record<string, string>, runner: FakeRunner, captured: Captured[] = []) {
  return {
    runner,
    fetch: fakeFetch(captured),
    env,
    repoRoot: repositoryRoot,
    now: () => NOW,
    digestFile: async () => BASE_IMAGE_DIGEST,
  };
}

describe('renderDryRunPlan', () => {
  it('prints the whole plan without touching the runner, the network or disk', () => {
    const fixture = configuredEnv();
    const plan = renderDryRunPlan({
      rawRequest: mainRequest(),
      deps: { env: fixture.env, repoRoot: repositoryRoot, now: () => NOW },
    });
    expect(plan).toContain('executor dry-run');
    expect(plan).not.toContain('UNCONFIGURED');
    expect(plan).toContain('[fetch exactly the requested SHAs (credential-free)] git');
    expect(plan).toContain('[create disposable instance (cold clone)] limactl create');
    expect(plan).toContain('--cap-drop=ALL');
    expect(plan).toContain('--network nabatable-ci-jobs');
    expect(plan).toContain('suite fast-static-gates (Fast static gates)');
    expect(plan).toContain('[prepare] prepare:install: pnpm install --frozen-lockfile');
    expect(plan).toContain('ci-evidence/ttl-14d/2026/09/04/ci-main-');
    expect(plan).toContain('lifecycle 14 days');
    expect(plan.trim().endsWith('dry-run: nothing executed')).toBe(true);
    expect(readdirSync(fixture.jobRoot)).toEqual([]);
    expect(readdirSync(fixture.spoolRoot)).toEqual([]);
  });

  it('reports unconfigured values and rejected or refused requests instead of planning them', () => {
    const fixture = configuredEnv({ NABATABLE_CI_R2_BUCKET: 'REPLACE_ME_BUCKET' });
    const plan = renderDryRunPlan({
      rawRequest: mainRequest(),
      deps: { env: fixture.env, repoRoot: repositoryRoot },
    });
    expect(plan).toContain('UNCONFIGURED: a real run would refuse because:');
    expect(plan).toContain('r2.bucket');

    const rejected = renderDryRunPlan({
      rawRequest: { ...mainRequest(), dockerFlags: '--privileged' },
      deps: { env: fixture.env, repoRoot: repositoryRoot },
    });
    expect(rejected).toContain('REQUEST REJECTED');
    expect(rejected).not.toContain('limactl');

    const refused = renderDryRunPlan({
      rawRequest: mainRequest({ imageDigest: `sha256:${'2'.repeat(64)}` }),
      deps: { env: configuredEnv().env, repoRoot: repositoryRoot },
    });
    expect(refused).toContain('REQUEST REFUSED');
    expect(refused).toContain('does not match the configured job image');
  });
});

describe('executeRequest', () => {
  it('runs spool -> lima -> docker -> supervisor -> evidence -> r2 and destroys the instance', async () => {
    const fixture = configuredEnv();
    const runner = new FakeRunner(happyRules());
    const captured: Captured[] = [];
    const run = await executeRequest(mainRequest(), deps(fixture.env, runner, captured));

    expect(run.jobId).toBe(`ci-main-${SHA_HEAD.slice(0, 12)}-a1`);
    expect(validateWith(CiResultSchema, run.built.result).ok).toBe(true);
    expect(run.built.result.supervisorOutcome).toBe('passed');
    expect(run.built.report.outcome).toBe('passed');
    expect(run.built.result.testInventory.counts.discovered).toBe(4);
    expect(run.built.result.coverage?.lines).toBe(80);
    expect(run.built.result.runtime).toEqual({
      activeRuntime: 'node22',
      nodeVersion: '22.23.1',
      pnpmVersion: '10.34.5',
    });
    expect(run.destroy.failures).toEqual([]);

    const rendered = runner.rendered();
    const index = (predicate: (line: string) => boolean) => rendered.findIndex(predicate);
    const created = index((line) => line.startsWith('limactl create'));
    const dockerRun = index((line) => line.includes(' run --detach'));
    const firstExec = index((line) => line.includes(' exec '));
    const staged = index((line) => line.includes(' cp ') && line.includes(':/workspace/coverage'));
    const deleted = index((line) => line.startsWith('limactl delete'));
    expect(created).toBeGreaterThan(
      index((line) => line.startsWith('git') && line.includes('bundle verify')),
    );
    expect(dockerRun).toBeGreaterThan(created);
    expect(firstExec).toBeGreaterThan(dockerRun);
    expect(staged).toBeGreaterThan(firstExec);
    expect(deleted).toBeGreaterThan(staged);
    // Phase handling: prep before the install step, test before the first test step, test again after.
    const phaseLines = rendered.filter((line) => line.includes('egress.sh phase'));
    expect(phaseLines.map((line) => line.split(' ').pop())).toEqual(['prep', 'test', 'test']);
    const install = index((line) => line.includes('pnpm install --frozen-lockfile'));
    expect(index((line) => line.endsWith('egress.sh phase prep'))).toBeLessThan(install);
    expect(index((line) => line.endsWith('egress.sh phase test'))).toBeGreaterThan(install);
    expect(index((line) => line.endsWith('egress.sh phase test'))).toBeLessThan(
      index((line) => line.includes('pnpm agents:validate')),
    );
    // Every docker command pins the CI context and never the default one.
    for (const call of runner.calls.filter((entry) => entry.command === 'docker')) {
      // `docker context create/rm` manage the CI context itself; everything else runs through it.
      if (call.args[0] !== 'context') {
        expect(call.args.slice(0, 2)).toEqual(['--context', 'nabatable-ci']);
      }
      expect(call.env?.DOCKER_CONFIG).toBe(path.join(run.jobDir, '.docker'));
    }
    expect(runner.find('docker', 'context', 'create', 'nabatable-ci').length).toBe(1);
    expect(rendered.some((line) => line.includes('context use'))).toBe(false);
    // Credentials never reach docker or lima.
    for (const call of runner.calls) {
      expect(JSON.stringify(call)).not.toContain(fixture.env.NABATABLE_CI_R2_SECRET_ACCESS_KEY);
    }
    // Evidence on disk and uploaded with HEAD verification.
    expect(existsSync(path.join(run.jobDir, 'evidence', 'result.json'))).toBe(true);
    expect(existsSync(path.join(run.jobDir, 'evidence', 'executor-report.json'))).toBe(true);
    const written = JSON.parse(
      readFileSync(path.join(run.jobDir, 'evidence', 'result.json'), 'utf8'),
    ) as unknown;
    expect(validateWith(CiResultSchema, written).ok).toBe(true);
    expect(run.uploaded.map((object) => object.key)).toEqual(
      expect.arrayContaining([
        `ci-evidence/ttl-14d/2026/09/04/${run.jobId}/result.json`,
        `ci-evidence/ttl-14d/2026/09/04/${run.jobId}/coverage/coverage-summary.json`,
        `ci-evidence/ttl-14d/2026/09/04/${run.jobId}/test-results/vitest/junit.xml`,
      ]),
    );
    expect(captured.filter((call) => call.method === 'HEAD').length).toBe(run.uploaded.length);
    expect(run.retention.scanned).toBe(1);
  });

  it('reports a failed step as failed, still collects evidence and still destroys the instance', async () => {
    const fixture = configuredEnv();
    const runner = new FakeRunner(happyRules({ failStep: 'pnpm lint' }));
    const run = await executeRequest(mainRequest(), deps(fixture.env, runner));
    expect(run.built.result.supervisorOutcome).toBe('failed');
    expect(run.built.report.reason).toBe('step lint failed');
    expect(runner.find('limactl', 'delete').length).toBe(1);
    expect(runner.find('docker', 'exec', 'pnpm', 'typecheck')).toEqual([]);
    expect(run.uploaded.length).toBeGreaterThan(0);
  });

  it('destroys the instance when docker run fails and surfaces an ExecutorFailure', async () => {
    const fixture = configuredEnv();
    const runner = new FakeRunner(happyRules({ failDockerRun: true }));
    let caught: unknown;
    try {
      await executeRequest(mainRequest(), deps(fixture.env, runner));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExecutorFailure);
    expect((caught as ExecutorFailure).message).toMatch(/start job container: exit 125/u);
    expect((caught as ExecutorFailure).profile?.name).toBe('main');
    expect(runner.find('limactl', 'stop').length).toBe(1);
    expect(runner.find('limactl', 'delete').length).toBe(1);
    expect(runner.find('docker', 'context', 'rm').length).toBe(2);
    expect(runner.find('docker', 'exec')).toEqual([]);
  });

  it('refuses before touching anything when unconfigured, the tuple is invalid, or the image digest differs', async () => {
    const unconfigured = configuredEnv({
      NABATABLE_CI_JOB_IMAGE: 'nabatable/ci-job@sha256:REPLACE_ME_DIGEST',
    });
    const runner = new FakeRunner(happyRules());
    await expect(
      executeRequest(mainRequest(), deps(unconfigured.env, runner)),
    ).rejects.toBeInstanceOf(ExecutorUnconfiguredError);

    const fixture = configuredEnv();
    await expect(
      executeRequest({ ...mainRequest(), volumes: ['/:/host'] }, deps(fixture.env, runner)),
    ).rejects.toBeInstanceOf(CiRequestError);
    await expect(
      executeRequest(mainRequest({ repositoryId: 1 }), deps(fixture.env, runner)),
    ).rejects.toBeInstanceOf(CiRequestError);
    await expect(
      executeRequest(
        mainRequest({ imageDigest: `sha256:${'3'.repeat(64)}` }),
        deps(fixture.env, runner),
      ),
    ).rejects.toBeInstanceOf(ExecutorRefusalError);
    await expect(
      executeRequest(mainRequest({ policyVersion: '2000-01-01.1' }), deps(fixture.env, runner)),
    ).rejects.toThrow(/policyVersion/u);
    expect(runner.calls).toEqual([]);
    expect(readdirSync(fixture.jobRoot)).toEqual([]);
  });

  it('refuses a PR whose synthetic merge conflicts, before any instance exists', async () => {
    const fixture = configuredEnv();
    const runner = new FakeRunner([
      when('git', ['merge', '--no-ff'], okResult({ exitCode: 1, stderr: 'CONFLICT (content)' })),
      when('git', ['diff', '--name-only', '--diff-filter=U'], okResult({ stdout: 'shared.txt\n' })),
      ...happyRules(),
    ]);
    let caught: unknown;
    try {
      await executeRequest(prRequest(), deps(fixture.env, runner));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExecutorFailure);
    expect((caught as ExecutorFailure).cause).toBeInstanceOf(SpoolMergeConflictError);
    expect(runner.calls.some((call) => call.command === 'limactl')).toBe(false);
    expect(runner.calls.some((call) => call.command === 'docker')).toBe(false);
    expect(runner.calls.some((call) => argsContain(call, 'merge', '--abort'))).toBe(true);
  });

  it('refuses to start when R2 credentials are unavailable', async () => {
    const fixture = configuredEnv();
    delete fixture.env.NABATABLE_CI_R2_ACCESS_KEY_ID;
    delete fixture.env.NABATABLE_CI_R2_SECRET_ACCESS_KEY;
    const runner = new FakeRunner([
      when('security', [], okResult({ exitCode: 44 })),
      ...happyRules(),
    ]);
    await expect(executeRequest(mainRequest(), deps(fixture.env, runner))).rejects.toThrow(
      /R2 credentials unconfigured/u,
    );
    expect(runner.calls.every((call) => call.command === 'security')).toBe(true);
    expect(IMAGE_DIGEST).toBe(mainRequest().imageDigest);
  });

  it('honours a controller cancel signal at a suite boundary', async () => {
    const fixture = configuredEnv();
    const runner = new FakeRunner(happyRules());
    let signal: 'continue' | 'cancel' = 'continue';
    runner.addRule(
      when('docker', ['exec', 'pnpm', 'install'], () => {
        signal = 'cancel';
        return okResult();
      }),
    );
    const run = await executeRequest(mainRequest(), {
      ...deps(fixture.env, runner),
      stopSignal: () => signal,
    });
    expect(run.built.result.supervisorOutcome).toBe('cancelled');
    expect(run.built.report.supervisor.stopSignal).toBe('cancel');
    expect(runner.find('docker', 'exec', 'pnpm', 'lint')).toEqual([]);
    expect(runner.find('limactl', 'delete').length).toBe(1);
  });
});
