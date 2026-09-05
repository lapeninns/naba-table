import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CiResultSchema } from '@/scripts/ci/contracts/result';
import { validateWith } from '@/scripts/ci/contracts/validation';
import {
  buildInfrastructureFailureResult,
  buildResults,
  canonicalJson,
  COVERAGE_SUITE_ID,
  EVIDENCE_MANIFEST_KEY,
  UNPROBED_VERSION,
} from '@/scripts/ci/evidence/result';
import { resolveExecutorProfile, stepLogStem } from '@/scripts/ci/executor/profiles';

import {
  COVERAGE_SUMMARY,
  FAILING_JUNIT_XML,
  JUNIT_XML,
  mainRequest,
  prRequest,
} from '../executor/helpers';

import type { HarvestResult } from '@/scripts/ci/evidence/collect';
import type { EvidenceFile, StepResult, SupervisorResult } from '@/scripts/ci/executor/types';

const request = mainRequest();
const profile = resolveExecutorProfile({ request, changedPaths: null, allocation: null });

function digest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function file(pathName: string, content: string, kind: EvidenceFile['kind']): EvidenceFile {
  return {
    path: pathName,
    bytes: Buffer.byteLength(content),
    sha256: digest(content),
    kind,
    redacted: false,
  };
}

function steps(outcomeFor: (id: string) => StepResult['outcome']): StepResult[] {
  return profile.steps.map((step) => ({
    id: step.id,
    suiteId: step.suiteId,
    phase: step.phase,
    outcome: outcomeFor(step.id),
    exitCode: outcomeFor(step.id) === 'passed' ? 0 : outcomeFor(step.id) === 'not-run' ? null : 1,
    signal: null,
    durationMs: 1000,
    timedOut: outcomeFor(step.id) === 'timeout',
    stdoutLog: `/job/staging/logs/${stepLogStem(step.id)}.stdout.log`,
    stderrLog: `/job/staging/logs/${stepLogStem(step.id)}.stderr.log`,
    stdoutTruncated: false,
    stderrTruncated: false,
  }));
}

function supervisor(overrides: Partial<SupervisorResult> = {}): SupervisorResult {
  return {
    profile: 'main',
    outcome: 'passed',
    steps: steps(() => 'passed'),
    startedAt: '2026-09-04T10:00:00.000Z',
    finishedAt: '2026-09-04T10:30:00.000Z',
    durationMs: 30 * 60_000,
    profileTimeoutMs: profile.profileTimeoutMs,
    stopSignal: 'continue',
    reason: null,
    ...overrides,
  };
}

const contents: Record<string, string> = {
  'coverage/coverage-summary.json': COVERAGE_SUMMARY,
  'test-results/vitest/junit.xml': JUNIT_XML,
  'logs/lint.stdout.log': 'lint ok\n',
};

function harvest(extra: Record<string, string> = {}, omit: readonly string[] = []): HarvestResult {
  const all = { ...contents, ...extra };
  const files = Object.entries(all)
    .filter(([name]) => !omit.includes(name))
    .map(([name, content]) =>
      file(name, content, name.endsWith('.json') ? 'json' : name.endsWith('.xml') ? 'xml' : 'log'),
    );
  return { files, rejected: [], totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0) };
}

function readFile(all: Record<string, string>) {
  return (absolutePath: string) => {
    const relative = absolutePath.replace('/evidence/', '');
    const content = all[relative];
    if (content === undefined) throw new Error(`missing ${relative}`);
    return content;
  };
}

const probed = { nodeVersion: 'v22.23.1', pnpmVersion: '10.34.5' };

