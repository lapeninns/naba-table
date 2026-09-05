import {
  extractCiResultDocument,
  parseCiResult,
  type CiResult,
  type SuiteResult,
} from './ci-result';
import type { CheckRunRecord, GateGitHubApi, WorkflowRunRecord } from './github-api';
import {
  compatibilityChecksForProfile,
  type CiPolicy,
  type GateMode,
  type PolicyResolution,
} from './policy';
import {
  FALLBACK_EVIDENCE_ARTIFACT_PREFIX,
  fallbackEvidenceArtifactName,
  isCiProfile,
  isCommitSha,
  tupleKey,
  type CiProfile,
  type CiRequestTuple,
} from './tuple';

/**
 * Release gate evaluation. Pure with respect to I/O: every GitHub read goes
 * through the injected `GateGitHubApi`, and the clock is injected so freshness
 * can be tested deterministically. Every refusal carries a stable code so the
 * runbook can map it to an operator action.
 */

export type GateRequest = {
  repositoryId: number;
  profile: CiProfile;
  prNumber?: number;
  headSha: string;
  baseSha: string;
  testedSha: string;
  attempt: number;
  requestedBy?: string;
};

export type GateRequestParse = { ok: true; request: GateRequest } | { ok: false; errors: string[] };

export type GateRefusalCode =
  | 'input-invalid'
  | 'policy-invalid'
  | 'policy-unconfigured'
  | 'repository-mismatch'
  | 'revision-mismatch'
  | 'superseded'
  | 'evidence-missing'
  | 'evidence-app-mismatch'
  | 'evidence-installation-mismatch'
  | 'evidence-attempt-mismatch'
  | 'evidence-tuple-mismatch'
  | 'evidence-invalid'
  | 'evidence-not-successful'
  | 'evidence-version-rejected'
  | 'suite-inventory-incomplete'
  | 'suite-failed'
  | 'suite-skipped'
  | 'coverage-failed'
  | 'hosted-workflow-missing'
  | 'hosted-workflow-failed'
  | 'hosted-job-missing'
  | 'hosted-job-skipped'
  | 'fallback-unapproved'
  | 'fallback-workflow-mismatch'
  | 'fallback-run-mismatch'
  | 'stale'
  | 'api-error';

export type GateRefusal = { code: GateRefusalCode; message: string };

export type GateSuiteSummary = {
  suiteId: string;
  name: string;
  status: SuiteResult['status'];
  evidenceDigest: string;
};

export type GateDecision = {
  ok: boolean;
  mode: GateMode;
  request: GateRequest;
  tuple: CiRequestTuple | null;
  tupleKey: string | null;
  policyVersion: string;
  evidenceSource: 'local' | 'hosted-fallback' | null;
  evidenceLocation: string | null;
  evaluatedAt: string;
  refusals: GateRefusal[];
  suites: GateSuiteSummary[];
  compatibility: Array<{
    checkName: string;
    suiteId: string;
    /** True when a changed-path rule in the profile may skip this suite legitimately. */
    conditional: boolean;
    status: SuiteResult['status'] | 'missing';
  }>;
  hostedWorkflows: Array<{ displayName: string; runId: number | null; conclusion: string | null }>;
  /**
   * False when the failure is foundational (bad input, wrong repository, broken
   * policy): publishing a check on a SHA we could not even bind to this repository
   * would be meaningless.
   */
  publishable: boolean;
};

export type EvaluateOptions = {
  api: GateGitHubApi;
  policy: PolicyResolution;
  request: GateRequest;
  mode: GateMode;
  now?: () => Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value)) return Number(value);
  return null;
}

