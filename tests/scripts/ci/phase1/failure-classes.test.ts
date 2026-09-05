import { createHash, generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { CiResultSchema } from '@/scripts/ci/contracts/result';
import { validateWith } from '@/scripts/ci/contracts/validation';
import { createController } from '@/scripts/ci/controller/controller';
import { createGitHubClient, type FetchLike } from '@/scripts/ci/controller/github/client';
import { QueueStore } from '@/scripts/ci/controller/queue/store';
import { buildResults } from '@/scripts/ci/evidence/result';
import { resolveExecutorProfile, stepLogStem } from '@/scripts/ci/executor/profiles';
import { uploadEvidence } from '@/scripts/ci/executor/r2/upload';
import { classifyStep } from '@/scripts/ci/executor/supervisor/run';

import {
  APP_ID,
  FakeGitHub,
  INSTALLATION_ID,
  REPO_ID,
  SHA_MAIN_A,
  clock,
  controllerConfig,
  fakeAdmission,
  fakeSleepAssertion,
  manualRunner,
  recordingHeartbeat,
  type AdmissionState,
} from '../controller/helpers';
import { cleanupTempDirs, COVERAGE_SUMMARY, mainRequest, makeTempDir } from '../executor/helpers';

import type { HarvestResult } from '@/scripts/ci/evidence/collect';
import type { EvidenceFile, StepResult, SupervisorResult } from '@/scripts/ci/executor/types';

/**
 * Phase 1: failure classes that must never turn into a green check.
 *
 * - empty discovery (a suite that ran but discovered zero tests) and missing
 *   reports are infrastructure errors, not passes;
 * - network loss towards GitHub during discovery is contained: nothing is
 *   dispatched from a failed poll, running work is not cancelled, and the next
 *   poll recovers without operator action;
 * - network loss towards GitHub inside the App client surfaces as an error
 *   instead of being retried forever or answered from a cache;
 * - network loss towards R2 during evidence upload rejects the upload so the
 *   executor reports an infrastructure failure instead of a verified result.
 */

afterEach(cleanupTempDirs);

// ------------------------------------------------------------------ evidence

const request = mainRequest();
const profile = resolveExecutorProfile({ request, changedPaths: null, allocation: null });

const EMPTY_JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="vitest tests" tests="0" failures="0" errors="0" time="0.01">
  <testsuite name="tests/example.test.ts" tests="0" failures="0" errors="0" skipped="0" time="0.01">
  </testsuite>
</testsuites>
`;

function digest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function evidence(pathName: string, content: string, kind: EvidenceFile['kind']): EvidenceFile {
  return {
    path: pathName,
    bytes: Buffer.byteLength(content),
    sha256: digest(content),
    kind,
    redacted: false,
  };
}

function passedSteps(): StepResult[] {
  return profile.steps.map((step) => ({
    id: step.id,
    suiteId: step.suiteId,
    phase: step.phase,
    outcome: 'passed',
    exitCode: 0,
    signal: null,
    durationMs: 1000,
    timedOut: false,
    stdoutLog: `/job/staging/logs/${stepLogStem(step.id)}.stdout.log`,
    stderrLog: `/job/staging/logs/${stepLogStem(step.id)}.stderr.log`,
    stdoutTruncated: false,
    stderrTruncated: false,
  }));
}

function passedSupervisor(): SupervisorResult {
  return {
    profile: 'main',
    outcome: 'passed',
    steps: passedSteps(),
    startedAt: '2026-09-04T10:00:00.000Z',
    finishedAt: '2026-09-04T10:30:00.000Z',
    durationMs: 30 * 60_000,
    profileTimeoutMs: profile.profileTimeoutMs,
    stopSignal: 'continue',
    reason: null,
  };
}

function harvestOf(contents: Record<string, string>): HarvestResult {
  const files = Object.entries(contents).map(([name, content]) =>
    evidence(
      name,
      content,
      name.endsWith('.json') ? 'json' : name.endsWith('.xml') ? 'xml' : 'log',
    ),
  );
  return { files, rejected: [], totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0) };
}

function readerOf(contents: Record<string, string>) {
  return (absolutePath: string): string => {
    const relative = absolutePath.replace('/evidence/', '');
    const content = contents[relative];
    if (content === undefined) throw new Error(`missing ${relative}`);
    return content;
  };
}

const probed = { nodeVersion: 'v22.23.1', pnpmVersion: '10.34.5' };

describe('empty discovery and missing reports fail closed', () => {
  it('turns a supervisor pass with zero discovered tests into an infrastructure error', () => {
    const contents = {
      'coverage/coverage-summary.json': COVERAGE_SUMMARY,
      'test-results/vitest/junit.xml': EMPTY_JUNIT_XML,
    };
    const { result, report } = buildResults({
      jobId: 'ci-main-000000000000-a1',
      request,
      profile,
      supervisor: passedSupervisor(),
      harvest: harvestOf(contents),
      evidenceDir: '/evidence',
      probed,
      readFile: readerOf(contents),
    });
    expect(validateWith(CiResultSchema, result).ok).toBe(true);
    expect(result.supervisorOutcome).toBe('infrastructure-error');
    expect(result.testInventory.counts.discovered).toBe(0);
    expect(result.testInventory.discoveredIds).toEqual([]);
    expect(report.outcome).toBe('infrastructure-error');
    expect(report.reason).toMatch(/no junit test evidence/u);
  });

  it('never lets the contract accept a passed result without discovered tests', () => {
    const contents = {
      'coverage/coverage-summary.json': COVERAGE_SUMMARY,
      'test-results/vitest/junit.xml': EMPTY_JUNIT_XML,
    };
    const { result } = buildResults({
      jobId: 'ci-main-000000000000-a1',
      request,
      profile,
      supervisor: passedSupervisor(),
      harvest: harvestOf(contents),
      evidenceDir: '/evidence',
      probed,
      readFile: readerOf(contents),
    });
    // Even if a tampered executor flipped the outcome, the shared contract refuses it.
    const forged = { ...result, supervisorOutcome: 'passed' as const };
    const verdict = validateWith(CiResultSchema, forged);
    expect(verdict.ok).toBe(false);
    expect(JSON.stringify(verdict)).toMatch(/discovered at least one test/u);
  });

  it('treats a junit report that only names non-test elements as empty discovery', () => {
    const junitWithoutCases = `<?xml version="1.0"?>
<testsuites><testsuite name="s" tests="3"><system-out>ran 3</system-out></testsuite></testsuites>`;
    const contents = {
      'coverage/coverage-summary.json': COVERAGE_SUMMARY,
      'test-results/vitest/junit.xml': junitWithoutCases,
    };
    const { result } = buildResults({
      jobId: 'ci-main-000000000000-a1',
      request,
      profile,
      supervisor: passedSupervisor(),
      harvest: harvestOf(contents),
      evidenceDir: '/evidence',
      probed,
      readFile: readerOf(contents),
    });
    // Aggregate counters on <testsuite> are not evidence; only <testcase> elements are.
    expect(result.testInventory.counts.discovered).toBe(0);
    expect(result.supervisorOutcome).toBe('infrastructure-error');
  });

  it('classifies tool-missing exit codes as infrastructure errors rather than test failures', () => {
    const base = {
      exitCode: 0,
      signal: null,
      stdout: '',
      stderr: '',
      durationMs: 1,
      timedOut: false,
    };
    expect(classifyStep({ ...base, exitCode: 127, stderr: 'pnpm: not found' }, null)).toBe(
      'infrastructure-error',
    );
    expect(classifyStep({ ...base, exitCode: 126 }, null)).toBe('infrastructure-error');
    expect(classifyStep({ ...base, exitCode: 125 }, null)).toBe('infrastructure-error');
    expect(classifyStep({ ...base, exitCode: 1 }, null)).toBe('failed');
  });
});

// ---------------------------------------------------------------- controller

interface HarnessOptions {
  readonly admission?: Partial<AdmissionState>;
}

function harness(options: HarnessOptions = {}) {
  const time = clock('2026-09-04T10:00:00.000Z');
  const store = new QueueStore({ now: time.now });
  const github = new FakeGitHub();
  const runner = manualRunner();
  const admissionState: AdmissionState = {
    admitted: true,
    mode: 'normal',
    reasons: [],
    ...options.admission,
  };
  const heartbeat = recordingHeartbeat();
  const controller = createController({
    config: controllerConfig(),
    store,
    github,
    runner: runner.runner,
    admission: fakeAdmission(admissionState, time.now),
    heartbeat,
    sleepAssertion: fakeSleepAssertion(),
    now: time.now,
    ownerToken: 'owner-phase1',
  });
  return { time, store, github, runner, heartbeat, controller };
}

describe('network loss towards GitHub during controller discovery', () => {
  it('contains the outage: nothing is enqueued or dispatched and the next poll recovers', async () => {
    const h = harness();
    h.github.failNext = new TypeError('fetch failed');

    const report = await h.controller.reconcile();
    expect(report.discovery.error).toMatch(/fetch failed/u);
    expect(report.discovery.enqueued).toBe(0);
    expect(h.store.listRequests()).toEqual([]);
    expect(h.runner.jobs).toHaveLength(0);
    expect(h.github.writes()).toEqual([]);

    const recovered = await h.controller.tick();
    expect(recovered.discovery.error).toBeUndefined();
    expect(recovered.discovery.enqueued).toBe(1);
    expect(recovered.dispatched?.profile).toBe('main');
    expect(h.runner.jobs[0]?.request).toMatchObject({ profile: 'main', headSha: SHA_MAIN_A });
    expect(recovered.heartbeat.status).toBe('busy');
  });

  it('keeps running work alive and publishes nothing while GitHub is unreachable', async () => {
    const h = harness();
    await h.controller.reconcile();
    const started = await h.controller.tick();
    expect(started.dispatched?.profile).toBe('main');
    const attemptId = h.runner.jobs[0]?.attemptId ?? '';
    const writesBefore = h.github.writes().length;

    h.github.failNext = new TypeError('fetch failed');
    const outage = await h.controller.tick();
    expect(outage.discovery.error).toMatch(/fetch failed/u);
    expect(outage.dispatched).toBeNull();
    expect(h.store.getAttempt(attemptId)?.state).toBe('running');
    expect(h.store.getAttempt(attemptId)?.stop).toBe('continue');
    expect(h.github.writes().length).toBe(writesBefore);
    expect(h.github.completedConclusions()).toEqual([]);
    expect(outage.heartbeat.status).toBe('busy');
    expect(outage.heartbeat.running).toBe(1);
  });
});

// ------------------------------------------------------------ github client

let privateKeyPem = '';

beforeAll(() => {
  privateKeyPem = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  }).privateKey;
});

const NOW = new Date('2026-09-04T10:00:00.000Z');

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const PULL = {
  number: 7,
  head: { sha: 'a'.repeat(40), repo: { id: REPO_ID, fork: false } },
  base: { sha: SHA_MAIN_A, repo: { id: REPO_ID } },
  merge_commit_sha: 'c'.repeat(40),
  mergeable: true,
  draft: false,
  author_association: 'MEMBER',
  user: { login: 'alice', type: 'User' },
  updated_at: '2026-09-04T09:00:00.000Z',
};

const PULLS_PATH = '/repos/nabatable/nabatable/pulls';

describe('network loss inside the GitHub App client', () => {
  it('surfaces a thrown fetch as an error without retry loops and recovers on the next call', async () => {
    let pullsHits = 0;
    let failuresLeft = 1;
    const sleeps: number[] = [];
    const fetch: FetchLike = async (input) => {
      const url = new URL(input);
      if (url.pathname === '/app') return jsonResponse({ id: APP_ID, slug: 'nabatable-local-ci' });
      if (url.pathname === `/app/installations/${INSTALLATION_ID}/access_tokens`) {
        return jsonResponse({
          token: 'ghs_test0000000000000000',
          expires_at: '2026-09-04T11:00:00Z',
        });
      }
      if (url.pathname === `/repositories/${REPO_ID}`) {
        return jsonResponse({ id: REPO_ID, full_name: 'nabatable/nabatable' });
      }
      if (url.pathname === PULLS_PATH) {
        pullsHits += 1;
        if (failuresLeft > 0) {
          failuresLeft -= 1;
          throw new TypeError('fetch failed');
        }
        return jsonResponse([PULL]);
      }
      return new Response('not found', { status: 404 });
    };
    const github = createGitHubClient({
      credentials: { appId: APP_ID, installationId: INSTALLATION_ID, privateKeyPem },
      identity: { localAppId: APP_ID },
      repositoryId: REPO_ID,
      fetch,
      now: () => NOW,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
    });
    await github.verifyIdentity();

    await expect(github.listOpenPullRequests()).rejects.toThrow(/fetch failed/u);
    expect(pullsHits).toBe(1);
    expect(sleeps).toEqual([]);

    const pulls = await github.listOpenPullRequests();
    expect(pulls.map((pull) => pull.number)).toEqual([7]);
    expect(pullsHits).toBe(2);
  });
});

// -------------------------------------------------------------------- R2

const r2 = {
  endpoint: 'https://acct.r2.cloudflarestorage.com',
  bucket: 'nabatable-ci-evidence',
  keyPrefix: 'ci-evidence/ttl-14d',
  region: 'auto',
};
const credentials = {
  accessKeyId: 'AKIDEXAMPLE0000000000',
  secretAccessKey: 'secret-example-value-0000000000',
};

function evidenceFile(dir: string, name: string, content: string) {
  const absolutePath = path.join(dir, name);
  writeFileSync(absolutePath, content);
  return {
    relativePath: name,
    absolutePath,
    sha256: digest(content),
    bytes: Buffer.byteLength(content),
  };
}

describe('network loss towards R2 during evidence upload', () => {
  it('rejects when the PUT never reaches the bucket and reports no object as uploaded', async () => {
    const dir = makeTempDir();
    const files = [evidenceFile(dir, 'result.json', '{"ok":true}')];
    const methods: string[] = [];
    const fetch = async (_url: string, init: RequestInit): Promise<Response> => {
      methods.push(init.method ?? 'GET');
      throw new TypeError('fetch failed');
    };
    await expect(
      uploadEvidence({ config: r2, credentials, jobId: 'job', files, now: () => NOW }, { fetch }),
    ).rejects.toThrow(/fetch failed/u);
    expect(methods).toEqual(['PUT']);
  });

  it('rejects when the network drops between PUT and the verifying HEAD', async () => {
    const dir = makeTempDir();
    const files = [
      evidenceFile(dir, 'result.json', '{"ok":true}'),
      evidenceFile(dir, 'junit.xml', '<x/>'),
    ];
    const methods: string[] = [];
    const fetch = async (_url: string, init: RequestInit): Promise<Response> => {
      const method = init.method ?? 'GET';
      methods.push(method);
      if (method === 'PUT') return new Response(null, { status: 200 });
      throw new TypeError('fetch failed');
    };
    await expect(
      uploadEvidence({ config: r2, credentials, jobId: 'job', files, now: () => NOW }, { fetch }),
    ).rejects.toThrow(/fetch failed/u);
    // The second file is never attempted: an unverified upload aborts the whole batch.
    expect(methods).toEqual(['PUT', 'HEAD']);
  });
});