describe('buildResults', () => {
  it('produces a contract-valid passed result with inventory, coverage, timings and digests', () => {
    const { result, report } = buildResults({
      jobId: 'ci-main-000000000000-a1',
      request,
      profile,
      supervisor: supervisor(),
      harvest: harvest(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
    });
    expect(validateWith(CiResultSchema, result).ok).toBe(true);
    expect(result.supervisorOutcome).toBe('passed');
    expect(result.testInventory.counts).toEqual({
      discovered: 4,
      passed: 3,
      failed: 0,
      skipped: 1,
      todo: 0,
    });
    expect(result.testInventory.discoveredIds.length).toBe(4);
    expect(result.coverage).toEqual({ lines: 80, branches: 60, functions: 80, statements: 81 });
    expect(result.runtime).toEqual({
      activeRuntime: 'node22',
      nodeVersion: '22.23.1',
      pnpmVersion: '10.34.5',
    });
    expect(result.timings.suites.map((suite) => suite.suiteId)).toEqual([
      ...profile.suites.map((suite) => suite.id),
      COVERAGE_SUITE_ID,
    ]);
    expect(result.timings.suites.every((suite) => suite.outcome === 'passed')).toBe(true);
    for (const suite of result.timings.suites) {
      expect(result.evidenceDigests[suite.suiteId]).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    expect(result.evidenceDigests[COVERAGE_SUITE_ID]).toBe(`sha256:${digest(COVERAGE_SUMMARY)}`);
    expect(result.evidenceDigests[EVIDENCE_MANIFEST_KEY]).toMatch(/^sha256:/u);
    expect(result.attempt).toBe(1);
    expect(result.dedupKey).toMatch(/^ci:v1:[0-9a-f]{64}$/u);
    expect(report.outcome).toBe('passed');
    expect(report.runtime).toMatchObject({
      activeRuntime: 'node22',
      candidateRuntime: 'node24',
      probed,
    });
    expect(report.runtime.qualificationNote.length).toBeGreaterThan(10);
    expect(report.reportDigest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('is deterministic: identical inputs give identical documents and digests', () => {
    const input = {
      jobId: 'ci-main-000000000000-a1',
      request,
      profile,
      supervisor: supervisor(),
      harvest: harvest(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
    };
    const a = buildResults(input);
    const b = buildResults(input);
    expect(canonicalJson(a.result)).toBe(canonicalJson(b.result));
    expect(a.report.reportDigest).toBe(b.report.reportDigest);
    const changedLog = buildResults({
      ...input,
      harvest: harvest({ 'logs/lint.stdout.log': 'different\n' }),
    });
    expect(changedLog.result.evidenceDigests['fast-static-gates']).not.toBe(
      a.result.evidenceDigests['fast-static-gates'],
    );
    expect(changedLog.result.evidenceDigests[EVIDENCE_MANIFEST_KEY]).not.toBe(
      a.result.evidenceDigests[EVIDENCE_MANIFEST_KEY],
    );
  });

  it('turns a supervisor pass into failed when junit reports failures', () => {
    const all = { ...contents, 'test-results/vitest/junit.xml': FAILING_JUNIT_XML };
    const { result, report } = buildResults({
      jobId: 'j',
      request,
      profile,
      supervisor: supervisor(),
      harvest: harvest({ 'test-results/vitest/junit.xml': FAILING_JUNIT_XML }),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(all),
    });
    expect(result.supervisorOutcome).toBe('failed');
    expect(result.testInventory.counts.failed).toBe(2);
    expect(report.reason).toMatch(/2 test case\(s\) failed/u);
    expect(validateWith(CiResultSchema, result).ok).toBe(true);
  });

  it('fails closed when junit, coverage or runtime evidence is missing', () => {
    const base = {
      jobId: 'j',
      request,
      profile,
      supervisor: supervisor(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
    };
    const noJunit = buildResults({
      ...base,
      harvest: harvest({}, ['test-results/vitest/junit.xml']),
    });
    expect(noJunit.result.supervisorOutcome).toBe('infrastructure-error');
    expect(noJunit.report.reason).toMatch(/no junit/u);
    const noCoverage = buildResults({
      ...base,
      harvest: harvest({}, ['coverage/coverage-summary.json']),
    });
    expect(noCoverage.result.supervisorOutcome).toBe('infrastructure-error');
    expect(noCoverage.result.coverage).toBeNull();
    expect(
      noCoverage.result.timings.suites.find((suite) => suite.suiteId === COVERAGE_SUITE_ID)
        ?.outcome,
    ).toBe('failed');
    const noProbe = buildResults({ ...base, harvest: harvest(), probed: null });
    expect(noProbe.result.supervisorOutcome).toBe('infrastructure-error');
    expect(noProbe.result.runtime.nodeVersion).toBe(UNPROBED_VERSION);
    const wrongPnpm = buildResults({
      ...base,
      harvest: harvest(),
      probed: { nodeVersion: 'v22.0.0', pnpmVersion: '9.0.0' },
    });
    expect(wrongPnpm.result.supervisorOutcome).toBe('infrastructure-error');
    expect(wrongPnpm.report.reason).toMatch(/pnpm 9.0.0/u);
    for (const built of [noJunit, noCoverage, noProbe, wrongPnpm]) {
      expect(validateWith(CiResultSchema, built.result).ok).toBe(true);
    }
  });

  it('maps executor outcomes onto the contract and records suite timings per outcome', () => {
    const failing = supervisor({
      outcome: 'oom',
      reason: 'step test:ci oom',
      steps: steps((id) => {
        const order = profile.steps.map((step) => step.id);
        const at = order.indexOf(id);
        const oomAt = order.indexOf('test:ci');
        return at < oomAt ? 'passed' : at === oomAt ? 'oom' : 'not-run';
      }),
    });
    const { result, report } = buildResults({
      jobId: 'j',
      request,
      profile,
      supervisor: failing,
      harvest: harvest(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
    });
    expect(result.supervisorOutcome).toBe('failed');
    expect(report.outcome).toBe('oom');
    expect(
      result.timings.suites.find((suite) => suite.suiteId === 'coverage-and-performance-evidence')
        ?.outcome,
    ).toBe('failed');
    expect(
      result.timings.suites.find((suite) => suite.suiteId === 'browser-smoke-packs')?.outcome,
    ).toBe('cancelled');
    expect(validateWith(CiResultSchema, result).ok).toBe(true);

    const timedOut = buildResults({
      jobId: 'j',
      request,
      profile,
      harvest: harvest(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
      supervisor: supervisor({
        outcome: 'timeout',
        reason: 'x',
        steps: steps((id) => (id === 'lint' ? 'timeout' : 'not-run')),
      }),
    });
    expect(timedOut.result.supervisorOutcome).toBe('timed-out');
    const cancelled = buildResults({
      jobId: 'j',
      request,
      profile,
      harvest: harvest(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
      supervisor: supervisor({
        outcome: 'cancelled',
        reason: 'x',
        stopSignal: 'cancel',
        steps: steps((id) => (id === 'prepare:install' ? 'passed' : 'cancelled')),
      }),
    });
    expect(cancelled.result.supervisorOutcome).toBe('cancelled');
  });

  it('lists skipped conditional suites as skipped with their own evidence digest', () => {
    const pr = prRequest();
    const prProfile = resolveExecutorProfile({
      request: pr,
      changedPaths: ['README.md'],
      allocation: null,
    });
    const prSteps: StepResult[] = prProfile.steps.map((step) => ({
      id: step.id,
      suiteId: step.suiteId,
      phase: step.phase,
      outcome: 'passed',
      exitCode: 0,
      signal: null,
      durationMs: 10,
      timedOut: false,
      stdoutLog: '',
      stderrLog: '',
      stdoutTruncated: false,
      stderrTruncated: false,
    }));
    const { result } = buildResults({
      jobId: 'j',
      request: pr,
      profile: prProfile,
      supervisor: supervisor({ steps: prSteps }),
      harvest: harvest(),
      evidenceDir: '/evidence',
      probed,
      readFile: readFile(contents),
    });
    expect(result.supervisorOutcome).toBe('passed');
    const skipped = result.timings.suites
      .filter((suite) => suite.outcome === 'skipped')
      .map((suite) => suite.suiteId);
    expect(skipped).toEqual([
      'shuffle-seed-20260715',
      'shuffle-seed-20260716',
      'shuffle-seed-20260717',
    ]);
    for (const suiteId of skipped) expect(result.evidenceDigests[suiteId]).toMatch(/^sha256:/u);
  });
});

describe('buildInfrastructureFailureResult', () => {
  it('produces a contract-valid infrastructure-error document', () => {
    const result = buildInfrastructureFailureResult({
      request,
      profile,
      startedAt: new Date('2026-09-04T10:00:00Z'),
      finishedAt: new Date('2026-09-04T10:01:00Z'),
      reason: 'limactl start failed',
    });
    expect(validateWith(CiResultSchema, result).ok).toBe(true);
    expect(result.supervisorOutcome).toBe('infrastructure-error');
    expect(result.timings.durationMs).toBe(60_000);
    expect(result.timings.suites.every((suite) => suite.outcome === 'cancelled')).toBe(true);
    expect(Object.keys(result.evidenceDigests)).toEqual(profile.suites.map((suite) => suite.id));
    const bare = buildInfrastructureFailureResult({
      request,
      profile: null,
      startedAt: new Date('2026-09-04T10:00:00Z'),
      finishedAt: new Date('2026-09-04T10:00:00Z'),
      reason: 'unconfigured',
    });
    expect(validateWith(CiResultSchema, bare).ok).toBe(true);
    expect(bare.timings.suites).toEqual([]);
  });
});