/** Parses workflow inputs (all strings) or a JSON object into a GateRequest. */
export function parseGateRequest(input: unknown): GateRequestParse {
  if (!isRecord(input)) return { ok: false, errors: ['request must be an object'] };
  const errors: string[] = [];
  const repositoryId = toPositiveInteger(input.repositoryId);
  if (repositoryId === null) errors.push('repositoryId must be a positive integer');
  let prNumber: number | undefined;
  if (input.prNumber !== undefined && input.prNumber !== null && input.prNumber !== '') {
    const parsed = toPositiveInteger(input.prNumber);
    if (parsed === null) errors.push('prNumber must be a positive integer when present');
    else prNumber = parsed;
  }
  let profile: CiProfile | null = null;
  if (input.profile === undefined || input.profile === '') {
    profile = prNumber === undefined ? 'main' : 'pr';
  } else if (isCiProfile(input.profile)) {
    profile = input.profile;
  } else {
    errors.push('profile must be pr|main|nightly when present');
  }
  if (profile === 'pr' && prNumber === undefined) errors.push('pr profile requires prNumber');
  if (profile !== null && profile !== 'pr' && prNumber !== undefined) {
    errors.push(`${profile} profile must not carry prNumber`);
  }
  for (const field of ['headSha', 'baseSha', 'testedSha'] as const) {
    if (!isCommitSha(input[field]))
      errors.push(`${field} must be a 40-character lowercase hex SHA`);
  }
  const attempt = toPositiveInteger(input.attempt);
  if (attempt === null) errors.push('attempt must be a positive integer');
  let requestedBy: string | undefined;
  if (input.requestedBy !== undefined && input.requestedBy !== '') {
    if (typeof input.requestedBy !== 'string' || !/^[\w.@[\]-]{1,80}$/.test(input.requestedBy)) {
      errors.push('requestedBy must be a short login-like string when present');
    } else {
      requestedBy = input.requestedBy;
    }
  }
  if (errors.length > 0 || repositoryId === null || attempt === null || profile === null) {
    return { ok: false, errors };
  }
  const request: GateRequest = {
    repositoryId,
    profile,
    headSha: input.headSha as string,
    baseSha: input.baseSha as string,
    testedSha: input.testedSha as string,
    attempt,
  };
  if (prNumber !== undefined) request.prNumber = prNumber;
  if (requestedBy !== undefined) request.requestedBy = requestedBy;
  return { ok: true, request };
}

export function tupleMatchesRequest(tuple: CiRequestTuple, request: GateRequest): boolean {
  return (
    tuple.repositoryId === request.repositoryId &&
    tuple.profile === request.profile &&
    (tuple.prNumber ?? null) === (request.prNumber ?? null) &&
    tuple.headSha === request.headSha &&
    tuple.baseSha === request.baseSha &&
    tuple.testedSha === request.testedSha &&
    tuple.attempt === request.attempt
  );
}

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 3_600_000;
}

type Ctx = {
  api: GateGitHubApi;
  policy: CiPolicy;
  request: GateRequest;
  mode: GateMode;
  now: Date;
  refusals: GateRefusal[];
};

function refuse(ctx: Ctx, code: GateRefusalCode, message: string): void {
  ctx.refusals.push({ code, message });
}

async function guarded<T>(ctx: Ctx, label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    refuse(ctx, 'api-error', `${label}: ${message}`);
    return null;
  }
}

async function verifyRepository(ctx: Ctx): Promise<boolean> {
  const repository = await guarded(ctx, 'repository lookup', () => ctx.api.getRepository());
  if (!repository) return false;
  if (repository.id !== ctx.request.repositoryId) {
    refuse(
      ctx,
      'repository-mismatch',
      `request repositoryId ${ctx.request.repositoryId} does not match this repository (${repository.id})`,
    );
    return false;
  }
  if (ctx.policy.repositoryId !== repository.id) {
    refuse(
      ctx,
      'repository-mismatch',
      `policy repositoryId ${ctx.policy.repositoryId} does not match this repository (${repository.id})`,
    );
    return false;
  }
  return true;
}

