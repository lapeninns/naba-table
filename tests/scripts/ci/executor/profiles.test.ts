import { describe, expect, it } from 'vitest';

import {
  allowedEnvKeys,
  EXECUTOR_ENV,
  PREPARE_STEP_ID,
  PREPARE_SUITE_ID,
  ProfileResolutionError,
  resolveExecutorProfile,
  stepLogStem,
  tokenizeRun,
} from '@/scripts/ci/executor/profiles';
import { POLICY_VERSION, SANITIZED_ENV } from '@/scripts/ci/profiles/catalog';
import { mainProfile } from '@/scripts/ci/profiles/main';
import { prProfile } from '@/scripts/ci/profiles/pr';

import { mainRequest, prRequest } from './helpers';

describe('tokenizeRun', () => {
  it('splits words and honours quotes without expanding anything', () => {
    expect(tokenizeRun("pnpm --filter '@nabatable/*' -r test")).toEqual([
      'pnpm',
      '--filter',
      '@nabatable/*',
      '-r',
      'test',
    ]);
    expect(tokenizeRun('pnpm test:stability --sequence.seed=20260715')).toEqual([
      'pnpm',
      'test:stability',
      '--sequence.seed=20260715',
    ]);
  });

  it('refuses shell metacharacters even inside quotes', () => {
    for (const bad of [
      'pnpm test; rm -rf /',
      'pnpm test | tee out',
      'pnpm test && curl x',
      "pnpm test '$(id)'",
      'pnpm test `id`',
      'pnpm test > /tmp/x',
      'pnpm test\nrm -rf /',
    ]) {
      expect(() => tokenizeRun(bad)).toThrow(ProfileResolutionError);
    }
  });

  it('refuses executables outside the allowlist and unterminated quotes', () => {
    expect(() => tokenizeRun('curl https://example.com')).toThrow(/not an allowed executable/u);
    expect(() => tokenizeRun('sh -c pnpm')).toThrow(/not an allowed executable/u);
    expect(() => tokenizeRun("pnpm test 'oops")).toThrow(/unterminated/u);
    expect(() => tokenizeRun('   ')).toThrow(/empty/u);
  });

  it('accepts every command in the shipped profiles', () => {
    for (const command of [...prProfile.commands, ...mainProfile.commands]) {
      expect(tokenizeRun(command.run)[0]).toMatch(/^(pnpm|bash)$/u);
    }
  });
});

