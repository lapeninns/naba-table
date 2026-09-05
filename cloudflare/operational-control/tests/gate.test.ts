import { describe, expect, it } from 'vitest';

import {
  baseEnv,
  BASE_SHA,
  GATE_WORKFLOW_ID,
  HEAD_SHA,
  LOCAL_CI_APP_ID,
  mainTuple,
  REPOSITORY_ID,
  REQUIRED_WORKFLOWS,
  TESTED_SHA,
  tuple,
} from './helpers/fixtures';
import { resolveControlPlaneConfig } from '../src/config';
import { GITHUB_ACTIONS_APP_ID } from '../src/contracts';
import { gateDispatchInputs, readbackAndDispatchGate, tuplesEqual } from '../src/gate';
import { ciRequestTupleKey } from '../src/webhook';

import type { ControlPlaneConfig } from '../src/config';
import type { CiRequestTuple } from '../src/contracts';
import type {
  CheckRunSummary,
  GitHubClient,
  PullRequestSummary,
  WorkflowDispatchRequest,
  WorkflowRunSummary,
} from '../src/github';

const resolved = resolveControlPlaneConfig(baseEnv());
const config: ControlPlaneConfig = resolved.ok
  ? resolved.config
  : (() => {
      throw new Error('fixture env must resolve');
    })();

type FakeGitHub = GitHubClient & {
  checkRuns: CheckRunSummary[];
  pullRequest: PullRequestSummary;
  workflowRuns: WorkflowRunSummary[];
  dispatches: WorkflowDispatchRequest[];
  pullRequestReads: number;
};

function localCheck(t: CiRequestTuple, overrides: Partial<CheckRunSummary> = {}): CheckRunSummary {
  return {
    id: 9001,
    name: `Local CI / ${t.profile}`,
    appId: LOCAL_CI_APP_ID,
    headSha: t.headSha,
    status: 'completed',
    conclusion: 'success',
    externalId: ciRequestTupleKey(t),
    ...overrides,
  };
}