async function verifyRevision(ctx: Ctx): Promise<boolean> {
  const { request, policy } = ctx;
  if (ctx.mode === 'merge') {
    if (request.prNumber === undefined) {
      refuse(ctx, 'input-invalid', 'merge mode requires prNumber');
      return false;
    }
    const pr = await guarded(ctx, 'pull request lookup', () =>
      ctx.api.getPullRequest(request.prNumber as number),
    );
    if (pr === null) {
      if (ctx.refusals.length === 0)
        refuse(ctx, 'revision-mismatch', `pull request #${request.prNumber} not found`);
      return false;
    }
    let ok = true;
    if (pr.state !== 'open') {
      refuse(ctx, 'revision-mismatch', `pull request #${pr.number} is ${pr.state}`);
      ok = false;
    }
    if (pr.baseRepoId !== request.repositoryId) {
      refuse(
        ctx,
        'repository-mismatch',
        'pull request base repository differs from this repository',
      );
      ok = false;
    }
    if (pr.headRepoId !== request.repositoryId) {
      // Forks never run outside the secret-less Fork profile; the gate must not
      // merge a fork head on local or hosted-fallback evidence.
      refuse(
        ctx,
        'repository-mismatch',
        'pull request head repository differs from this repository (forks are never gated)',
      );
      ok = false;
    }
    if (pr.baseRef !== policy.protectedBranch) {
      refuse(
        ctx,
        'revision-mismatch',
        `pull request targets ${pr.baseRef}, not ${policy.protectedBranch}`,
      );
      ok = false;
    }
    if (pr.headSha !== request.headSha) {
      refuse(
        ctx,
        'superseded',
        `pull request head is ${pr.headSha}, request head is ${request.headSha}`,
      );
      ok = false;
    }
    if (pr.baseSha !== request.baseSha) {
      refuse(
        ctx,
        'revision-mismatch',
        `pull request base is ${pr.baseSha}, request base is ${request.baseSha}`,
      );
      ok = false;
    }
    if (pr.mergeCommitSha === null) {
      refuse(
        ctx,
        'revision-mismatch',
        'pull request has no merge commit (conflicting or not yet computed)',
      );
      ok = false;
    } else if (pr.mergeCommitSha !== request.testedSha) {
      refuse(
        ctx,
        'revision-mismatch',
        `merge commit is ${pr.mergeCommitSha}, request testedSha is ${request.testedSha}`,
      );
      ok = false;
    }
    return ok;
  }

  let ok = true;
  if (request.testedSha !== request.headSha) {
    refuse(
      ctx,
      'revision-mismatch',
      'main requests must use the merged commit as both headSha and testedSha',
    );
    ok = false;
  }
  const commit = await guarded(ctx, 'commit lookup', () => ctx.api.getCommit(request.testedSha));
  if (commit === null) {
    if (ctx.refusals.every((entry) => entry.code !== 'api-error')) {
      refuse(ctx, 'revision-mismatch', `commit ${request.testedSha} not found in this repository`);
    }
    return false;
  }
  if (commit.parents[0] !== request.baseSha) {
    refuse(
      ctx,
      'revision-mismatch',
      `first parent of ${request.testedSha} is not ${request.baseSha}`,
    );
    ok = false;
  }
  const compare = await guarded(ctx, 'branch comparison', () =>
    ctx.api.compareCommits(request.testedSha, policy.protectedBranch),
  );
  if (compare === null) return false;
  if (compare.status !== 'identical' && compare.status !== 'ahead') {
    refuse(
      ctx,
      'revision-mismatch',
      `${request.testedSha} is not an ancestor of ${policy.protectedBranch} (${compare.status})`,
    );
    ok = false;
  }
  return ok;
}

type EvidenceOutcome = {
  result: CiResult;
  checkRun: CheckRunRecord;
  source: 'local' | 'hosted-fallback';
} | null;

