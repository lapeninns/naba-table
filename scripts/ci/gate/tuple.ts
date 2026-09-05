/**
 * CI request tuple shared by the local controller, the hosted fallback, and the
 * release gate. Every consumer must validate the tuple with `parseCiRequestTuple`
 * before trusting any of its fields; the gate refuses malformed tuples.
 */

export const CI_PROFILES = ['pr', 'main', 'nightly'] as const;
export type CiProfile = (typeof CI_PROFILES)[number];

export const TUPLE_KEY_PREFIX = 'nabatable-ci/v1';

/**
 * Artifact name the Hosted profile fallback workflow (from protected main)
 * uploads for one tuple. The gate requires a run to carry exactly this artifact
 * before accepting the run as evidence for the tuple, so a check run cannot
 * point at an approved run that tested a different head or attempt.
 */
export const FALLBACK_EVIDENCE_ARTIFACT_PREFIX = 'hosted-fallback-evidence-';

export function fallbackEvidenceArtifactName(headSha: string, attempt: number | string): string {
  return `${FALLBACK_EVIDENCE_ARTIFACT_PREFIX}${headSha}-${attempt}`;
}

export type CiRequestTuple = {
  repositoryId: number;
  profile: CiProfile;
  prNumber?: number;
  headSha: string;
  baseSha: string;
  testedSha: string;
  policyVersion: string;
  imageDigest: string;
  controllerVersion: string;
  attempt: number;
};

export type TupleParseResult =
  | { ok: true; tuple: CiRequestTuple }
  | { ok: false; errors: string[] };

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/;

export function isCiProfile(value: unknown): value is CiProfile {
  return typeof value === 'string' && (CI_PROFILES as readonly string[]).includes(value);
}

export function isCommitSha(value: unknown): value is string {
  return typeof value === 'string' && SHA_PATTERN.test(value);
}

export function isImageDigest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST_PATTERN.test(value);
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value)) return Number(value);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates an untrusted tuple candidate (workflow inputs, check-run payloads,
 * queue messages). Numeric fields accept canonical decimal strings because
 * `workflow_dispatch` inputs arrive as strings.
 */
export function parseCiRequestTuple(input: unknown): TupleParseResult {
  if (!isRecord(input)) return { ok: false, errors: ['tuple must be an object'] };
  const errors: string[] = [];

  const repositoryId = toPositiveInteger(input.repositoryId);
  if (repositoryId === null) errors.push('repositoryId must be a positive integer');

  const profile = input.profile;
  if (!isCiProfile(profile)) errors.push(`profile must be one of ${CI_PROFILES.join('|')}`);

  let prNumber: number | undefined;
  if (input.prNumber !== undefined && input.prNumber !== null && input.prNumber !== '') {
    const parsed = toPositiveInteger(input.prNumber);
    if (parsed === null) errors.push('prNumber must be a positive integer when present');
    else prNumber = parsed;
  }

  for (const field of ['headSha', 'baseSha', 'testedSha'] as const) {
    if (!isCommitSha(input[field]))
      errors.push(`${field} must be a 40-character lowercase hex SHA`);
  }

  if (typeof input.policyVersion !== 'string' || !VERSION_PATTERN.test(input.policyVersion)) {
    errors.push('policyVersion must be a short version string');
  }
  if (!isImageDigest(input.imageDigest)) errors.push('imageDigest must be sha256:<64 hex>');
  if (
    typeof input.controllerVersion !== 'string' ||
    !VERSION_PATTERN.test(input.controllerVersion)
  ) {
    errors.push('controllerVersion must be a short version string');
  }

  const attempt = toPositiveInteger(input.attempt);
  if (attempt === null) errors.push('attempt must be a positive integer');

  if (errors.length > 0 || repositoryId === null || attempt === null || !isCiProfile(profile)) {
    return { ok: false, errors };
  }

  if (profile === 'pr' && prNumber === undefined) {
    return { ok: false, errors: ['pr profile requires prNumber'] };
  }
  if (profile !== 'pr' && prNumber !== undefined) {
    return { ok: false, errors: [`${profile} profile must not carry prNumber`] };
  }

  const tuple: CiRequestTuple = {
    repositoryId,
    profile,
    headSha: input.headSha as string,
    baseSha: input.baseSha as string,
    testedSha: input.testedSha as string,
    policyVersion: input.policyVersion as string,
    imageDigest: input.imageDigest as string,
    controllerVersion: input.controllerVersion as string,
    attempt,
  };
  if (prNumber !== undefined) tuple.prNumber = prNumber;
  return { ok: true, tuple };
}

/**
 * Deterministic identity of a tuple. Check runs publish it as `external_id`
 * so evidence can be bound to exactly one request and attempt.
 */
export function tupleKey(tuple: CiRequestTuple): string {
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

export function tuplesEqual(left: CiRequestTuple, right: CiRequestTuple): boolean {
  return tupleKey(left) === tupleKey(right);
}
