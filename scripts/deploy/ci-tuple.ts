import { isRecord } from './evidence';

/** CI request tuple shared with the controller/executor/gate workstreams. */
export type CiRequestTuple = {
  readonly repositoryId: string;
  readonly profile: 'pr' | 'main' | 'nightly';
  readonly prNumber?: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly testedSha: string;
  readonly policyVersion: string;
  readonly imageDigest: string;
  readonly controllerVersion: string;
  readonly attempt: number;
};

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const PROFILES = new Set(['pr', 'main', 'nightly']);

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`CI tuple: "${key}" is required.`);
  }
  return value.trim();
}

export function parseCiTuple(value: unknown): CiRequestTuple {
  if (!isRecord(value)) throw new Error('CI tuple: expected an object.');
  const repositoryId = readString(value, 'repositoryId');
  const profile = readString(value, 'profile');
  if (!PROFILES.has(profile)) throw new Error(`CI tuple: unknown profile "${profile}".`);
  const shas = {
    headSha: readString(value, 'headSha'),
    baseSha: readString(value, 'baseSha'),
    testedSha: readString(value, 'testedSha'),
  };
  for (const [key, sha] of Object.entries(shas)) {
    if (!SHA_PATTERN.test(sha)) throw new Error(`CI tuple: "${key}" must be a 40-hex SHA.`);
  }
  const attemptRaw = value.attempt;
  const attempt = typeof attemptRaw === 'string' ? Number(attemptRaw) : attemptRaw;
  if (typeof attempt !== 'number' || !Number.isInteger(attempt) || attempt < 1) {
    throw new Error('CI tuple: "attempt" must be a positive integer.');
  }
  const prNumberRaw = value.prNumber;
  const prNumber =
    prNumberRaw === undefined || prNumberRaw === null
      ? undefined
      : typeof prNumberRaw === 'string'
        ? Number(prNumberRaw)
        : prNumberRaw;
  if (prNumber !== undefined && (typeof prNumber !== 'number' || !Number.isInteger(prNumber))) {
    throw new Error('CI tuple: "prNumber" must be an integer when present.');
  }
  return {
    repositoryId,
    profile: profile as CiRequestTuple['profile'],
    ...(prNumber === undefined ? {} : { prNumber }),
    ...shas,
    policyVersion: readString(value, 'policyVersion'),
    imageDigest: readString(value, 'imageDigest'),
    controllerVersion: readString(value, 'controllerVersion'),
    attempt,
  };
}

/** Stable identity string: key-sorted JSON so equal tuples compare equal. */
export function canonicalTuple(tuple: CiRequestTuple): string {
  const sorted = Object.fromEntries(
    Object.entries(tuple)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(sorted);
}

export function sameTuple(a: CiRequestTuple, b: CiRequestTuple): boolean {
  return canonicalTuple(a) === canonicalTuple(b);
}