function selectCheckRun(
  ctx: Ctx,
  runs: CheckRunRecord[],
  expectedAppId: number,
  label: string,
): { checkRun: CheckRunRecord; result: CiResult } | null {
  if (runs.length === 0) return null;
  const fromApp = runs.filter((run) => run.appId === expectedAppId);
  if (fromApp.length === 0) {
    refuse(
      ctx,
      'evidence-app-mismatch',
      `${label} check runs exist but none were created by app ${expectedAppId}`,
    );
    return null;
  }
  const candidates: Array<{ checkRun: CheckRunRecord; result: CiResult }> = [];
  for (const checkRun of fromApp) {
    const document = extractCiResultDocument(checkRun.outputText);
    const parsed = parseCiResult(document);
    if (!parsed.ok) {
      refuse(
        ctx,
        'evidence-invalid',
        `${label} check run ${checkRun.id}: ${parsed.errors.join('; ')}`,
      );
      continue;
    }
    if (!tupleMatchesRequest(parsed.result.tuple, ctx.request)) {
      if (parsed.result.tuple.attempt !== ctx.request.attempt) {
        refuse(
          ctx,
          'evidence-attempt-mismatch',
          `${label} check run ${checkRun.id} is attempt ${parsed.result.tuple.attempt}, request is attempt ${ctx.request.attempt}`,
        );
      } else {
        refuse(
          ctx,
          'evidence-tuple-mismatch',
          `${label} check run ${checkRun.id} was produced for a different tuple`,
        );
      }
      continue;
    }
    if (checkRun.externalId !== tupleKey(parsed.result.tuple)) {
      refuse(
        ctx,
        'evidence-tuple-mismatch',
        `${label} check run ${checkRun.id} external_id is not bound to its tuple`,
      );
      continue;
    }
    candidates.push({ checkRun, result: parsed.result });
  }
  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    refuse(
      ctx,
      'evidence-tuple-mismatch',
      `${label}: ${candidates.length} check runs claim the same tuple and attempt`,
    );
    return null;
  }
  const [candidate] = candidates;
  if (candidate.checkRun.status !== 'completed' || candidate.checkRun.conclusion !== 'success') {
    refuse(
      ctx,
      'evidence-not-successful',
      `${label} check run ${candidate.checkRun.id} concluded ${candidate.checkRun.conclusion ?? candidate.checkRun.status}`,
    );
    return null;
  }
  return candidate;
}

/**
 * Refuses when another Actions-app check run on the same head claims the same
 * fallback run for a different tuple key. A run tests exactly one tuple, so two
 * tuple keys pointing at it means at least one check run is forged.
 */
function runReferencedByOtherTuple(
  siblings: CheckRunRecord[],
  checkRun: CheckRunRecord,
  runId: number,
): boolean {
  return siblings.some((sibling) => {
    if (sibling.id === checkRun.id || sibling.externalId === checkRun.externalId) return false;
    const parsed = parseCiResult(extractCiResultDocument(sibling.outputText));
    return parsed.ok && parsed.result.runId === runId;
  });
}

function isAfter(later: string | null, earlier: string | null): boolean {
  if (later === null || earlier === null) return false;
  const laterMs = new Date(later).getTime();
  const earlierMs = new Date(earlier).getTime();
  return !Number.isNaN(laterMs) && !Number.isNaN(earlierMs) && laterMs > earlierMs;
}

/**
 * Binds the referenced workflow run to the request tuple using data only the
 * trusted workflow definition on main can produce: the evidence artifact name
 * (fixed by the workflow from its inputs) and the run's creation time relative
 * to the head commit. `details_url` and the document's `runId` are written by
 * whoever created the check run and are only a secondary condition.
 */
async function verifyFallbackRunBinding(
  ctx: Ctx,
  runId: number,
  run: WorkflowRunRecord,
): Promise<boolean> {
  const { request } = ctx;
  const artifacts = await guarded(ctx, 'fallback artifacts lookup', () =>
    ctx.api.listRunArtifacts(runId),
  );
  if (artifacts === null) return false;
  const expectedName = fallbackEvidenceArtifactName(request.headSha, request.attempt);
  const evidenceArtifacts = artifacts.filter((artifact) =>
    artifact.name.startsWith(FALLBACK_EVIDENCE_ARTIFACT_PREFIX),
  );
  const foreign = evidenceArtifacts.filter((artifact) => artifact.name !== expectedName);
  if (foreign.length > 0) {
    refuse(
      ctx,
      'fallback-run-mismatch',
      `fallback run ${runId} carries evidence for a different tuple (${foreign.length} foreign artifact(s))`,
    );
    return false;
  }
  const bound = evidenceArtifacts.filter((artifact) => artifact.name === expectedName);
  if (bound.length !== 1) {
    refuse(
      ctx,
      'fallback-run-mismatch',
      `fallback run ${runId} does not carry exactly one "${expectedName}" artifact (found ${bound.length})`,
    );
    return false;
  }
  if (bound[0].expired) {
    refuse(ctx, 'stale', `fallback run ${runId} evidence artifact has expired`);
    return false;
  }
  const headCommit = await guarded(ctx, 'head commit lookup', () =>
    ctx.api.getCommit(request.headSha),
  );
  if (headCommit === null) {
    if (ctx.refusals.every((entry) => entry.code !== 'api-error')) {
      refuse(ctx, 'fallback-run-mismatch', `head commit ${request.headSha} not found`);
    }
    return false;
  }
  if (!isAfter(run.createdAt, headCommit.committedAt)) {
    refuse(
      ctx,
      'fallback-run-mismatch',
      `fallback run ${runId} was not created after the head commit (run ${run.createdAt ?? 'unknown'}, commit ${headCommit.committedAt ?? 'unknown'})`,
    );
    return false;
  }
  return true;
}

