import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Executor configuration.
 *
 * Two sources, both validated and both failing closed:
 *  - `infra/local-ci/operating.json`: VM-side facts (docker context, job
 *    network, proxy address, guest egress script, job uid, keychain item names).
 *  - `config/ci/executor.json` (optional) plus `NABATABLE_CI_*` environment
 *    overrides: per-installation values (repository id, remote URL, spool/job
 *    roots, base image path + digest, job image digest, R2 bucket).
 *
 * Any placeholder or malformed value is reported as a problem; a real run
 * refuses while problems exist, a dry-run prints them.
 */

export const DEFAULT_SECCOMP_PROFILE = 'infra/local-ci/seccomp/ci-job.json';
export const DEFAULT_CONFIG_FILE = 'config/ci/executor.json';
export const DEFAULT_OPERATING_FACTS_FILE = 'infra/local-ci/operating.json';
export const LOG_RETENTION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const LOG_RETENTION_MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
export const R2_OBJECT_TTL_DAYS = 14;
export const DEFAULT_JOB_IMAGE_NAME = 'nabatable/ci-job';

export interface LimaConfig {
  /** Pre-provisioned guest disk image; cold-cloned for every job. */
  readonly baseImagePath: string;
  /** sha256:<hex> of the base image file. Verified before every clone. */
  readonly baseImageDigest: string;
  readonly instancePrefix: string;
  readonly cpus: number;
  readonly memoryGiB: number;
  readonly diskGiB: number;
  /** Path inside the guest that receives the bundle via `limactl copy`. */
  readonly guestSpoolDir: string;
  readonly dockerContext: string;
  /** Docker contexts the executor must never create, use or remove. */
  readonly protectedDockerContexts: readonly string[];
  /** Guest path of infra/local-ci/network/egress.sh. */
  readonly egressScript: string;
}

export interface DockerConfig {
  /** Digest-pinned job image reference, e.g. nabatable/ci-job@sha256:... */
  readonly image: string;
  /** Digest part of `image`; the request tuple's imageDigest must equal it. */
  readonly imageDigest: string;
  /** Host path of the seccomp profile (the docker CLI reads it client-side). */
  readonly seccompProfilePath: string;
  /** Non-root uid:gid the job runs as. */
  readonly user: string;
  /** Name of the pre-created internal job network inside the guest. */
  readonly jobNetwork: string;
  /** Outbound proxy reachable from the job network in phase `prep` only. */
  readonly egressProxyUrl: string;
}

export interface R2Config {
  readonly endpoint: string;
  readonly bucket: string;
  readonly keyPrefix: string;
  readonly region: string;
}

export interface KeychainConfig {
  readonly account: string;
  readonly r2AccessKeyIdService: string;
  readonly r2SecretAccessKeyService: string;
}

export interface ExecutorConfig {
  readonly repositoryId: number;
  readonly sourceRemoteUrl: string;
  readonly spoolRoot: string;
  readonly jobRoot: string;
  readonly lima: LimaConfig;
  readonly docker: DockerConfig;
  readonly r2: R2Config;
  readonly keychain: KeychainConfig;
  readonly retention: { readonly maxAgeMs: number; readonly maxTotalBytes: number };
}

export interface LoadedExecutorConfig {
  readonly config: ExecutorConfig;
  /** Non-empty means "unconfigured": real runs must refuse, dry-runs may still plan. */
  readonly problems: readonly string[];
  readonly source: string;
}

export const PLACEHOLDER_PATTERN = /REPLACE_ME|CHANGE_ME|<[^>]+>|^\s*$/u;
const ZERO_DIGEST = /^sha256:0{64}$/u;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export function isPlaceholder(value: string | undefined): boolean {
  return value === undefined || PLACEHOLDER_PATTERN.test(value) || ZERO_DIGEST.test(value);
}

type RawConfig = Readonly<Record<string, unknown>>;
type Env = Readonly<Record<string, string | undefined>>;

function isRecord(value: unknown): value is RawConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonFile(filePath: string): RawConfig {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
}

function pick(
  env: Env,
  file: RawConfig,
  envName: string,
  fileKey: string,
  fallback: string,
): string {
  const fromEnv = env[envName];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const fromFile = file[fileKey];
  if (typeof fromFile === 'string') return fromFile;
  if (typeof fromFile === 'number') return String(fromFile);
  return fallback;
}

