import { describe, expect, it } from 'vitest';

import {
  evaluateReleaseGate,
  parseGateRequest,
  type GateDecision,
  type GateRefusalCode,
} from '@/scripts/ci/gate/evaluate-core';
import { parsePolicy } from '@/scripts/ci/gate/policy';

import {
  ACTIONS_APP_ID,
  BASE_SHA,
  CODEQL_WORKFLOW_ID,
  FALLBACK_ARTIFACT_NAME,
  FALLBACK_RUN_ID,
  HEAD_COMMITTED_AT,
  HEAD_SHA,
  MERGE_SHA,
  NOW,
  OTHER_DIGEST,
  OTHER_REPO_ID,
  OTHER_SHA,
  OTHER_WORKFLOW_ID,
  STALE,
  approveFallback,
  checkRun,
  configuredPolicy,
  fallbackResult,
  localResult,
  mainRequest,
  mainTuple,
  mainWorld,
  prRequest,
  prTuple,
  prWorld,
  realPolicyRaw,
  suiteResults,
} from './helpers';

import type { FakeGitHub } from './helpers';
import type { GateMode } from '@/scripts/ci/gate/policy';

async function evaluate(
  api: FakeGitHub,
  options: {
    mode?: GateMode;
    request?: ReturnType<typeof prRequest>;
    policy?: ReturnType<typeof configuredPolicy>;
    now?: Date;
  } = {},
): Promise<GateDecision> {
  return evaluateReleaseGate({
    api,
    policy: options.policy ?? configuredPolicy(),
    request: options.request ?? prRequest(),
    mode: options.mode ?? 'merge',
    now: () => options.now ?? NOW,
  });
}

function codes(decision: GateDecision): GateRefusalCode[] {
  return decision.refusals.map((refusal) => refusal.code);
}

describe('parseGateRequest', () => {
  it('accepts workflow_dispatch string inputs and infers the profile', () => {
    const parsed = parseGateRequest({
      repositoryId: '123456789',
      prNumber: '42',
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      testedSha: MERGE_SHA,
      attempt: '2',
      requestedBy: 'octocat',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.profile).toBe('pr');
    expect(parsed.request.attempt).toBe(2);
    expect(parsed.request.requestedBy).toBe('octocat');
  });

  it('refuses abbreviated SHAs, zero attempts and pr requests without a number', () => {
    const parsed = parseGateRequest({
      repositoryId: 1,
      profile: 'pr',
      headSha: 'abc123',
      baseSha: BASE_SHA,
      testedSha: MERGE_SHA,
      attempt: 0,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('headSha'),
        expect.stringContaining('attempt'),
        'pr profile requires prNumber',
      ]),
    );
  });
});

describe('release gate evaluation: happy paths', () => {
  it('allows a pull request with complete local evidence and green hosted lanes', async () => {
    const decision = await evaluate(prWorld());
    expect(decision.refusals).toEqual([]);
    expect(decision.ok).toBe(true);
    expect(decision.publishable).toBe(true);
    expect(decision.evidenceSource).toBe('local');
    expect(decision.tupleKey).toContain('nabatable-ci/v1:');
    expect(decision.suites).toHaveLength(8);
    expect(decision.compatibility.map((entry) => entry.checkName).sort()).toEqual(
      [
        'Browser smoke packs',
        'Coverage and performance evidence',
        'Fast static gates',
        'Full Vitest suite',
        'Primitive coverage',
        'Shuffle seed 20260715',
        'Shuffle seed 20260716',
        'Shuffle seed 20260717',
      ].sort(),
    );
    expect(decision.compatibility.every((entry) => entry.status === 'passed')).toBe(true);
    expect(decision.hostedWorkflows.map((entry) => entry.conclusion)).toEqual([
      'success',
      'success',
    ]);
  });

  it('allows a main-deploy request whose evidence is fresh', async () => {
    const decision = await evaluate(mainWorld(), { mode: 'main-deploy', request: mainRequest() });
    expect(decision.refusals).toEqual([]);
    expect(decision.ok).toBe(true);
  });

  it('allows a conditional shuffle suite that the changed-path rule skipped', async () => {
    const evidence = localResult(prTuple(), {
      suites: suiteResults({
        'shuffle-seed-20260715': { status: 'skipped' },
        'shuffle-seed-20260716': { status: 'skipped' },
        'shuffle-seed-20260717': { status: 'skipped' },
      }),
    });
    const decision = await evaluate(prWorld({ evidence }));
    expect(decision.refusals).toEqual([]);
    expect(decision.ok).toBe(true);
    const shuffle = decision.compatibility.find(
      (entry) => entry.checkName === 'Shuffle seed 20260715',
    );
    expect(shuffle).toEqual(expect.objectContaining({ status: 'skipped', conditional: true }));
  });
});