async function verifyFallbackApproval(
  ctx: Ctx,
  result: CiResult,
  checkRun: CheckRunRecord,
  siblings: CheckRunRecord[],
): Promise<boolean> {
  const { policy } = ctx;
  const runId = result.runId;
  if (runId === undefined) {
    refuse(ctx, 'evidence-invalid', 'fallback evidence does not name its workflow run');
    return false;
  }
  if (policy.fallbackWorkflow.id === null) {
    refuse(ctx, 'policy-unconfigured', 'fallbackWorkflow.id is not configured');
    return false;
  }
  if (!(checkRun.detailsUrl ?? '').includes(`/actions/runs/${runId}`)) {
    refuse(
      ctx,
      'fallback-workflow-mismatch',
      'fallback check run is not attached to the run it claims',
    );
    return false;
  }
  if (runReferencedByOtherTuple(siblings, checkRun, runId)) {
    refuse(
      ctx,
      'fallback-run-mismatch',
      `fallback run ${runId} is referenced by check runs for different tuples`,
    );
    return false;
  }
  const run = await guarded(ctx, 'fallback run lookup', () => ctx.api.getWorkflowRun(runId));
  if (run === null) {
    if (ctx.refusals.every((entry) => entry.code !== 'api-error')) {
      refuse(ctx, 'fallback-workflow-mismatch', `fallback run ${runId} not found`);
    }
    return false;
  }
  if (run.workflowId !== policy.fallbackWorkflow.id) {
    refuse(
      ctx,
      'fallback-workflow-mismatch',
      `run ${runId} belongs to workflow ${run.workflowId}, expected ${policy.fallbackWorkflow.id}`,
    );
    return false;
  }
  if (
    run.event !== 'workflow_dispatch' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  ) {
    refuse(
      ctx,
      'fallback-workflow-mismatch',
      `fallback run ${runId} is ${run.event}/${run.conclusion ?? run.status}`,
    );
    return false;
  }
  if (!(await verifyFallbackRunBinding(ctx, runId, run))) return false;
  const approvals = await guarded(ctx, 'fallback approvals lookup', () =>
    ctx.api.listRunApprovals(runId),
  );
  if (approvals === null) return false;
  const approved = approvals.some(
    (approval) =>
      approval.state === 'approved' &&
      approval.environments.includes(policy.fallbackWorkflow.environment),
  );
  if (!approved) {
    refuse(
      ctx,
      'fallback-unapproved',
      `no approved "${policy.fallbackWorkflow.environment}" review for run ${runId}`,
    );
    return false;
  }
  const deployments = await guarded(ctx, 'fallback deployments lookup', () =>
    ctx.api.listDeployments(policy.fallbackWorkflow.environment),
  );
  if (deployments === null) return false;
  let recorded = false;
  for (const deployment of deployments) {
    const statuses = await guarded(ctx, 'fallback deployment status lookup', () =>
      ctx.api.listDeploymentStatuses(deployment.id),
    );
    if (statuses === null) return false;
    if (
      statuses.some(
        (status) =>
          status.state === 'success' && (status.logUrl ?? '').includes(`/actions/runs/${runId}`),
      )
    ) {
      recorded = true;
      break;
    }
  }
  if (!recorded) {
    refuse(
      ctx,
      'fallback-unapproved',
      `no successful "${policy.fallbackWorkflow.environment}" deployment record for run ${runId}`,
    );
    return false;
  }
  return true;
}