function hostedRun(path: string, overrides: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary {
  const index = REQUIRED_WORKFLOWS.indexOf(path as (typeof REQUIRED_WORKFLOWS)[number]);
  return {
    id: 500 + index,
    workflowId: 7000 + index,
    path,
    headSha: HEAD_SHA,
    status: 'completed',
    conclusion: 'success',
    runAttempt: 1,
    ...overrides,
  };
}

function fakeGitHub(t: CiRequestTuple): FakeGitHub {
  const client: FakeGitHub = {
    checkRuns: [localCheck(t)],
    pullRequest: {
      number: 42,
      state: 'open',
      draft: false,
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      baseRef: 'main',
    },
    workflowRuns: REQUIRED_WORKFLOWS.map((path) => hostedRun(path)),
    dispatches: [],
    pullRequestReads: 0,
    async resolveRepository() {
      return { id: REPOSITORY_ID, fullName: 'nabatable/nabatable' };
    },
    async listCheckRunsForRef() {
      return client.checkRuns;
    },
    async getPullRequest() {
      client.pullRequestReads += 1;
      return client.pullRequest;
    },
    async listWorkflowRunsForSha() {
      return client.workflowRuns;
    },
    async dispatchWorkflow(request) {
      client.dispatches.push(request);
    },
  };
  return client;
}

async function evaluate(client: GitHubClient, t: CiRequestTuple) {
  return readbackAndDispatchGate({ client, config, tuple: t });
}

describe('release gate readback and dispatch', () => {
  it('dispatches exactly once with the fixed gate workflow on refs/heads/main after full readback', async () => {
    const client = fakeGitHub(tuple());
    await expect(evaluate(client, tuple())).resolves.toEqual({
      result: 'dispatched',
      workflowId: GATE_WORKFLOW_ID,
      ref: 'refs/heads/main',
    });
    expect(client.dispatches).toEqual([
      {
        workflowId: GATE_WORKFLOW_ID,
        ref: 'refs/heads/main',
        inputs: {
          repository_id: REPOSITORY_ID,
          pr_number: '42',
          head_sha: HEAD_SHA,
          base_sha: BASE_SHA,
          tested_sha: TESTED_SHA,
          attempt: '1',
          requested_by: 'operational-control',
        },
      },
    ]);
    expect(client.pullRequestReads).toBe(1);
  });

  it('skips the pull request readback for main candidates and dispatches an empty pr_number', async () => {
    const client = fakeGitHub(mainTuple());
    await expect(evaluate(client, mainTuple())).resolves.toMatchObject({ result: 'dispatched' });
    expect(client.pullRequestReads).toBe(0);
    expect(client.dispatches).toHaveLength(1);
    expect(client.dispatches[0]?.inputs).toMatchObject({
      pr_number: '',
      head_sha: HEAD_SHA,
      tested_sha: HEAD_SHA,
    });
  });

  it('builds only the discrete inputs release-gate.yml declares, all as strings', () => {
    const inputs = gateDispatchInputs(tuple({ attempt: 3 }));
    expect(Object.keys(inputs).sort()).toEqual(
      [
        'attempt',
        'base_sha',
        'head_sha',
        'pr_number',
        'repository_id',
        'requested_by',
        'tested_sha',
      ].sort(),
    );
    expect(inputs.attempt).toBe('3');
    for (const [key, value] of Object.entries(inputs)) {
      expect(key).toMatch(/^[a-z][a-z0-9_]{0,63}$/u);
      expect(typeof value).toBe('string');
    }
    expect(inputs).not.toHaveProperty('request');
    expect(inputs).not.toHaveProperty('candidate_key');
    expect(inputs).not.toHaveProperty('dispatched_by');
  });

  it('never trusts the webhook: a missing, incomplete, failed or foreign local check blocks dispatch', async () => {
    const missing = fakeGitHub(tuple());
    missing.checkRuns = [];
    await expect(evaluate(missing, tuple())).resolves.toEqual({
      result: 'not_ready',
      reason: 'local_check_missing',
    });

    const foreignApp = fakeGitHub(tuple());
    foreignApp.checkRuns = [localCheck(tuple(), { appId: GITHUB_ACTIONS_APP_ID })];
    await expect(evaluate(foreignApp, tuple())).resolves.toEqual({
      result: 'not_ready',
      reason: 'local_check_missing',
    });

    const incomplete = fakeGitHub(tuple());
    incomplete.checkRuns = [localCheck(tuple(), { status: 'in_progress', conclusion: null })];
    await expect(evaluate(incomplete, tuple())).resolves.toEqual({
      result: 'not_ready',
      reason: 'local_check_incomplete',
    });

    const failed = fakeGitHub(tuple());
    failed.checkRuns = [localCheck(tuple(), { conclusion: 'failure' })];
    await expect(evaluate(failed, tuple())).resolves.toEqual({
      result: 'rejected',
      reason: 'local_check_not_successful',
    });

    const drifted = fakeGitHub(tuple());
    drifted.checkRuns = [
      localCheck(tuple(), { externalId: ciRequestTupleKey(tuple({ attempt: 2 })) }),
    ];
    await expect(evaluate(drifted, tuple())).resolves.toEqual({
      result: 'rejected',
      reason: 'local_check_tuple_mismatch',
    });

    const legacyJson = fakeGitHub(tuple());
    legacyJson.checkRuns = [localCheck(tuple(), { externalId: JSON.stringify(tuple()) })];
    await expect(evaluate(legacyJson, tuple())).resolves.toEqual({
      result: 'rejected',
      reason: 'local_check_tuple_mismatch',
    });
    for (const client of [missing, foreignApp, incomplete, failed, drifted, legacyJson]) {
      expect(client.dispatches).toHaveLength(0);
    }
  });

  it('rejects when the pull request is closed, draft, retargeted or has moved', async () => {
    const cases: readonly [Partial<PullRequestSummary>, string][] = [
      [{ state: 'closed' }, 'pull_request_not_open'],
      [{ draft: true }, 'pull_request_draft'],
      [{ baseRef: 'release' }, 'pull_request_wrong_base'],
      [{ headSha: 'f'.repeat(40) }, 'pull_request_head_moved'],
      [{ baseSha: 'e'.repeat(40) }, 'pull_request_base_moved'],
    ];
    for (const [overrides, reason] of cases) {
      const client = fakeGitHub(tuple());
      client.pullRequest = { ...client.pullRequest, ...overrides };
      await expect(evaluate(client, tuple())).resolves.toEqual({ result: 'rejected', reason });
      expect(client.dispatches).toHaveLength(0);
    }
  });

  it('requires every hosted workflow to have a successful latest run for the head SHA', async () => {
    // The default list mirrors config/ci/policy.json requiredHostedWorkflows; the
    // scenarios below address entries by path so the list may grow or shrink.
    expect(REQUIRED_WORKFLOWS.length).toBeGreaterThanOrEqual(2);
    const first = REQUIRED_WORKFLOWS[0] as string;
    const last = REQUIRED_WORKFLOWS[REQUIRED_WORKFLOWS.length - 1] as string;
    const replace = (
      runs: readonly WorkflowRunSummary[],
      path: string,
      overrides: Partial<WorkflowRunSummary>,
    ): WorkflowRunSummary[] =>
      runs.map((run) => (run.path === path ? hostedRun(path, overrides) : run));

    const missing = fakeGitHub(tuple());
    missing.workflowRuns = missing.workflowRuns.filter((run) => run.path !== first);
    await expect(evaluate(missing, tuple())).resolves.toEqual({
      result: 'not_ready',
      reason: `hosted_run_missing:${first}`,
    });

    const incomplete = fakeGitHub(tuple());
    incomplete.workflowRuns = replace(incomplete.workflowRuns, last, {
      status: 'in_progress',
      conclusion: null,
    });
    await expect(evaluate(incomplete, tuple())).resolves.toEqual({
      result: 'not_ready',
      reason: `hosted_run_incomplete:${last}`,
    });

    const failed = fakeGitHub(tuple());
    failed.workflowRuns = replace(failed.workflowRuns, last, { conclusion: 'failure' });
    await expect(evaluate(failed, tuple())).resolves.toEqual({
      result: 'rejected',
      reason: `hosted_run_not_successful:${last}`,
    });

    const otherSha = fakeGitHub(tuple());
    otherSha.workflowRuns = replace(otherSha.workflowRuns, first, { headSha: 'f'.repeat(40) });
    await expect(evaluate(otherSha, tuple())).resolves.toEqual({
      result: 'not_ready',
      reason: `hosted_run_missing:${first}`,
    });

    const rerun = fakeGitHub(tuple());
    rerun.workflowRuns = [
      ...rerun.workflowRuns,
      hostedRun(REQUIRED_WORKFLOWS[0], { id: 499, conclusion: 'failure' }),
      hostedRun(REQUIRED_WORKFLOWS[0], { id: 500, runAttempt: 2, conclusion: 'success' }),
    ];
    await expect(evaluate(rerun, tuple())).resolves.toMatchObject({ result: 'dispatched' });
    expect(rerun.dispatches).toHaveLength(1);
  });

  it('compares tuples field by field', () => {
    expect(tuplesEqual(tuple(), tuple())).toBe(true);
    expect(tuplesEqual(tuple(), tuple({ attempt: 2 }))).toBe(false);
    expect(tuplesEqual(tuple(), tuple({ prNumber: 43 }))).toBe(false);
    expect(tuplesEqual(mainTuple(), mainTuple())).toBe(true);
  });
});