describe('release gate evaluation: refusal matrix', () => {
  it('refuses the committed policy while placeholders remain (unconfigured)', async () => {
    const decision = await evaluate(prWorld(), { policy: parsePolicy(realPolicyRaw()) });
    expect(decision.ok).toBe(false);
    expect(decision.publishable).toBe(false);
    expect(codes(decision)).toEqual(['policy-unconfigured']);
    expect(decision.refusals[0].message).toContain(
      'policy placeholders remain: allowedImageDigests[0], repositoryId',
    );
  });

  it('refuses a structurally broken policy', async () => {
    const decision = await evaluate(prWorld(), { policy: parsePolicy({ policyVersion: 1 }) });
    expect(decision.publishable).toBe(false);
    expect(codes(decision).every((code) => code === 'policy-invalid')).toBe(true);
  });

  it('refuses a wrong repository id without publishing', async () => {
    const decision = await evaluate(prWorld(), {
      request: prRequest({ repositoryId: OTHER_REPO_ID }),
    });
    expect(decision.ok).toBe(false);
    expect(decision.publishable).toBe(false);
    expect(codes(decision)).toEqual(['repository-mismatch']);
  });

  it('refuses when the policy repository differs from the API repository', async () => {
    const decision = await evaluate(prWorld(), {
      policy: configuredPolicy((raw) => {
        raw.repositoryId = OTHER_REPO_ID;
      }),
    });
    expect(codes(decision)).toEqual(['repository-mismatch']);
  });

  it('refuses a check run created by the wrong GitHub App', async () => {
    const api = prWorld({ evidence: null, checkRuns: [checkRun(localResult(), { appId: 99 })] });
    const decision = await evaluate(api);
    expect(codes(decision)).toContain('evidence-app-mismatch');
    expect(decision.ok).toBe(false);
  });

  it('refuses evidence from an installation other than the pinned one', async () => {
    const decision = await evaluate(
      prWorld({ evidence: localResult(prTuple(), { installationId: 1 }) }),
    );
    expect(codes(decision)).toContain('evidence-installation-mismatch');
  });

  it('refuses when only a check with the wrong name exists', async () => {
    const wrongName = checkRun(localResult(), { name: 'Local CI / main' });
    const decision = await evaluate(prWorld({ evidence: null, checkRuns: [wrongName] }));
    expect(codes(decision)).toEqual(['evidence-missing']);
    expect(decision.publishable).toBe(true);
  });

  it('refuses evidence produced for another attempt', async () => {
    const decision = await evaluate(prWorld({ evidence: localResult(prTuple({ attempt: 2 })) }));
    expect(codes(decision)).toContain('evidence-attempt-mismatch');
  });

  it('refuses a check whose external_id is not bound to its tuple', async () => {
    const api = prWorld({
      evidence: null,
      checkRuns: [checkRun(localResult(), { externalId: 'nabatable-ci/v1:tampered' })],
    });
    const decision = await evaluate(api);
    expect(codes(decision)).toContain('evidence-tuple-mismatch');
  });

  it('refuses evidence with missing or malformed digests', async () => {
    const suites = suiteResults();
    suites[0] = { ...suites[0], evidenceDigest: 'sha256:short' };
    const decision = await evaluate(prWorld({ evidence: localResult(prTuple(), { suites }) }));
    expect(codes(decision)).toContain('evidence-invalid');
    expect(decision.refusals[0].message).toContain('evidenceDigest');
  });

  it('refuses an empty suite inventory', async () => {
    const decision = await evaluate(prWorld({ evidence: localResult(prTuple(), { suites: [] }) }));
    expect(codes(decision)).toContain('suite-inventory-incomplete');
  });

  it('refuses when a required suite is missing from the evidence', async () => {
    const suites = suiteResults().filter((suite) => suite.id !== 'full-vitest-suite');
    const decision = await evaluate(prWorld({ evidence: localResult(prTuple(), { suites }) }));
    expect(decision.refusals).toEqual([
      expect.objectContaining({
        code: 'suite-inventory-incomplete',
        message: expect.stringContaining('full-vitest-suite'),
      }),
    ]);
  });

  it('refuses a suite that is not in the policy inventory', async () => {
    const suites = [
      ...suiteResults(),
      { id: 'mystery', name: 'Mystery', status: 'passed' as const, evidenceDigest: OTHER_DIGEST },
    ];
    const decision = await evaluate(prWorld({ evidence: localResult(prTuple(), { suites }) }));
    expect(codes(decision)).toEqual(['suite-inventory-incomplete']);
  });

  it('refuses a coverage failure even when every suite passed', async () => {
    const decision = await evaluate(
      prWorld({
        evidence: localResult(prTuple(), {
          coverage: { status: 'failed', evidenceDigest: OTHER_DIGEST },
        }),
      }),
    );
    expect(codes(decision)).toEqual(['coverage-failed']);
  });

  it('refuses a failed suite', async () => {
    const decision = await evaluate(
      prWorld({
        evidence: localResult(prTuple(), {
          suites: suiteResults({ 'browser-smoke-packs': { status: 'failed' } }),
        }),
      }),
    );
    expect(codes(decision)).toEqual(['suite-failed']);
  });

  it('refuses an unexpected skip of a required suite', async () => {
    const decision = await evaluate(
      prWorld({
        evidence: localResult(prTuple(), {
          suites: suiteResults({ 'full-vitest-suite': { status: 'skipped' } }),
        }),
      }),
    );
    expect(codes(decision)).toEqual(['suite-skipped']);
  });

  it('refuses a skipped conditional suite on main where nothing is conditional', async () => {
    const evidence = localResult(mainTuple(), {
      suites: suiteResults({ 'shuffle-seed-20260716': { status: 'skipped' } }),
    });
    const decision = await evaluate(mainWorld({ evidence }), {
      mode: 'main-deploy',
      request: mainRequest(),
    });
    expect(codes(decision)).toEqual(['suite-skipped']);
  });

  it('refuses a superseded head (PR moved on)', async () => {
    const api = prWorld();
    const pr = api.state.pullRequests.get(42);
    if (!pr) throw new Error('fixture');
    api.state.pullRequests.set(42, { ...pr, headSha: OTHER_SHA });
    const decision = await evaluate(api);
    expect(codes(decision)).toContain('superseded');
    expect(decision.ok).toBe(false);
  });

  it('refuses a head that moves during evaluation', async () => {
    const api = prWorld();
    const original = api.getPullRequest.bind(api);
    let reads = 0;
    api.getPullRequest = async (number) => {
      reads += 1;
      const pr = await original(number);
      return pr && reads > 1 ? { ...pr, headSha: OTHER_SHA } : pr;
    };
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['superseded']);
  });

  it('refuses when the merge commit does not match testedSha', async () => {
    const api = prWorld();
    const pr = api.state.pullRequests.get(42);
    if (!pr) throw new Error('fixture');
    api.state.pullRequests.set(42, { ...pr, mergeCommitSha: OTHER_SHA });
    const decision = await evaluate(api);
    expect(codes(decision)).toContain('revision-mismatch');
  });

  it('refuses a fork head repository in merge mode even with green evidence', async () => {
    const api = prWorld();
    const pr = api.state.pullRequests.get(42);
    if (!pr) throw new Error('fixture');
    api.state.pullRequests.set(42, { ...pr, headRepoId: OTHER_REPO_ID });
    const decision = await evaluate(api);
    expect(decision.ok).toBe(false);
    expect(codes(decision)).toContain('repository-mismatch');
    expect(decision.refusals.map((refusal) => refusal.message)).toContain(
      'pull request head repository differs from this repository (forks are never gated)',
    );
    expect(api.state.calls).not.toContain('listCheckRuns');

    api.state.pullRequests.set(42, { ...pr, headRepoId: null });
    const deleted = await evaluate(api);
    expect(codes(deleted)).toContain('repository-mismatch');
  });

  it('refuses a closed pull request or one targeting another branch', async () => {
    const api = prWorld();
    const pr = api.state.pullRequests.get(42);
    if (!pr) throw new Error('fixture');
    api.state.pullRequests.set(42, { ...pr, state: 'closed', baseRef: 'develop' });
    const decision = await evaluate(api);
    expect(decision.refusals.map((refusal) => refusal.message)).toEqual([
      'pull request #42 is closed',
      'pull request targets develop, not main',
    ]);
  });

  it('refuses stale main-deploy evidence beyond the freshness window', async () => {
    const evidence = localResult(mainTuple(), { completedAt: STALE });
    const api = mainWorld({ evidence });
    const check = api.state.checkRuns[0];
    api.state.checkRuns[0] = { ...check, completedAt: STALE };
    const decision = await evaluate(api, { mode: 'main-deploy', request: mainRequest() });
    expect(codes(decision)).toEqual(['stale', 'stale']);
  });

  it('refuses stale hosted runs in main-deploy mode', async () => {
    const api = mainWorld();
    api.state.workflowRuns = api.state.workflowRuns.map((run) => ({ ...run, updatedAt: STALE }));
    const decision = await evaluate(api, { mode: 'main-deploy', request: mainRequest() });
    expect(codes(decision)).toEqual(['stale', 'stale']);
  });

  it('does not apply freshness to merge mode (freshness merge=null)', async () => {
    const evidence = localResult(prTuple(), { completedAt: STALE });
    const decision = await evaluate(prWorld({ evidence }));
    expect(decision.ok).toBe(true);
  });

  it('refuses evidence completed in the future', async () => {
    const evidence = localResult(mainTuple(), { completedAt: '2026-09-05T13:00:00.000Z' });
    const decision = await evaluate(mainWorld({ evidence }), {
      mode: 'main-deploy',
      request: mainRequest(),
    });
    expect(codes(decision)).toContain('evidence-invalid');
  });

  it('refuses a rejected controller version, image digest or policy version', async () => {
    const evidence = localResult(
      prTuple({ controllerVersion: '9.9.9', imageDigest: OTHER_DIGEST, policyVersion: 'old.1' }),
    );
    const request = prRequest();
    const decision = await evaluate(prWorld({ evidence }), { request });
    expect(codes(decision)).toEqual([
      'evidence-version-rejected',
      'evidence-version-rejected',
      'evidence-version-rejected',
    ]);
  });

  it('refuses when a required hosted workflow has no run on the head', async () => {
    const api = prWorld();
    api.state.workflowRuns = api.state.workflowRuns.filter(
      (run) => run.workflowId !== CODEQL_WORKFLOW_ID,
    );
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['hosted-workflow-missing']);
    expect(decision.hostedWorkflows).toEqual([
      expect.objectContaining({ displayName: 'Security guards', conclusion: 'success' }),
      expect.objectContaining({ displayName: 'CodeQL security review', runId: null }),
    ]);
  });

  it('refuses a hosted run that failed, and an unexpectedly skipped hosted job', async () => {
    const api = prWorld();
    const [security, codeql] = api.state.workflowRuns;
    api.state.workflowRuns = [{ ...security, conclusion: 'failure' }, codeql];
    api.state.jobs.set(codeql.id, [
      {
        id: 1,
        name: 'CodeQL JavaScript and TypeScript',
        status: 'completed',
        conclusion: 'skipped',
      },
    ]);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['hosted-workflow-failed', 'hosted-job-skipped']);
  });

  it('refuses when a required hosted job is missing from the run', async () => {
    const api = prWorld();
    const [security] = api.state.workflowRuns;
    api.state.jobs.set(security.id, [
      { id: 1, name: 'Something else', status: 'completed', conclusion: 'success' },
    ]);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['hosted-job-missing']);
  });

  it('refuses a hosted run of the wrong event type', async () => {
    const api = prWorld();
    api.state.workflowRuns = api.state.workflowRuns.map((run) => ({ ...run, event: 'push' }));
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['hosted-workflow-missing', 'hosted-workflow-missing']);
  });

  it('refuses when a required hosted workflow id is unconfigured', async () => {
    const decision = await evaluate(prWorld(), {
      policy: configuredPolicy((raw) => {
        (raw.requiredHostedWorkflows as Record<string, Record<string, unknown>>)[
          'Security guards'
        ].id = 'REPLACE_ME_SECURITY_GUARDS_WORKFLOW_ID';
      }),
    });
    expect(codes(decision)).toEqual(['policy-unconfigured']);
    expect(decision.publishable).toBe(false);
  });

  it('refuses on API errors instead of passing', async () => {
    const api = prWorld();
    api.state.failures.add('listCheckRuns');
    const decision = await evaluate(api);
    expect(codes(decision)).toContain('api-error');
    expect(decision.ok).toBe(false);
  });

  it('refuses mode/profile mismatches before touching the API', async () => {
    const api = prWorld();
    const decision = await evaluate(api, { mode: 'main-deploy' });
    expect(codes(decision)).toEqual(['input-invalid']);
    expect(api.state.calls).toEqual([]);
  });

  it('refuses a main request whose testedSha differs from headSha or is off main', async () => {
    const api = mainWorld();
    api.state.compares.set(`${HEAD_SHA}...main`, { status: 'diverged' });
    const decision = await evaluate(api, { mode: 'main-deploy', request: mainRequest() });
    expect(codes(decision)).toEqual(['revision-mismatch']);
    expect(decision.refusals[0].message).toContain('not an ancestor of main');
  });

  it('refuses two check runs claiming the same tuple and attempt', async () => {
    const api = prWorld({ checkRuns: [checkRun(localResult(), { id: 9003 })] });
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['evidence-tuple-mismatch']);
  });

  it('refuses a local check that did not conclude successfully', async () => {
    const api = prWorld({
      evidence: null,
      checkRuns: [checkRun(localResult(), { conclusion: 'failure' })],
    });
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['evidence-not-successful']);
  });
});