async function locateEvidence(ctx: Ctx): Promise<EvidenceOutcome> {
  const { policy, request } = ctx;
  const localName = `${policy.localCi.checkNamePrefix}${request.profile}`;
  const localRuns = await guarded(ctx, 'local check lookup', () =>
    ctx.api.listCheckRuns(request.headSha, localName),
  );
  if (localRuns === null) return null;
  const exactName = localRuns.filter((run) => run.name === localName);
  if (policy.localCi.appId !== null) {
    const local = selectCheckRun(ctx, exactName, policy.localCi.appId, `"${localName}"`);
    if (local) {
      if (local.result.source !== 'local') {
        refuse(ctx, 'evidence-invalid', 'local check run carries non-local evidence');
        return null;
      }
      if (local.result.installationId !== policy.localCi.installationId) {
        refuse(
          ctx,
          'evidence-installation-mismatch',
          `local evidence installation ${local.result.installationId} is not the pinned installation`,
        );
        return null;
      }
      return { ...local, source: 'local' };
    }
  }
  if (ctx.refusals.length > 0) return null;

  const fallbackName = `${policy.fallbackWorkflow.checkNamePrefix}${request.profile}`;
  const fallbackRuns = await guarded(ctx, 'fallback check lookup', () =>
    ctx.api.listCheckRuns(request.headSha, fallbackName),
  );
  if (fallbackRuns === null) return null;
  const fallbackExact = fallbackRuns.filter((run) => run.name === fallbackName);
  const fallback = selectCheckRun(
    ctx,
    fallbackExact,
    policy.githubActionsAppId,
    `"${fallbackName}"`,
  );
  if (!fallback) {
    if (ctx.refusals.length === 0) {
      refuse(
        ctx,
        'evidence-missing',
        `no "${localName}" or "${fallbackName}" check run on ${request.headSha}`,
      );
    }
    return null;
  }
  if (fallback.result.source !== 'hosted-fallback') {
    refuse(ctx, 'evidence-invalid', 'fallback check run carries non-fallback evidence');
    return null;
  }
  const siblings = fallbackExact.filter((run) => run.appId === policy.githubActionsAppId);
  if (!(await verifyFallbackApproval(ctx, fallback.result, fallback.checkRun, siblings))) {
    return null;
  }
  return { ...fallback, source: 'hosted-fallback' };
}

function verifyVersions(ctx: Ctx, result: CiResult): void {
  const { policy } = ctx;
  const { tuple } = result;
  if (tuple.policyVersion !== policy.policyVersion) {
    refuse(
      ctx,
      'evidence-version-rejected',
      `evidence policyVersion ${tuple.policyVersion} != ${policy.policyVersion}`,
    );
  }
  if (!policy.allowedControllerVersions.includes(tuple.controllerVersion)) {
    refuse(
      ctx,
      'evidence-version-rejected',
      `controllerVersion ${tuple.controllerVersion} is not approved`,
    );
  }
  if (!policy.allowedImageDigests.includes(tuple.imageDigest)) {
    refuse(ctx, 'evidence-version-rejected', 'imageDigest is not an approved executor image');
  }
}

function verifySuites(ctx: Ctx, result: CiResult): void {
  const { requiredSuites, conditionalSuites } = ctx.policy.profiles[ctx.request.profile];
  if (result.suites.length === 0) {
    refuse(ctx, 'suite-inventory-incomplete', 'evidence lists no suites');
    return;
  }
  const byId = new Map(result.suites.map((suite) => [suite.id, suite]));
  for (const suiteId of requiredSuites) {
    const suite = byId.get(suiteId);
    if (!suite) {
      refuse(
        ctx,
        'suite-inventory-incomplete',
        `required suite "${suiteId}" is missing from evidence`,
      );
      continue;
    }
    if (suite.status === 'failed') refuse(ctx, 'suite-failed', `suite "${suiteId}" failed`);
    if (suite.status === 'skipped') {
      refuse(ctx, 'suite-skipped', `required suite "${suiteId}" was skipped`);
    }
  }
  for (const suiteId of conditionalSuites) {
    const suite = byId.get(suiteId);
    if (!suite) {
      refuse(
        ctx,
        'suite-inventory-incomplete',
        `conditional suite "${suiteId}" is missing from evidence (skips must be recorded)`,
      );
      continue;
    }
    if (suite.status === 'failed') refuse(ctx, 'suite-failed', `suite "${suiteId}" failed`);
  }
  for (const suite of result.suites) {
    if (!(suite.id in ctx.policy.suiteInventory)) {
      refuse(
        ctx,
        'suite-inventory-incomplete',
        `suite "${suite.id}" is not in the policy inventory`,
      );
    }
  }
  if (result.coverage.status !== 'passed') refuse(ctx, 'coverage-failed', 'coverage gate failed');
}

