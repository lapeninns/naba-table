import type { GateDecision } from './evaluate-core';
import type { CheckRunConclusion, CreateCheckRunInput, GateGitHubApi } from './github-api';
import type { CiPolicy } from './policy';

/**
 * Publishes the gate decision as check runs. The "Release gate" check lands on
 * the head commit and on the tested (merge) commit; compatibility checks mirror
 * the local suite results under the historical hosted job names so branch
 * protection keeps its required-check list unchanged during the transition.
 * Refusals publish failures: the gate never leaves a commit without a verdict
 * once it could bind the request to this repository.
 */

export type PublishedCheck = {
  name: string;
  headSha: string;
  conclusion: CheckRunConclusion;
  id: number;
};

const MAX_TEXT_LENGTH = 60_000;

function describeRefusals(decision: GateDecision): string {
  if (decision.refusals.length === 0) return 'No refusals.';
  return decision.refusals.map((refusal) => `- [${refusal.code}] ${refusal.message}`).join('\n');
}

export function renderDecisionText(decision: GateDecision): string {
  const lines = [
    `Mode: ${decision.mode}`,
    `Profile: ${decision.request.profile}`,
    `Head: ${decision.request.headSha}`,
    `Base: ${decision.request.baseSha}`,
    `Tested: ${decision.request.testedSha}`,
    `Attempt: ${decision.request.attempt}`,
    `Policy version: ${decision.policyVersion}`,
    `Evidence source: ${decision.evidenceSource ?? 'none'}`,
    `Tuple key: ${decision.tupleKey ?? 'unbound'}`,
    `Evaluated at: ${decision.evaluatedAt}`,
    '',
    'Suites:',
    ...(decision.suites.length === 0
      ? ['- none']
      : decision.suites.map(
          (suite) => `- ${suite.suiteId}: ${suite.status} (${suite.evidenceDigest})`,
        )),
    '',
    'Hosted workflows:',
    ...(decision.hostedWorkflows.length === 0
      ? ['- none evaluated']
      : decision.hostedWorkflows.map(
          (workflow) =>
            `- ${workflow.displayName}: run ${workflow.runId ?? 'missing'} -> ${workflow.conclusion ?? 'n/a'}`,
        )),
    '',
    'Refusals:',
    describeRefusals(decision),
  ];
  return lines.join('\n').slice(0, MAX_TEXT_LENGTH);
}

function suiteConclusion(
  compatibility: GateDecision['compatibility'][number],
  gateOk: boolean,
): CheckRunConclusion {
  if (!gateOk) return 'failure';
  if (compatibility.status === 'passed') return 'success';
  // A conditional suite skipped by its changed-path rule is a verified, deliberate skip.
  if (compatibility.status === 'skipped' && compatibility.conditional) return 'success';
  return 'failure';
}

export async function publishGateDecision(
  api: GateGitHubApi,
  policy: CiPolicy,
  decision: GateDecision,
): Promise<PublishedCheck[]> {
  if (!decision.publishable) return [];
  const externalId =
    decision.tupleKey ?? `unbound:${decision.request.headSha}:${decision.request.attempt}`;
  const targets = Array.from(new Set([decision.request.headSha, decision.request.testedSha]));
  const conclusion: CheckRunConclusion = decision.ok ? 'success' : 'failure';
  const text = renderDecisionText(decision);
  const published: PublishedCheck[] = [];

  const inputs: CreateCheckRunInput[] = [];
  for (const headSha of targets) {
    inputs.push({
      name: policy.gateCheckName,
      headSha,
      externalId,
      conclusion,
      title: decision.ok ? 'Release gate passed' : 'Release gate refused',
      summary: decision.ok
        ? `Evidence from ${decision.evidenceSource} verified for attempt ${decision.request.attempt}.`
        : `Refused with ${decision.refusals.length} reason(s). See details.`,
      text,
      detailsUrl: decision.evidenceLocation ?? undefined,
    });
    for (const compatibility of decision.compatibility) {
      const suiteConclusionValue = suiteConclusion(compatibility, decision.ok);
      inputs.push({
        name: compatibility.checkName,
        headSha,
        externalId,
        conclusion: suiteConclusionValue,
        title: `${compatibility.checkName}: ${suiteConclusionValue}`,
        summary: decision.ok
          ? compatibility.status === 'skipped'
            ? `Local suite "${compatibility.suiteId}" was skipped by its changed-path rule; the gate verified the skip.`
            : `Mirrored from local suite "${compatibility.suiteId}" (${compatibility.status}).`
          : 'Release gate refused; compatibility check fails closed.',
        detailsUrl: decision.evidenceLocation ?? undefined,
      });
    }
  }

  for (const input of inputs) {
    const created = await api.createCheckRun(input);
    published.push({
      name: input.name,
      headSha: input.headSha,
      conclusion: input.conclusion,
      id: created.id,
    });
  }
  return published;
}
