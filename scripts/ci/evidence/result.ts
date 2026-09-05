import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { dedupKey } from '../contracts/request';
import { CiResultSchema } from '../contracts/result';
import { assertWith } from '../contracts/validation';
import { stepLogStem } from '../executor/profiles';
import {
  EXECUTOR_RUNTIME_NOTE,
  toContractOutcome,
  type CiRequest,
  type CiResult,
  type ContractOutcome,
  type CoverageDetail,
  type EvidenceFile,
  type ExecutorProfile,
  type ExecutorReport,
  type ProbedRuntime,
  type SkippedSuite,
  type StepResult,
  type SupervisorOutcome,
  type SupervisorResult,
  type TestInventoryDetail,
} from '../executor/types';
import type { HarvestResult } from './collect';
import { parseCoverageSummary } from './coverage';
import { buildTestInventory } from './junit';

/** JSON with recursively sorted object keys; the basis for deterministic digests. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function prefixedDigest(value: unknown): string {
  return `sha256:${sha256Hex(canonicalJson(value))}`;
}

export const COVERAGE_SUITE_ID = 'coverage';
export const EVIDENCE_MANIFEST_KEY = 'evidence-manifest';
/** Sentinel semver recorded when the runtime could not be probed (outcome is never `passed` then). */
export const UNPROBED_VERSION = '0.0.0';

const JUNIT_PATTERN = /(^|\/)(junit[^/]*|.*results?[^/]*)\.xml$/iu;
const COVERAGE_SUMMARY_PATTERN = /(^|\/)coverage-summary\.json$/u;

export interface BuildResultInput {
  readonly jobId: string;
  readonly request: CiRequest;
  readonly profile: ExecutorProfile;
  readonly supervisor: SupervisorResult;
  readonly harvest: HarvestResult;
  readonly evidenceDir: string;
  readonly probed: ProbedRuntime | null;
  readonly readFile?: (absolutePath: string) => string;
}

export interface BuiltResult {
  readonly result: CiResult;
  readonly report: ExecutorReport;
}

type SuiteTiming = CiResult['timings']['suites'][number];

function suiteOutcome(steps: readonly StepResult[]): SuiteTiming['outcome'] {
  if (steps.length === 0) return 'skipped';
  if (steps.some((step) => step.outcome === 'timeout')) return 'timed-out';
  if (steps.some((step) => step.outcome === 'cancelled')) return 'cancelled';
  if (steps.every((step) => step.outcome === 'passed')) return 'passed';
  if (steps.every((step) => step.outcome === 'not-run')) return 'cancelled';
  return 'failed';
}

function logDigests(
  files: ReadonlyMap<string, EvidenceFile>,
  step: StepResult,
): { stdout: string | null; stderr: string | null } {
  const stem = stepLogStem(step.id);
  return {
    stdout: files.get(`logs/${stem}.stdout.log`)?.sha256 ?? null,
    stderr: files.get(`logs/${stem}.stderr.log`)?.sha256 ?? null,
  };
}

function suiteEvidenceDigest(
  suiteId: string,
  steps: readonly StepResult[],
  files: ReadonlyMap<string, EvidenceFile>,
): string {
  return prefixedDigest({
    suiteId,
    steps: steps.map((step) => ({
      id: step.id,
      outcome: step.outcome,
      exitCode: step.exitCode,
      signal: step.signal,
      timedOut: step.timedOut,
      logs: logDigests(files, step),
    })),
  });
}

function skippedEvidenceDigest(suite: SkippedSuite): string {
  return prefixedDigest({ suiteId: suite.suiteId, skipped: true, reason: suite.reason });
}

function manifestDigest(files: readonly EvidenceFile[]): string {
  const lines = [...files]
    .map((file) => `${file.path}=${file.sha256}`)
    .sort()
    .join('\n');
  return `sha256:${sha256Hex(lines)}`;
}

function semverOf(raw: string): string | null {
  const match = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/u.exec(raw.trim());
  return match ? match[1] : null;
}