async function verifyHostedWorkflows(ctx: Ctx): Promise<GateDecision['hostedWorkflows']> {
  const { policy, request, mode } = ctx;
  const lookupSha = mode === 'merge' ? request.headSha : request.testedSha;
  const expectedEvent = mode === 'merge' ? 'pull_request' : 'push';
  const summary: GateDecision['hostedWorkflows'] = [];
  for (const workflow of policy.requiredHostedWorkflows) {
    if (workflow.id === null) {
      refuse(
        ctx,
        'policy-unconfigured',
        `requiredHostedWorkflows["${workflow.displayName}"].id is not configured`,
      );
      summary.push({ displayName: workflow.displayName, runId: null, conclusion: null });
      continue;
    }
    const runs = await guarded(ctx, `${workflow.displayName} runs lookup`, () =>
      ctx.api.listWorkflowRuns(workflow.id as number, lookupSha),
    );
    if (runs === null) {
      summary.push({ displayName: workflow.displayName, runId: null, conclusion: null });
      continue;
    }
    const matching = runs
      .filter((run) => run.headSha === lookupSha && run.event === expectedEvent)
      .sort((a, b) => b.runNumber - a.runNumber);
    const latest: WorkflowRunRecord | undefined = matching[0];
    if (!latest) {
      refuse(
        ctx,
        'hosted-workflow-missing',
        `no ${expectedEvent} run of "${workflow.displayName}" on ${lookupSha}`,
      );
      summary.push({ displayName: workflow.displayName, runId: null, conclusion: null });
      continue;
    }
    summary.push({
      displayName: workflow.displayName,
      runId: latest.id,
      conclusion: latest.conclusion,
    });
    if (latest.status !== 'completed' || latest.conclusion !== 'success') {
      refuse(
        ctx,
        'hosted-workflow-failed',
        `"${workflow.displayName}" run ${latest.id} concluded ${latest.conclusion ?? latest.status}`,
      );
      continue;
    }
    const jobs = await guarded(ctx, `${workflow.displayName} jobs lookup`, () =>
      ctx.api.listJobs(latest.id),
    );
    if (jobs === null) continue;
    const names = new Set(jobs.map((job) => job.name));
    for (const requiredJob of workflow.requiredJobs) {
      if (!names.has(requiredJob)) {
        refuse(
          ctx,
          'hosted-job-missing',
          `"${workflow.displayName}" run ${latest.id} has no job "${requiredJob}"`,
        );
      }
    }
    for (const job of jobs) {
      if (job.conclusion !== 'success') {
        refuse(
          ctx,
          'hosted-job-skipped',
          `"${workflow.displayName}" job "${job.name}" concluded ${job.conclusion ?? job.status}`,
        );
      }
    }
    const freshness = policy.freshnessHours[mode];
    if (freshness !== null && hoursBetween(ctx.now, new Date(latest.updatedAt)) > freshness) {
      refuse(
        ctx,
        'stale',
        `"${workflow.displayName}" run ${latest.id} is older than ${freshness}h`,
      );
    }
  }
  return summary;
}

function verifyFreshness(ctx: Ctx, result: CiResult, checkRun: CheckRunRecord): void {
  const freshness = ctx.policy.freshnessHours[ctx.mode];
  if (freshness === null) return;
  const completedAt = new Date(result.completedAt);
  if (Number.isNaN(completedAt.getTime()) || hoursBetween(ctx.now, completedAt) > freshness) {
    refuse(ctx, 'stale', `evidence completed at ${result.completedAt} is older than ${freshness}h`);
  }
  if (completedAt.getTime() > ctx.now.getTime() + 5 * 60_000) {
    refuse(ctx, 'evidence-invalid', 'evidence completion time is in the future');
  }
  if (
    checkRun.completedAt !== null &&
    hoursBetween(ctx.now, new Date(checkRun.completedAt)) > freshness
  ) {
    refuse(ctx, 'stale', `check run ${checkRun.id} completed more than ${freshness}h ago`);
  }
}