describe('resolveExecutorProfile', () => {
  it('derives steps from the contract profile with a leading prepare step', () => {
    const profile = resolveExecutorProfile({
      request: mainRequest(),
      changedPaths: null,
      allocation: null,
    });
    expect(profile.name).toBe('main');
    expect(profile.policyVersion).toBe(POLICY_VERSION);
    expect(profile.steps[0]).toMatchObject({
      id: PREPARE_STEP_ID,
      suiteId: PREPARE_SUITE_ID,
      phase: 'prepare',
      command: ['pnpm', 'install', '--frozen-lockfile'],
    });
    expect(profile.steps.slice(1).every((step) => step.phase === 'test')).toBe(true);
    const expectedIds = mainProfile.suites.flatMap((suite) =>
      suite.commandIds.map((commandId) =>
        commandId === 'test:workspaces:stability' ? `${commandId}@${suite.id}` : commandId,
      ),
    );
    expect(profile.steps.map((step) => step.id)).toEqual([PREPARE_STEP_ID, ...expectedIds]);
    expect(new Set(profile.steps.map((step) => step.id)).size).toBe(profile.steps.length);
    expect(profile.suites.flatMap((suite) => suite.stepIds)).toEqual([
      PREPARE_STEP_ID,
      ...expectedIds,
    ]);
    expect(profile.suites[0].id).toBe(PREPARE_SUITE_ID);
    expect(profile.suites.slice(1).map((suite) => suite.id)).toEqual(
      mainProfile.suites.map((suite) => suite.id),
    );
    expect(profile.skippedSuites).toEqual([]);
    expect(profile.jobImageDigest).toBeNull();
    expect(profile.runtime.activeRuntime).toBe('node22');
    expect(profile.runtime.candidateRuntime).toBe('node24');
  });

  it('layers the executor env under the sanitized profile env', () => {
    const profile = resolveExecutorProfile({
      request: mainRequest(),
      changedPaths: null,
      allocation: null,
    });
    expect(profile.env).toEqual({ ...EXECUTOR_ENV, ...SANITIZED_ENV });
    const browserStep = profile.steps.find((step) => step.id.startsWith('playwright:'));
    expect(browserStep?.env.QA_USE_MOCKS).toBe('1');
    expect(allowedEnvKeys(profile)).toContain('QA_USE_MOCKS');
    expect(allowedEnvKeys(profile)).toContain('HOME');
  });

  it('keeps home and the pnpm store outside the source checkout', () => {
    const profile = resolveExecutorProfile({
      request: mainRequest(),
      changedPaths: null,
      allocation: null,
    });
    expect(profile.env.HOME).toBe('/home/ci');
    expect(profile.env.PNPM_HOME).toBe('/home/ci/.local/share/pnpm');
    expect(allowedEnvKeys(profile)).toContain('PNPM_HOME');
  });

  it('skips conditional suites when the changed paths do not match, and runs them when unknown', () => {
    const skipped = resolveExecutorProfile({
      request: prRequest(),
      changedPaths: ['src/app/page.tsx', 'README.md'],
      allocation: null,
    });
    expect(skipped.skippedSuites.map((suite) => suite.suiteId)).toEqual([
      'shuffle-seed-20260715',
      'shuffle-seed-20260716',
      'shuffle-seed-20260717',
    ]);
    expect(skipped.steps.some((step) => step.id.startsWith('test:stability:'))).toBe(false);

    const unknown = resolveExecutorProfile({
      request: prRequest(),
      changedPaths: null,
      allocation: null,
    });
    expect(unknown.skippedSuites).toEqual([]);
    expect(unknown.changedPathsProvided).toBe(false);

    const matched = resolveExecutorProfile({
      request: prRequest(),
      changedPaths: ['tests/server/example.test.ts'],
      allocation: null,
    });
    expect(matched.skippedSuites).toEqual([]);
  });

  it('refuses a policy version that does not match the profile', () => {
    expect(() =>
      resolveExecutorProfile({
        request: mainRequest({ policyVersion: '2000-01-01.1' }),
        changedPaths: null,
        allocation: null,
      }),
    ).toThrow(/policyVersion/u);
  });

  it('caps resources at the controller allocation', () => {
    const capped = resolveExecutorProfile({
      request: mainRequest(),
      changedPaths: null,
      allocation: { cpus: 2, memoryGiB: 4.5 },
    });
    expect(capped.resources).toMatchObject({ cpus: 2, memory: '4g' });
    const uncapped = resolveExecutorProfile({
      request: mainRequest(),
      changedPaths: null,
      allocation: null,
    });
    expect(uncapped.resources).toMatchObject({
      cpus: mainProfile.limits.cpu,
      memory: `${mainProfile.limits.memoryGiB}g`,
      pidsLimit: mainProfile.limits.pids,
    });
  });

  it('records suite hard limits and the profile timeout in milliseconds', () => {
    const profile = resolveExecutorProfile({
      request: mainRequest(),
      changedPaths: null,
      allocation: null,
    });
    const fast = profile.suites.find((suite) => suite.id === 'fast-static-gates');
    expect(fast?.hardLimitMs).toBe(15 * 60_000);
    expect(fast?.p95BudgetMs).toBe(10 * 60_000);
    expect(profile.profileTimeoutMs).toBeGreaterThan(mainProfile.limits.timeoutMinutes * 60_000);
  });
});

describe('stepLogStem', () => {
  it('produces file-name-safe stems', () => {
    expect(stepLogStem('test:ci')).toBe('test_ci');
    expect(stepLogStem('playwright:guest-booking')).toBe('playwright_guest-booking');
    expect(stepLogStem('a/b')).toBe('a_b');
  });
});
