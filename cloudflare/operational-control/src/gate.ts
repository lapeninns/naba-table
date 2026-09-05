import { LOCAL_CHECK_NAME_PREFIX, SERVICE_NAME } from './contracts';
import { parseCiRequestTuple } from './webhook';

import type { ControlPlaneConfig } from './config';
import type { CiRequestTuple } from './contracts';
import type { GitHubClient, WorkflowRunSummary } from './github';

export type GateDispatchOutcome =
  | { readonly result: 'dispatched'; readonly workflowId: string; readonly ref: string }
  | { readonly result: 'rejected'; readonly reason: string }
  | { readonly result: 'not_ready'; readonly reason: string };

export function tuplesEqual(left: CiRequestTuple, right: CiRequestTuple): boolean {
  return (
    left.repositoryId === right.repositoryId &&
    left.profile === right.profile &&
    left.prNumber === right.prNumber &&
    left.headSha === right.headSha &&
    left.baseSha === right.baseSha &&
    left.testedSha === right.testedSha &&
    left.policyVersion === right.policyVersion &&
    left.imageDigest === right.imageDigest &&
    left.controllerVersion === right.controllerVersion &&
    left.attempt === right.attempt
  );
}

function latestRun(runs: readonly WorkflowRunSummary[]): WorkflowRunSummary | null {
  let latest: WorkflowRunSummary | null = null;
  for (const run of runs) {
    if (
      !latest ||
      run.id > latest.id ||
      (run.id === latest.id && run.runAttempt > latest.runAttempt)
    ) {
      latest = run;
    }
  }
  return latest;
}

async function readbackLocalCheck(
  client: GitHubClient,
  config: ControlPlaneConfig,
  tuple: CiRequestTuple,
): Promise<GateDispatchOutcome | null> {
  const checkRuns = await client.listCheckRunsForRef(tuple.headSha);
  const expectedName = `${LOCAL_CHECK_NAME_PREFIX}${tuple.profile}`;
  const local = checkRuns.find(
    (run) => run.name === expectedName && run.appId === config.localCiAppId,
  );
  if (!local) return { result: 'not_ready', reason: 'local_check_missing' };
  if (local.status !== 'completed')
    return { result: 'not_ready', reason: 'local_check_incomplete' };
  if (local.conclusion !== 'success')
    return { result: 'rejected', reason: 'local_check_not_successful' };
  const readbackTuple = parseCiRequestTuple(local.externalId, config);
  if (!readbackTuple || !tuplesEqual(readbackTuple, tuple)) {
    return { result: 'rejected', reason: 'local_check_tuple_mismatch' };
  }
  return null;
}

async function readbackPullRequest(
  client: GitHubClient,
  tuple: CiRequestTuple,
): Promise<GateDispatchOutcome | null> {
  if (tuple.profile !== 'pr' || tuple.prNumber === undefined) return null;
  const pullRequest = await client.getPullRequest(tuple.prNumber);
  if (pullRequest.state !== 'open') return { result: 'rejected', reason: 'pull_request_not_open' };
  if (pullRequest.draft) return { result: 'rejected', reason: 'pull_request_draft' };
  if (pullRequest.baseRef !== 'main')
    return { result: 'rejected', reason: 'pull_request_wrong_base' };
  if (pullRequest.headSha !== tuple.headSha)
    return { result: 'rejected', reason: 'pull_request_head_moved' };
  if (pullRequest.baseSha !== tuple.baseSha)
    return { result: 'rejected', reason: 'pull_request_base_moved' };
  return null;
}

async function readbackHostedRuns(
  client: GitHubClient,
  config: ControlPlaneConfig,
  tuple: CiRequestTuple,
): Promise<GateDispatchOutcome | null> {
  const runs = await client.listWorkflowRunsForSha(tuple.headSha);
  for (const path of config.requiredHostedWorkflows) {
    const run = latestRun(
      runs.filter((entry) => entry.path === path && entry.headSha === tuple.headSha),
    );
    if (!run) return { result: 'not_ready', reason: `hosted_run_missing:${path}` };
    if (run.status !== 'completed')
      return { result: 'not_ready', reason: `hosted_run_incomplete:${path}` };
    if (run.conclusion !== 'success')
      return { result: 'rejected', reason: `hosted_run_not_successful:${path}` };
  }
  return null;
}

/**
 * The `workflow_dispatch` inputs of `.github/workflows/release-gate.yml`, one discrete input per
 * declared key. GitHub rejects undeclared inputs with 422, so this list must stay identical to
 * `on.workflow_dispatch.inputs` in the workflow; tests/scripts/ci/phase1/lane-contracts.test.ts
 * enforces that. The workflow derives `profile`/`mode` from whether `pr_number` is set.
 */
export function gateDispatchInputs(tuple: CiRequestTuple): Readonly<Record<string, string>> {
  return {
    repository_id: tuple.repositoryId,
    pr_number: tuple.prNumber === undefined ? '' : String(tuple.prNumber),
    head_sha: tuple.headSha,
    base_sha: tuple.baseSha,
    tested_sha: tuple.testedSha,
    attempt: String(tuple.attempt),
    requested_by: SERVICE_NAME,
  };
}

/**
 * Authoritative readback followed by a single gate dispatch. Webhook payloads only wake this
 * path; every success signal is re-read from the GitHub API before the dispatch is issued.
 */
export async function readbackAndDispatchGate(input: {
  readonly client: GitHubClient;
  readonly config: ControlPlaneConfig;
  readonly tuple: CiRequestTuple;
}): Promise<GateDispatchOutcome> {
  const { client, config, tuple } = input;
  const blocked =
    (await readbackLocalCheck(client, config, tuple)) ??
    (await readbackPullRequest(client, tuple)) ??
    (await readbackHostedRuns(client, config, tuple));
  if (blocked) return blocked;

  await client.dispatchWorkflow({
    workflowId: config.gateWorkflowId,
    ref: config.protectedRef,
    inputs: gateDispatchInputs(tuple),
  });
  return { result: 'dispatched', workflowId: config.gateWorkflowId, ref: config.protectedRef };
}