describe('release gate evaluation: hosted fallback', () => {
  it('accepts approved fallback evidence from the fixed fallback workflow id', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    const decision = await evaluate(api);
    expect(decision.refusals).toEqual([]);
    expect(decision.ok).toBe(true);
    expect(decision.evidenceSource).toBe('hosted-fallback');
  });

  it('refuses fallback evidence without an approved CI fallback review', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.approvals.set(FALLBACK_RUN_ID, [{ state: 'approved', environments: ['Staging'] }]);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['fallback-unapproved']);
  });

  it('refuses fallback evidence without a successful CI fallback deployment record', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.deploymentStatuses.set(61, [{ state: 'failure', logUrl: null }]);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['fallback-unapproved']);
    expect(decision.refusals[0].message).toContain('deployment record');
  });

  it('refuses fallback evidence produced by a different workflow id', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api, OTHER_WORKFLOW_ID);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['fallback-workflow-mismatch']);
  });

  it('refuses a fallback check that is not attached to the run it claims', async () => {
    const api = prWorld({
      evidence: null,
      checkRuns: [
        checkRun(fallbackResult(), { detailsUrl: 'https://github.com/x/actions/runs/1' }),
      ],
    });
    approveFallback(api);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['fallback-workflow-mismatch']);
  });

  it('refuses a fallback run that was not a completed successful workflow_dispatch', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.workflowRuns = api.state.workflowRuns.map((run) =>
      run.id === FALLBACK_RUN_ID ? { ...run, event: 'push' } : run,
    );
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['fallback-workflow-mismatch']);
  });

  it('refuses fallback evidence published by an app other than GitHub Actions', async () => {
    const api = prWorld({
      evidence: null,
      checkRuns: [checkRun(fallbackResult(), { appId: ACTIONS_APP_ID + 1 })],
    });
    approveFallback(api);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['evidence-app-mismatch']);
  });

  it('refuses a check run pointing at an approved run that tested a different tuple', async () => {
    // The check run (details_url, runId) is caller-controlled; the run's artifact name is not.
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.artifacts.set(FALLBACK_RUN_ID, [
      { id: 1, name: `hosted-fallback-evidence-${OTHER_SHA}-1`, expired: false },
    ]);
    const decision = await evaluate(api);
    expect(decision.ok).toBe(false);
    expect(codes(decision)).toEqual(['fallback-run-mismatch']);
    expect(decision.refusals[0].message).toContain('different tuple');
    expect(api.state.calls).not.toContain('listRunApprovals');
  });

  it('refuses an approved run for the same head but another attempt', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.artifacts.set(FALLBACK_RUN_ID, [
      { id: 1, name: `hosted-fallback-evidence-${HEAD_SHA}-2`, expired: false },
    ]);
    const decision = await evaluate(api);
    expect(codes(decision)).toEqual(['fallback-run-mismatch']);
  });

  it('refuses a run without any evidence artifact, and one with duplicates', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.artifacts.set(FALLBACK_RUN_ID, [
      { id: 1, name: 'playwright-report', expired: false },
    ]);
    expect(codes(await evaluate(api))).toEqual(['fallback-run-mismatch']);

    api.state.artifacts.set(FALLBACK_RUN_ID, [
      { id: 1, name: FALLBACK_ARTIFACT_NAME, expired: false },
      { id: 2, name: FALLBACK_ARTIFACT_NAME, expired: false },
    ]);
    const duplicate = await evaluate(api);
    expect(codes(duplicate)).toEqual(['fallback-run-mismatch']);
    expect(duplicate.refusals[0].message).toContain('found 2');
  });

  it('refuses an expired evidence artifact as stale', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.artifacts.set(FALLBACK_RUN_ID, [
      { id: 1, name: FALLBACK_ARTIFACT_NAME, expired: true },
    ]);
    expect(codes(await evaluate(api))).toEqual(['stale']);
  });

  it('refuses a run created before the head commit or with unknown timestamps', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    const setCreated = (createdAt: string | null) => {
      api.state.workflowRuns = api.state.workflowRuns.map((run) =>
        run.id === FALLBACK_RUN_ID ? { ...run, createdAt } : run,
      );
    };
    setCreated('2026-09-05T08:00:00.000Z');
    const early = await evaluate(api);
    expect(codes(early)).toEqual(['fallback-run-mismatch']);
    expect(early.refusals[0].message).toContain('not created after the head commit');

    setCreated(HEAD_COMMITTED_AT);
    expect(codes(await evaluate(api))).toEqual(['fallback-run-mismatch']);

    setCreated(null);
    expect(codes(await evaluate(api))).toEqual(['fallback-run-mismatch']);

    setCreated('2026-09-05T10:30:00.000Z');
    api.state.commits.set(HEAD_SHA, { sha: HEAD_SHA, parents: [BASE_SHA], committedAt: null });
    expect(codes(await evaluate(api))).toEqual(['fallback-run-mismatch']);

    api.state.commits.delete(HEAD_SHA);
    const missing = await evaluate(api);
    expect(codes(missing)).toEqual(['fallback-run-mismatch']);
    expect(missing.refusals[0].message).toContain('not found');
  });

  it('refuses when the same run is claimed by check runs for two tuples', async () => {
    const api = prWorld({
      evidence: fallbackResult(),
      checkRuns: [checkRun(fallbackResult(prTuple({ attempt: 2 })), { id: 9003 })],
    });
    approveFallback(api);
    const decision = await evaluate(api);
    expect(codes(decision)).toContain('fallback-run-mismatch');
    expect(decision.refusals.map((refusal) => refusal.message)).toContain(
      `fallback run ${FALLBACK_RUN_ID} is referenced by check runs for different tuples`,
    );
    expect(api.state.calls).not.toContain('listRunApprovals');
  });

  it('refuses on artifact API errors instead of passing', async () => {
    const api = prWorld({ evidence: fallbackResult() });
    approveFallback(api);
    api.state.failures.add('listRunArtifacts');
    expect(codes(await evaluate(api))).toEqual(['api-error']);
  });

  it('prefers local evidence and ignores fallback when both exist', async () => {
    const api = prWorld({ checkRuns: [checkRun(fallbackResult())] });
    approveFallback(api);
    const decision = await evaluate(api);
    expect(decision.evidenceSource).toBe('local');
    expect(api.state.calls).not.toContain('listRunApprovals');
  });
});