function decideOutcome(
  supervisor: SupervisorResult,
  tests: TestInventoryDetail,
  coverage: CoverageDetail | null,
  probed: ProbedRuntime | null,
  profile: ExecutorProfile,
): { outcome: SupervisorOutcome; reason: string | null } {
  if (supervisor.outcome !== 'passed') {
    return { outcome: supervisor.outcome, reason: supervisor.reason };
  }
  if (tests.failed > 0 || tests.errors > 0) {
    return {
      outcome: 'failed',
      reason: `${tests.failed + tests.errors} test case(s) failed according to junit evidence`,
    };
  }
  if (tests.discovered === 0) {
    return { outcome: 'infrastructure-error', reason: 'no junit test evidence was collected' };
  }
  if (coverage === null) {
    return { outcome: 'infrastructure-error', reason: 'no coverage-summary.json was collected' };
  }
  if (probed === null) {
    return {
      outcome: 'infrastructure-error',
      reason: 'container runtime versions were not probed',
    };
  }
  if (semverOf(probed.nodeVersion) === null || semverOf(probed.pnpmVersion) === null) {
    return { outcome: 'infrastructure-error', reason: 'probed runtime versions are not semver' };
  }
  if (semverOf(probed.pnpmVersion) !== profile.runtime.pnpm) {
    return {
      outcome: 'infrastructure-error',
      reason: `container pnpm ${probed.pnpmVersion} does not match profile pnpm ${profile.runtime.pnpm}`,
    };
  }
  return { outcome: 'passed', reason: null };
}

/**
 * Builds the contract `CiResult` (validated against `CiResultSchema`) and the
 * executor's private report from what the supervisor and the collector produced.
 * Fail closed: a supervisor "passed" turns into failed / infrastructure-error
 * when the junit evidence disagrees, is missing, or coverage / runtime evidence
 * is absent.
 */
export function buildResults(input: BuildResultInput): BuiltResult {
  const readFile = input.readFile ?? ((absolutePath: string) => readFileSync(absolutePath, 'utf8'));
  const filesByPath = new Map(input.harvest.files.map((file) => [file.path, file]));

  const junitFiles = input.harvest.files
    .filter((file) => file.kind === 'xml' && JUNIT_PATTERN.test(file.path))
    .map((file) => ({ path: file.path, xml: readFile(path.join(input.evidenceDir, file.path)) }));
  const tests = buildTestInventory(junitFiles);

  const summaries = input.harvest.files
    .filter((file) => file.kind === 'json' && COVERAGE_SUMMARY_PATTERN.test(file.path))
    .map((file) => file.path)
    .sort((a, b) => a.split('/').length - b.split('/').length || (a < b ? -1 : 1));
  let coverage: CoverageDetail | null = null;
  for (const summaryPath of summaries) {
    coverage = parseCoverageSummary(
      summaryPath,
      readFile(path.join(input.evidenceDir, summaryPath)),
    );
    if (coverage) break;
  }

  const decided = decideOutcome(input.supervisor, tests, coverage, input.probed, input.profile);
  const contractOutcome: ContractOutcome = toContractOutcome(decided.outcome);

  const stepsBySuite = new Map<string, StepResult[]>();
  for (const step of input.supervisor.steps) {
    const list = stepsBySuite.get(step.suiteId) ?? [];
    list.push(step);
    stepsBySuite.set(step.suiteId, list);
  }

  const suites: SuiteTiming[] = [];
  const evidenceDigests: Record<string, string> = {};
  for (const suite of input.profile.suites) {
    const steps = stepsBySuite.get(suite.id) ?? [];
    const durationMs = steps.reduce((sum, step) => sum + step.durationMs, 0);
    suites.push({
      suiteId: suite.id,
      outcome: suiteOutcome(steps),
      durationMs,
      p95BudgetExceeded: durationMs > suite.p95BudgetMs,
    });
    evidenceDigests[suite.id] = suiteEvidenceDigest(suite.id, steps, filesByPath);
  }
  for (const skippedSuite of input.profile.skippedSuites) {
    suites.push({
      suiteId: skippedSuite.suiteId,
      outcome: 'skipped',
      durationMs: 0,
      p95BudgetExceeded: false,
    });
    evidenceDigests[skippedSuite.suiteId] = skippedEvidenceDigest(skippedSuite);
  }
  const coverageFile = coverage ? filesByPath.get(coverage.source) : undefined;
  suites.push({
    suiteId: COVERAGE_SUITE_ID,
    outcome: coverage ? 'passed' : 'failed',
    durationMs: 0,
    p95BudgetExceeded: false,
  });
  evidenceDigests[COVERAGE_SUITE_ID] = coverageFile
    ? `sha256:${coverageFile.sha256}`
    : prefixedDigest({ coverage: null });
  evidenceDigests[EVIDENCE_MANIFEST_KEY] = manifestDigest(input.harvest.files);

  const nodeVersion = input.probed ? semverOf(input.probed.nodeVersion) : null;
  const pnpmVersion = input.probed ? semverOf(input.probed.pnpmVersion) : null;

  const candidate: CiResult = {
    version: 1,
    dedupKey: dedupKey(input.request),
    supervisorOutcome: contractOutcome,
    testInventory: {
      discoveredIds: [...tests.ids],
      counts: {
        discovered: tests.discovered,
        passed: tests.passed,
        failed: tests.failed + tests.errors,
        skipped: tests.skipped,
        todo: 0,
      },
    },
    coverage: coverage
      ? {
          lines: coverage.lines,
          branches: coverage.branches,
          functions: coverage.functions,
          statements: coverage.statements,
        }
      : null,
    runtime: {
      activeRuntime: input.profile.runtime.activeRuntime,
      nodeVersion: nodeVersion ?? UNPROBED_VERSION,
      pnpmVersion: pnpmVersion ?? UNPROBED_VERSION,
    },
    timings: {
      startedAt: input.supervisor.startedAt,
      finishedAt: input.supervisor.finishedAt,
      durationMs: input.supervisor.durationMs,
      suites,
    },
    evidenceDigests,
    attempt: input.request.attempt,
  };
  if (tests.idsTruncated) {
    // The contract requires discovered === discoveredIds.length; a truncated id
    // list cannot satisfy it, so the count is bounded to what is listed and the
    // truncation is recorded in the report.
    candidate.testInventory.counts.discovered = candidate.testInventory.discoveredIds.length;
  }
  const result = assertWith(CiResultSchema, candidate, 'CiResult');

  const body: Omit<ExecutorReport, 'reportDigest'> = {
    schemaVersion: 1,
    jobId: input.jobId,
    request: input.request,
    profile: input.supervisor.profile,
    policyVersion: input.profile.policyVersion,
    outcome: decided.outcome,
    contractOutcome,
    reason: decided.reason,
    supervisor: input.supervisor,
    skippedSuites: input.profile.skippedSuites,
    tests,
    coverage,
    evidence: {
      files: input.harvest.files,
      totalBytes: input.harvest.totalBytes,
      rejected: input.harvest.rejected,
    },
    runtime: {
      activeRuntime: input.profile.runtime.activeRuntime,
      candidateRuntime: input.profile.runtime.candidateRuntime,
      pnpm: input.profile.runtime.pnpm,
      qualificationNote: input.profile.runtime.qualificationNote || EXECUTOR_RUNTIME_NOTE,
      probed: input.probed,
    },
  };
  return { result, report: { ...body, reportDigest: sha256Hex(canonicalJson(body)) } };
}

