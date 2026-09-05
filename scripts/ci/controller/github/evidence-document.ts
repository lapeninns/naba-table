import { createHash } from 'node:crypto';

import { suiteInventory } from '../../profiles/policy-suites';
import { PROFILES } from '../../profiles/registry';
import type { CiRequest, CiResult } from '../types';

/**
 * The evidence document the release gate reads from the local check run
 * (`output.text`). Format owner: `scripts/ci/gate/ci-result.ts`
 * (`nabatable.ci-result/v1`). The controller reproduces the shape here so
 * production code does not import the gate;
 * `tests/scripts/ci/controller/evidence-document.test.ts` proves the output
 * parses with the gate's own parser and that `tupleKey` matches the gate's.
 */
export const EVIDENCE_DOCUMENT_SCHEMA = 'nabatable.ci-result/v1';
export const EVIDENCE_DOCUMENT_MARKER = '<!-- nabatable-ci-result -->';
export const TUPLE_KEY_PREFIX = 'nabatable-ci/v1';

/** The gate only accepts kebab-case suite ids. */
const GATE_SUITE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/**
 * Synthetic suite the executor appends (`scripts/ci/evidence/result.ts`
 * `COVERAGE_SUITE_ID`): passed only when a coverage summary was collected. It
 * feeds `coverage.status` and is not part of the policy suite inventory.
 */
export const EXECUTOR_COVERAGE_SUITE_ID = 'coverage';

export type EvidenceSuiteStatus = 'passed' | 'failed' | 'skipped';

export interface EvidenceSuite {
  readonly id: string;
  readonly name: string;
  readonly status: EvidenceSuiteStatus;
  readonly evidenceDigest: string;
  readonly durationMs: number;
}

export interface EvidenceDocument {
  readonly schema: typeof EVIDENCE_DOCUMENT_SCHEMA;
  readonly source: 'local';
  readonly tuple: CiRequest;
  readonly installationId: number;
  readonly suites: readonly EvidenceSuite[];
  readonly coverage: { readonly status: 'passed' | 'failed'; readonly evidenceDigest: string };
  readonly evidence: { readonly bundleDigest: string };
  readonly startedAt: string;
  readonly completedAt: string;
}

/** Deterministic identity of a tuple; published as the check run `external_id`. */
export function tupleKey(tuple: CiRequest): string {
  return [
    TUPLE_KEY_PREFIX,
    tuple.repositoryId,
    tuple.profile,
    tuple.prNumber ?? 'none',
    tuple.headSha,
    tuple.baseSha,
    tuple.testedSha,
    tuple.policyVersion,
    tuple.imageDigest,
    tuple.controllerVersion,
    tuple.attempt,
  ].join(':');
}

/** sha256 over the canonical `name=digest` lines of every evidence artifact. */
export function evidenceBundleDigest(evidenceDigests: Readonly<Record<string, string>>): string {
  const material = Object.entries(evidenceDigests)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, digest]) => `${name}=${digest}`)
    .join('\n');
  return `sha256:${createHash('sha256').update(material, 'utf8').digest('hex')}`;
}

function suiteStatus(
  outcome: CiResult['timings']['suites'][number]['outcome'],
): EvidenceSuiteStatus {
  if (outcome === 'passed') return 'passed';
  if (outcome === 'skipped') return 'skipped';
  return 'failed';
}

export interface EvidenceBuildFailure {
  readonly ok: false;
  readonly reason: string;
}

export interface EvidenceBuildSuccess {
  readonly ok: true;
  readonly document: EvidenceDocument;
}

/**
 * Projects an executor result onto the gate document. Fails closed when a
 * suite has no evidence digest or an id the gate would reject: an
 * unevidenced suite cannot be published as evidence.
 *
 * The gate refuses any suite that is not in `config/ci/policy.json`
 * `suiteInventory`, which is locked to `scripts/ci/profiles`. Executor-internal
 * suites (`prepare`, the synthetic `coverage` suite) are therefore validated
 * and digested here but not projected into `suites`; conditional suites the
 * executor recorded as skipped stay, because the gate requires the skip to be
 * evidenced.
 */
export function buildEvidenceDocument(input: {
  readonly tuple: CiRequest;
  readonly result: CiResult;
  readonly installationId: number;
}): EvidenceBuildSuccess | EvidenceBuildFailure {
  const { tuple, result, installationId } = input;
  if (!Number.isInteger(installationId) || installationId <= 0) {
    return { ok: false, reason: 'installation id must be a positive integer' };
  }
  if (result.attempt !== tuple.attempt) {
    return { ok: false, reason: `result attempt ${result.attempt} differs from tuple attempt` };
  }
  const bundleDigest = evidenceBundleDigest(result.evidenceDigests);
  const inventory = suiteInventory(PROFILES[tuple.profile]);
  const suites: EvidenceSuite[] = [];
  let coverageSuite: EvidenceSuite | undefined;
  for (const suite of result.timings.suites) {
    if (!GATE_SUITE_ID_PATTERN.test(suite.suiteId)) {
      return { ok: false, reason: `suite id ${suite.suiteId} is not gate-compatible (kebab-case)` };
    }
    const digest = result.evidenceDigests[suite.suiteId];
    if (digest === undefined) {
      return { ok: false, reason: `suite ${suite.suiteId} has no evidence digest` };
    }
    const projected: EvidenceSuite = {
      id: suite.suiteId,
      name: inventory[suite.suiteId] ?? suite.suiteId,
      status: suiteStatus(suite.outcome),
      evidenceDigest: digest,
      durationMs: suite.durationMs,
    };
    if (suite.suiteId === EXECUTOR_COVERAGE_SUITE_ID) {
      coverageSuite = projected;
      continue;
    }
    if (!(suite.suiteId in inventory)) continue; // executor-internal (e.g. prepare)
    suites.push(projected);
  }
  const coverage = {
    status: coverageSuite?.status === 'passed' && result.coverage !== null ? 'passed' : 'failed',
    evidenceDigest: coverageSuite?.evidenceDigest ?? bundleDigest,
  } as const;
  return {
    ok: true,
    document: {
      schema: EVIDENCE_DOCUMENT_SCHEMA,
      source: 'local',
      tuple,
      installationId,
      suites,
      coverage,
      evidence: { bundleDigest },
      startedAt: result.timings.startedAt,
      completedAt: result.timings.finishedAt,
    },
  };
}

export function formatEvidenceDocument(document: EvidenceDocument): string {
  return `${EVIDENCE_DOCUMENT_MARKER}\n\`\`\`json\n${JSON.stringify(document, null, 2)}\n\`\`\`\n`;
}