function pickNumber(env: Env, file: RawConfig, envName: string, fileKey: string, fallback: number) {
  const raw = pick(env, file, envName, fileKey, String(fallback));
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Walks `a.b.c` into a JSON object; returns undefined when any segment is missing. */
function dig(record: RawConfig, dotted: string): unknown {
  let current: unknown = record;
  for (const segment of dotted.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function digString(record: RawConfig, dotted: string, problems: string[]): string {
  const value = dig(record, dotted);
  if (typeof value !== 'string' || value.length === 0) {
    problems.push(`operating facts: ${dotted} must be a non-empty string`);
    return '';
  }
  return value;
}

function digNumber(record: RawConfig, dotted: string, problems: string[]): number {
  const value = dig(record, dotted);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    problems.push(`operating facts: ${dotted} must be a positive integer`);
    return 0;
  }
  return value;
}

interface OperatingFacts {
  readonly dockerContext: string;
  readonly protectedDockerContexts: readonly string[];
  readonly jobUid: number;
  readonly jobNetwork: string;
  readonly proxyAddress: string;
  readonly proxyPort: number;
  readonly egressScript: string;
  readonly keychain: { readonly r2AccessKeyId: string; readonly r2SecretAccessKey: string };
}

function loadOperatingFacts(filePath: string, problems: string[]): OperatingFacts {
  const empty: OperatingFacts = {
    dockerContext: '',
    protectedDockerContexts: [],
    jobUid: 0,
    jobNetwork: '',
    proxyAddress: '',
    proxyPort: 0,
    egressScript: '',
    keychain: { r2AccessKeyId: '', r2SecretAccessKey: '' },
  };
  if (!existsSync(filePath)) {
    problems.push(`operating facts file ${filePath} does not exist`);
    return empty;
  }
  let raw: RawConfig;
  try {
    raw = readJsonFile(filePath);
  } catch (error) {
    problems.push(
      `operating facts file ${filePath} is not valid JSON: ${(error as Error).message}`,
    );
    return empty;
  }
  const protectedRaw = dig(raw, 'vm.dockerContextProtectedNames');
  const protectedDockerContexts = Array.isArray(protectedRaw)
    ? protectedRaw.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (!protectedDockerContexts.includes('default')) {
    problems.push('operating facts: vm.dockerContextProtectedNames must include "default"');
  }
  return {
    dockerContext: digString(raw, 'vm.dockerContext', problems),
    protectedDockerContexts,
    jobUid: digNumber(raw, 'job.image.uid', problems),
    jobNetwork: digString(raw, 'job.network.jobNetwork.name', problems),
    proxyAddress: digString(raw, 'job.network.proxy.jobFacingAddress', problems),
    proxyPort: digNumber(raw, 'job.network.proxy.port', problems),
    egressScript: digString(raw, 'job.guestPaths.egressScript', problems),
    keychain: {
      r2AccessKeyId: digString(raw, 'controller.keychainItems.r2EvidenceAccessKeyId', problems),
      r2SecretAccessKey: digString(
        raw,
        'controller.keychainItems.r2EvidenceSecretAccessKey',
        problems,
      ),
    },
  };
}

/**
 * Load executor configuration. Placeholders are detected and reported as
 * problems so they can never be silently used.
 */
export function loadExecutorConfig(env: Env, repoRoot: string): LoadedExecutorConfig {
  const configFile = path.resolve(
    repoRoot,
    env.NABATABLE_CI_EXECUTOR_CONFIG ?? DEFAULT_CONFIG_FILE,
  );
  const file = existsSync(configFile) ? readJsonFile(configFile) : {};
  const source = existsSync(configFile) ? configFile : 'env-only';
  const problems: string[] = [];

  const facts = loadOperatingFacts(
    path.resolve(repoRoot, env.NABATABLE_CI_OPERATING_FACTS ?? DEFAULT_OPERATING_FACTS_FILE),
    problems,
  );

  const repositoryIdRaw = pick(env, file, 'NABATABLE_CI_REPOSITORY_ID', 'repositoryId', '');
  const repositoryId = Number(repositoryIdRaw);
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    problems.push('repositoryId (NABATABLE_CI_REPOSITORY_ID) is unconfigured');
  }

  const sourceRemoteUrl = pick(env, file, 'NABATABLE_CI_SOURCE_REMOTE_URL', 'sourceRemoteUrl', '');
  if (isPlaceholder(sourceRemoteUrl) || !/^https:\/\/[^@\s]+$/u.test(sourceRemoteUrl)) {
    problems.push(
      'sourceRemoteUrl (NABATABLE_CI_SOURCE_REMOTE_URL) must be an https URL without embedded credentials',
    );
  }

  const spoolRoot = pick(env, file, 'NABATABLE_CI_SPOOL_ROOT', 'spoolRoot', '');
  if (isPlaceholder(spoolRoot) || !path.isAbsolute(spoolRoot)) {
    problems.push('spoolRoot (NABATABLE_CI_SPOOL_ROOT) must be an absolute path');
  }
  const jobRoot = pick(env, file, 'NABATABLE_CI_JOB_ROOT', 'jobRoot', '');
  if (isPlaceholder(jobRoot) || !path.isAbsolute(jobRoot)) {
    problems.push('jobRoot (NABATABLE_CI_JOB_ROOT) must be an absolute path');
  }

  const baseImagePath = pick(env, file, 'NABATABLE_CI_BASE_IMAGE_PATH', 'baseImagePath', '');
  if (isPlaceholder(baseImagePath) || !path.isAbsolute(baseImagePath)) {
    problems.push('lima.baseImagePath (NABATABLE_CI_BASE_IMAGE_PATH) must be an absolute path');
  }
  const baseImageDigest = pick(env, file, 'NABATABLE_CI_BASE_IMAGE_DIGEST', 'baseImageDigest', '');
  if (isPlaceholder(baseImageDigest) || !DIGEST_PATTERN.test(baseImageDigest)) {
    problems.push('lima.baseImageDigest (NABATABLE_CI_BASE_IMAGE_DIGEST) must be sha256:<64 hex>');
  }

  let image = pick(env, file, 'NABATABLE_CI_JOB_IMAGE', 'jobImage', '');
  if (image === '') {
    const name = pick(
      env,
      file,
      'NABATABLE_CI_JOB_IMAGE_NAME',
      'jobImageName',
      DEFAULT_JOB_IMAGE_NAME,
    );
    const digest = pick(env, file, 'NABATABLE_CI_JOB_IMAGE_DIGEST', 'jobImageDigest', '');
    image = `${name}@${digest}`;
  }
  const imageMatch = /^([a-z0-9][a-z0-9._/-]*)@(sha256:[0-9a-f]{64})$/u.exec(image);
  if (isPlaceholder(image) || !imageMatch) {
    problems.push(
      'docker.image (NABATABLE_CI_JOB_IMAGE or NABATABLE_CI_JOB_IMAGE_DIGEST) must be a digest-pinned image reference',
    );
  }
  const imageDigest = imageMatch?.[2] ?? '';

  const seccompProfilePath = path.resolve(
    repoRoot,
    pick(env, file, 'NABATABLE_CI_SECCOMP_PROFILE', 'seccompProfilePath', DEFAULT_SECCOMP_PROFILE),
  );
  if (!existsSync(seccompProfilePath)) {
    problems.push(`docker.seccompProfilePath ${seccompProfilePath} does not exist`);
  }

  const defaultProxy =
    facts.proxyAddress && facts.proxyPort ? `http://${facts.proxyAddress}:${facts.proxyPort}` : '';
  const egressProxyUrl = pick(
    env,
    file,
    'NABATABLE_CI_EGRESS_PROXY_URL',
    'egressProxyUrl',
    defaultProxy,
  );
  if (isPlaceholder(egressProxyUrl) || !/^http:\/\/[A-Za-z0-9.-]+:\d+$/u.test(egressProxyUrl)) {
    problems.push(
      'docker.egressProxyUrl (NABATABLE_CI_EGRESS_PROXY_URL) must be http://host:port of the guest proxy',
    );
  }

  const r2Endpoint = pick(env, file, 'NABATABLE_CI_R2_ENDPOINT', 'r2Endpoint', '');
  if (isPlaceholder(r2Endpoint) || !/^https:\/\/[a-z0-9.-]+$/u.test(r2Endpoint)) {
    problems.push(
      'r2.endpoint (NABATABLE_CI_R2_ENDPOINT) must be https://<account>.r2.cloudflarestorage.com',
    );
  }
  const r2Bucket = pick(env, file, 'NABATABLE_CI_R2_BUCKET', 'r2Bucket', '');
  if (isPlaceholder(r2Bucket) || !/^[a-z0-9][a-z0-9-]{1,62}$/u.test(r2Bucket)) {
    problems.push('r2.bucket (NABATABLE_CI_R2_BUCKET) is unconfigured');
  }
  const r2KeyPrefix = pick(
    env,
    file,
    'NABATABLE_CI_R2_KEY_PREFIX',
    'r2KeyPrefix',
    'ci-evidence/ttl-14d',
  );
  if (isPlaceholder(r2KeyPrefix) || !/^[A-Za-z0-9][A-Za-z0-9/_-]*[A-Za-z0-9]$/u.test(r2KeyPrefix)) {
    problems.push('r2.keyPrefix (NABATABLE_CI_R2_KEY_PREFIX) must be a plain object key prefix');
  }

  const keychainAccount = pick(
    env,
    file,
    'NABATABLE_CI_KEYCHAIN_ACCOUNT',
    'keychainAccount',
    'nabatable-ci',
  );
  if (isPlaceholder(keychainAccount) || !/^[A-Za-z0-9._-]+$/u.test(keychainAccount)) {
    problems.push('keychain.account (NABATABLE_CI_KEYCHAIN_ACCOUNT) must be a plain account name');
  }

  const user = facts.jobUid > 0 ? `${facts.jobUid}:${facts.jobUid}` : '';

  const config: ExecutorConfig = {
    repositoryId: Number.isSafeInteger(repositoryId) ? repositoryId : 0,
    sourceRemoteUrl,
    spoolRoot,
    jobRoot,
    lima: {
      baseImagePath,
      baseImageDigest,
      instancePrefix: pick(
        env,
        file,
        'NABATABLE_CI_LIMA_INSTANCE_PREFIX',
        'limaInstancePrefix',
        'nabatable-ci',
      ),
      cpus: pickNumber(env, file, 'NABATABLE_CI_LIMA_CPUS', 'limaCpus', 6),
      memoryGiB: pickNumber(env, file, 'NABATABLE_CI_LIMA_MEMORY_GIB', 'limaMemoryGiB', 16),
      diskGiB: pickNumber(env, file, 'NABATABLE_CI_LIMA_DISK_GIB', 'limaDiskGiB', 120),
      guestSpoolDir: '/home/ci/spool',
      dockerContext: facts.dockerContext,
      protectedDockerContexts: facts.protectedDockerContexts,
      egressScript: facts.egressScript,
    },
    docker: {
      image,
      imageDigest,
      seccompProfilePath,
      user,
      jobNetwork: facts.jobNetwork,
      egressProxyUrl,
    },
    r2: { endpoint: r2Endpoint, bucket: r2Bucket, keyPrefix: r2KeyPrefix, region: 'auto' },
    keychain: {
      account: keychainAccount,
      r2AccessKeyIdService: facts.keychain.r2AccessKeyId,
      r2SecretAccessKeyService: facts.keychain.r2SecretAccessKey,
    },
    retention: { maxAgeMs: LOG_RETENTION_MAX_AGE_MS, maxTotalBytes: LOG_RETENTION_MAX_TOTAL_BYTES },
  };

  for (const [name, value] of [
    ['lima.cpus', config.lima.cpus],
    ['lima.memoryGiB', config.lima.memoryGiB],
    ['lima.diskGiB', config.lima.diskGiB],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${name} must be a positive number`);
    }
  }
  if (
    config.lima.dockerContext !== '' &&
    config.lima.protectedDockerContexts.includes(config.lima.dockerContext)
  ) {
    problems.push(
      `docker context ${config.lima.dockerContext} is protected and cannot be used for CI`,
    );
  }

  return { config, problems, source };
}

export class ExecutorUnconfiguredError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`CI executor is unconfigured:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ExecutorUnconfiguredError';
  }
}

export function assertConfigured(loaded: LoadedExecutorConfig): ExecutorConfig {
  if (loaded.problems.length > 0) {
    throw new ExecutorUnconfiguredError(loaded.problems);
  }
  return loaded.config;
}