/**
 * Result written when the job never reached the supervisor (spool, lima or
 * docker failure). It is a valid contract document with an
 * `infrastructure-error` outcome so the controller can fail the attempt.
 */
export function buildInfrastructureFailureResult(input: {
  readonly request: CiRequest;
  readonly profile: ExecutorProfile | null;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly reason: string;
}): CiResult {
  const suites: SuiteTiming[] = (input.profile?.suites ?? []).map((suite) => ({
    suiteId: suite.id,
    outcome: 'cancelled' as const,
    durationMs: 0,
    p95BudgetExceeded: false,
  }));
  const evidenceDigests: Record<string, string> = {};
  for (const suite of suites) {
    evidenceDigests[suite.suiteId] = prefixedDigest({
      suiteId: suite.suiteId,
      infrastructureError: input.reason,
    });
  }
  const candidate: CiResult = {
    version: 1,
    dedupKey: dedupKey(input.request),
    supervisorOutcome: 'infrastructure-error',
    testInventory: {
      discoveredIds: [],
      counts: { discovered: 0, passed: 0, failed: 0, skipped: 0, todo: 0 },
    },
    coverage: null,
    runtime: {
      activeRuntime: input.profile?.runtime.activeRuntime ?? 'node22',
      nodeVersion: UNPROBED_VERSION,
      pnpmVersion: UNPROBED_VERSION,
    },
    timings: {
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.finishedAt.toISOString(),
      durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
      suites,
    },
    evidenceDigests,
    attempt: input.request.attempt,
  };
  return assertWith(CiResultSchema, candidate, 'CiResult');
}
