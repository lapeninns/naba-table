import { CiRequestSchema } from '../contracts/request';
import { toValidationIssues } from '../contracts/validation';
import type { CiRequest, RequestEnvelope } from './types';

export class CiRequestError extends Error {
  constructor(
    message: string,
    readonly problems: readonly string[],
  ) {
    super(message);
    this.name = 'CiRequestError';
  }
}

/**
 * Anything that looks like a CLI flag, shell metacharacter or option injection.
 * Request fields are data; none of them is ever allowed to look like a docker
 * flag, even where the contract schema would otherwise accept the string.
 */
const FLAG_LIKE_PATTERN = /^\s*-|[\s;&|`$<>\\"']/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strictly parse an untrusted CI request tuple.
 *
 * Fail closed: the contract schema rejects unknown fields (the only way a PR
 * could smuggle docker flags or environment into the executor), every SHA must
 * be a full lowercase 40-hex commit id, and the repository id must match the
 * configured one.
 */
export function parseCiRequest(input: unknown, expectedRepositoryId: number): CiRequest {
  if (!isRecord(input)) {
    throw new CiRequestError('CI request must be a JSON object', ['not-an-object']);
  }
  const parsed = CiRequestSchema.safeParse(input);
  const problems: string[] = [];
  if (!parsed.success) {
    for (const issue of toValidationIssues(parsed.error)) {
      problems.push(`${issue.path || '<root>'}: ${issue.message}`);
    }
  }
  for (const key of ['policyVersion', 'controllerVersion'] as const) {
    const value = input[key];
    if (typeof value === 'string' && FLAG_LIKE_PATTERN.test(value)) {
      problems.push(`${key} must not look like a flag or contain shell characters`);
    }
  }
  if (parsed.success) {
    if (parsed.data.repositoryId !== expectedRepositoryId) {
      problems.push(
        `repositoryId ${parsed.data.repositoryId} does not match the configured repository`,
      );
    }
    if (parsed.data.profile === 'pr') {
      if (parsed.data.headSha === parsed.data.baseSha) {
        problems.push('pr profile requires headSha and baseSha to differ');
      }
      if (parsed.data.testedSha === parsed.data.baseSha) {
        problems.push('pr profile requires testedSha (synthetic merge) to differ from baseSha');
      }
    }
  }
  if (problems.length > 0 || !parsed.success) {
    throw new CiRequestError(`Invalid CI request: ${problems.join('; ')}`, problems);
  }
  return Object.freeze({ ...parsed.data });
}

/**
 * Accepts either a bare tuple or the controller envelope `{ request, mode,
 * allocation }` written to `--request-file`. Unknown envelope fields are
 * rejected; the allocation, when present, must be a pair of positive numbers.
 */
export function parseRequestEnvelope(
  input: unknown,
  expectedRepositoryId: number,
): RequestEnvelope {
  if (!isRecord(input)) {
    throw new CiRequestError('CI request must be a JSON object', ['not-an-object']);
  }
  if (!('request' in input)) {
    return { request: parseCiRequest(input, expectedRepositoryId), mode: null, allocation: null };
  }
  for (const key of Object.keys(input)) {
    if (key !== 'request' && key !== 'mode' && key !== 'allocation') {
      throw new CiRequestError(`unknown envelope field "${key}"`, ['unknown-envelope-field']);
    }
  }
  const request = parseCiRequest(input.request, expectedRepositoryId);
  let mode: RequestEnvelope['mode'] = null;
  if (input.mode !== undefined && input.mode !== null) {
    if (input.mode !== 'normal' && input.mode !== 'dedicated') {
      throw new CiRequestError('envelope mode must be normal|dedicated', ['invalid-mode']);
    }
    mode = input.mode;
  }
  let allocation: RequestEnvelope['allocation'] = null;
  if (input.allocation !== undefined && input.allocation !== null) {
    const raw = input.allocation;
    if (
      !isRecord(raw) ||
      typeof raw.cpus !== 'number' ||
      typeof raw.memoryGiB !== 'number' ||
      !Number.isFinite(raw.cpus) ||
      !Number.isFinite(raw.memoryGiB) ||
      raw.cpus <= 0 ||
      raw.memoryGiB <= 0 ||
      Object.keys(raw).some((key) => key !== 'cpus' && key !== 'memoryGiB')
    ) {
      throw new CiRequestError(
        'envelope allocation must be { cpus, memoryGiB } with positive numbers',
        ['invalid-allocation'],
      );
    }
    allocation = { cpus: raw.cpus, memoryGiB: raw.memoryGiB };
  }
  return { request, mode, allocation };
}

/** Deterministic job id derived from the tuple; safe for file, volume and container names. */
export function ciJobId(request: CiRequest): string {
  return `ci-${request.profile}-${request.testedSha.slice(0, 12)}-a${request.attempt}`;
}