async function verifyNotSuperseded(ctx: Ctx): Promise<void> {
  if (ctx.mode !== 'merge' || ctx.request.prNumber === undefined) return;
  const pr = await guarded(ctx, 'pull request re-check', () =>
    ctx.api.getPullRequest(ctx.request.prNumber as number),
  );
  if (pr === null) return;
  if (pr.headSha !== ctx.request.headSha) {
    refuse(ctx, 'superseded', `pull request head moved to ${pr.headSha} during evaluation`);
  }
}

function buildSuites(result: CiResult | null): GateSuiteSummary[] {
  if (!result) return [];
  return result.suites.map((suite) => ({
    suiteId: suite.id,
    name: suite.name,
    status: suite.status,
    evidenceDigest: suite.evidenceDigest,
  }));
}

function buildCompatibility(
  policy: CiPolicy,
  profile: CiProfile,
  result: CiResult | null,
): GateDecision['compatibility'] {
  const byId = new Map((result?.suites ?? []).map((suite) => [suite.id, suite]));
  return compatibilityChecksForProfile(policy, profile).map(
    ({ checkName, suiteId, conditional }) => ({
      checkName,
      suiteId,
      conditional,
      status: byId.get(suiteId)?.status ?? 'missing',
    }),
  );
}

export async function evaluateReleaseGate(options: EvaluateOptions): Promise<GateDecision> {
  const now = (options.now ?? (() => new Date()))();
  const { policy, unconfigured, errors } = options.policy;
  const ctx: Ctx = {
    api: options.api,
    policy,
    request: options.request,
    mode: options.mode,
    now,
    refusals: [],
  };

  const base = (): Omit<GateDecision, 'ok' | 'refusals' | 'publishable'> => ({
    mode: options.mode,
    request: options.request,
    tuple: null,
    tupleKey: null,
    policyVersion: policy.policyVersion,
    evidenceSource: null,
    evidenceLocation: null,
    evaluatedAt: now.toISOString(),
    suites: [],
    compatibility: buildCompatibility(policy, options.request.profile, null),
    hostedWorkflows: [],
  });

  if (errors.length > 0) {
    return {
      ...base(),
      ok: false,
      publishable: false,
      refusals: errors.map((message) => ({ code: 'policy-invalid' as const, message })),
    };
  }
  if (unconfigured.length > 0) {
    return {
      ...base(),
      ok: false,
      publishable: false,
      refusals: [
        {
          code: 'policy-unconfigured',
          message: `policy placeholders remain: ${unconfigured.join(', ')}`,
        },
      ],
    };
  }
  if (options.mode === 'merge' && options.request.profile !== 'pr') {
    refuse(ctx, 'input-invalid', 'merge mode requires the pr profile');
  }
  if (options.mode === 'main-deploy' && options.request.profile !== 'main') {
    refuse(ctx, 'input-invalid', 'main-deploy mode requires the main profile');
  }
  if (ctx.refusals.length > 0 || !(await verifyRepository(ctx))) {
    return { ...base(), ok: false, publishable: false, refusals: ctx.refusals };
  }

  const revisionOk = await verifyRevision(ctx);
  const evidence = revisionOk ? await locateEvidence(ctx) : null;
  let hosted: GateDecision['hostedWorkflows'] = [];
  if (evidence) {
    verifyVersions(ctx, evidence.result);
    verifySuites(ctx, evidence.result);
    verifyFreshness(ctx, evidence.result, evidence.checkRun);
  }
  if (revisionOk) {
    hosted = await verifyHostedWorkflows(ctx);
    await verifyNotSuperseded(ctx);
  }

  const result = evidence?.result ?? null;
  return {
    ...base(),
    ok: ctx.refusals.length === 0 && evidence !== null,
    publishable: true,
    refusals: ctx.refusals,
    tuple: result?.tuple ?? null,
    tupleKey: result ? tupleKey(result.tuple) : null,
    evidenceSource: evidence?.source ?? null,
    evidenceLocation: result?.evidence.location ?? null,
    suites: buildSuites(result),
    compatibility: buildCompatibility(policy, options.request.profile, result),
    hostedWorkflows: hosted,
  };
}
