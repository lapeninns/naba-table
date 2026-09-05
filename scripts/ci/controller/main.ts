import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { admissionPolicyFromOperatingConfig, createAdmissionEvaluator } from './admission/policy';
import { createSystemProbes, type CommandRunner } from './admission/probes';
import { createCaffeinateAssertion } from './caffeinate';
import { createController, type ControllerConfig } from './controller';
import { createGitHubClient } from './github/client';
import { createHeartbeatEmitter } from './heartbeat';
import { createKeychainSecretProvider, type ExecFileLike } from './keychain';
import { createLogger, type ControllerLogger } from './log';
import { createMemoryBackend } from './queue/memory-backend';
import { openSqliteBackend } from './queue/sqlite-backend';
import { QueueStore } from './queue/store';
import { createProcessRunner } from './runner';
import {
  ACTIVE_RUNTIME,
  CANDIDATE_RUNTIME,
  LOCAL_CI_APP_SLUG,
  MAX_CONTROLLER_ATTEMPTS,
  RUNTIME_QUALIFICATION_NOTE,
  isSha256Digest,
  type CiProfile,
} from './types';
import {
  OPERATING_CONFIG_PATH,
  TRUST_POLICY_PATH,
  clockMinutes,
  isPlaceholder,
  isTrustPolicyConfigured,
  loadOperatingConfig,
  loadTrustPolicy,
  type OperatingConfig,
  type TrustPolicy,
} from '../contracts';
import { IMAGE, PROFILES } from '../profiles';

export const CONTROLLER_VERSION = '0.1.0';

/** Keychain contract shared with infra/local-ci (operating.json `controller.keychain*`). */
export const DEFAULT_KEYCHAIN_ACCOUNT = 'nabatable-ci';
export const DEFAULT_KEYCHAIN_GITHUB_APP_KEY =
  'nabatable-ci/github-app/nabatable-local-ci/private-key';
export const DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN = 'nabatable-ci/monitoring/heartbeat-token';

/**
 * Environment contract. Where two spellings exist (the `controller.env`
 * template and the executor use `NABATABLE_CI_GITHUB_*` / `NABATABLE_CI_JOB_*`,
 * older wrappers used `NABATABLE_LOCAL_CI_*`), both are read and must agree.
 */
export const ENV = {
  appId: ['NABATABLE_CI_GITHUB_APP_ID', 'NABATABLE_LOCAL_CI_APP_ID'],
  installationId: ['NABATABLE_CI_GITHUB_APP_INSTALLATION_ID', 'NABATABLE_LOCAL_CI_INSTALLATION_ID'],
  repositoryId: ['NABATABLE_CI_GITHUB_REPOSITORY_ID', 'NABATABLE_CI_REPOSITORY_ID'],
  repository: ['NABATABLE_CI_GITHUB_REPOSITORY', 'NABATABLE_CI_REPOSITORY'],
  imageDigest: ['NABATABLE_CI_JOB_IMAGE_DIGEST', 'NABATABLE_CI_IMAGE_DIGEST'],
  jobImage: ['NABATABLE_CI_JOB_IMAGE'],
  policyVersion: ['NABATABLE_CI_POLICY_VERSION'],
  /** Optional: a 0600 PEM file. When absent the key is read from the Keychain. */
  privateKeyPath: ['NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH'],
  keychainAccount: ['NABATABLE_CI_KEYCHAIN_ACCOUNT'],
  keychainGithubAppKey: ['NABATABLE_CI_KEYCHAIN_GITHUB_APP_KEY'],
  keychainHeartbeatToken: [
    'NABATABLE_CI_KEYCHAIN_HEARTBEAT_TOKEN',
    'NABATABLE_CI_HEARTBEAT_KEYCHAIN_SERVICE',
  ],
  heartbeatKeychainAccount: ['NABATABLE_CI_HEARTBEAT_KEYCHAIN_ACCOUNT'],
  heartbeatUrl: ['NABATABLE_CI_HEARTBEAT_URL'],
  operatingConfig: ['NABATABLE_CI_OPERATING_CONFIG'],
  trustPolicy: ['NABATABLE_CI_TRUST_POLICY'],
  queueDb: ['NABATABLE_CI_QUEUE_DB'],
  stateDir: ['NABATABLE_CI_STATE_DIR'],
  workspace: ['NABATABLE_CI_WORKSPACE'],
  executorCommand: ['NABATABLE_CI_EXECUTOR_COMMAND'],
  defaultBranch: ['NABATABLE_CI_DEFAULT_BRANCH'],
  maxAttempts: ['NABATABLE_CI_MAX_ATTEMPTS'],
  leaseTtlMs: ['NABATABLE_CI_LEASE_TTL_MS'],
  controllerId: ['NABATABLE_CI_CONTROLLER_ID'],
  logLevel: ['NABATABLE_CI_LOG_LEVEL'],
} as const satisfies Record<string, readonly [string, ...string[]]>;

type EnvKey = keyof typeof ENV;

const primary = (key: EnvKey): string => ENV[key][0];

export const HELP = `Nabatable local CI controller (macOS)

Usage: pnpm ci:controller [--once] [--check-config] [--store sqlite|memory] [--help]

  --once           reconcile, run a single scheduling tick, wait for the job, then exit
  --check-config   validate configuration and print it (no secrets) without contacting GitHub
  --store          queue backend; sqlite (default, durable) or memory (dry runs only)

Configuration is read from the environment. infra/local-ci/bin/controller.sh loads
~/nabatable-ci/config/controller.env and exports the Keychain item names.
REPLACE_ME_* placeholders are rejected. Aliases in brackets are accepted and must agree.

  ${primary('appId')}                  App id of ${LOCAL_CI_APP_SLUG} [${ENV.appId[1]}]
  ${primary('installationId')}     installation id on the repository [${ENV.installationId[1]}]
  ${primary('repositoryId')}           numeric repository id, verified against GitHub [${ENV.repositoryId[1]}]
  ${primary('repository')}              owner/repo; must match the repository id [${ENV.repository[1]}]
  ${primary('imageDigest')}                request-tuple image digest (sha256:<hex>) [${ENV.imageDigest[1]}]
  ${primary('jobImage')}                       optional digest-pinned job image; its digest must match
  ${primary('policyVersion')}                  optional; must equal the profile catalog policy version
  ${primary('privateKeyPath')}          optional 0600 PEM file; otherwise the key is read from the Keychain
  ${primary('keychainAccount')}                Keychain account (default ${DEFAULT_KEYCHAIN_ACCOUNT})
  ${primary('keychainGithubAppKey')}         Keychain service of the App PEM (default ${DEFAULT_KEYCHAIN_GITHUB_APP_KEY})
  ${primary('keychainHeartbeatToken')}        Keychain service of the heartbeat token (default ${DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN})
  ${primary('heartbeatKeychainAccount')}      Keychain account of the heartbeat token (default: the Keychain account above)
  ${primary('heartbeatUrl')}                   operational Worker heartbeat endpoint (https)
  ${primary('operatingConfig')}                default ${OPERATING_CONFIG_PATH}
  ${primary('trustPolicy')}                    default ${TRUST_POLICY_PATH}
  ${primary('queueDb')}                        SQLite path (default ~/Library/Application Support/nabatable-local-ci/queue.sqlite)
  ${primary('stateDir')}                       per-attempt executor state (default next to the queue)
  ${primary('workspace')}                      path used for the free-disk probe (default cwd)
  ${primary('executorCommand')}                executor command (default "pnpm ci:executor"), run from the release checkout
  ${primary('defaultBranch')}                  default main
  ${primary('maxAttempts')}                    default 2 (max ${MAX_CONTROLLER_ATTEMPTS})
  ${primary('leaseTtlMs')}                     default 300000
  ${primary('controllerId')}                   default mac-controller

Secrets never come from controller.env: the App key and the heartbeat token are
read from the login Keychain of the service account (or, for the key only, from
the 0600 file named by ${primary('privateKeyPath')}).

Runtime: active ${ACTIVE_RUNTIME}, candidate ${CANDIDATE_RUNTIME}.
`;

export interface CliArgs {
  readonly once: boolean;
  readonly checkConfig: boolean;
  readonly store: 'sqlite' | 'memory';
  readonly help: boolean;
}

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgumentError';
  }
}

export function parseArgs(argv: readonly string[]): CliArgs {
  let once = false;
  let checkConfig = false;
  let help = false;
  let store: CliArgs['store'] = 'sqlite';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') once = true;
    else if (arg === '--check-config') checkConfig = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--store') {
      const value = argv[index + 1];
      if (value !== 'sqlite' && value !== 'memory') {
        throw new CliArgumentError('--store expects sqlite or memory');
      }
      store = value;
      index += 1;
    } else if (arg?.startsWith('--store=')) {
      const value = arg.slice('--store='.length);
      if (value !== 'sqlite' && value !== 'memory') {
        throw new CliArgumentError('--store expects sqlite or memory');
      }
      store = value;
    } else {
      throw new CliArgumentError(`Unknown argument: ${arg}`);
    }
  }
  return { once, checkConfig, store, help };
}

export type AppKeySource =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'keychain'; readonly service: string; readonly account: string };

export interface ResolvedConfig {
  readonly controller: ControllerConfig;
  readonly github: {
    readonly appId: number;
    readonly installationId: number;
    readonly repository: string | undefined;
    readonly appKey: AppKeySource;
  };
  readonly heartbeat: {
    readonly url: string;
    readonly keychainService: string;
    readonly keychainAccount: string;
  };
  readonly operating: OperatingConfig;
  readonly paths: {
    readonly repoRoot: string;
    readonly queueDb: string;
    readonly stateDir: string;
    readonly workspace: string;
    readonly operatingConfig: string;
    readonly trustPolicy: string;
  };
  readonly executor: { readonly command: string; readonly args: readonly string[] };
}

export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Controller configuration is incomplete:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

type Env = Readonly<Record<string, string | undefined>>;

const LOOSE_PLACEHOLDER_PATTERN = /REPLACE_ME|CHANGE_ME|<[^>]+>/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const CONTROLLER_ID_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/u;

interface Reader {
  readonly env: Env;
  readonly problems: string[];
}

/**
 * Reads a setting under any of its accepted names. Placeholders are reported,
 * disagreeing aliases are reported, and the fallback applies only when no
 * alias is set at all.
 */
function readSetting(reader: Reader, key: EnvKey, fallback?: string): string | undefined {
  const names = ENV[key];
  const values = new Map<string, string>();
  for (const name of names) {
    const raw = reader.env[name]?.trim();
    if (!raw) continue;
    if (isPlaceholder(raw) || LOOSE_PLACEHOLDER_PATTERN.test(raw)) {
      reader.problems.push(`${name} still contains a placeholder value`);
      return undefined;
    }
    values.set(name, raw);
  }
  const distinct = new Set(values.values());
  if (distinct.size > 1) {
    reader.problems.push(`${[...values.keys()].join(' and ')} disagree; set one value`);
    return undefined;
  }
  const [value] = distinct;
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  reader.problems.push(
    names.length > 1
      ? `${names[0]} is not set (alias: ${names.slice(1).join(', ')})`
      : `${names[0]} is not set`,
  );
  return undefined;
}

function readOptionalSetting(reader: Reader, key: EnvKey): string | undefined {
  if (!ENV[key].some((name) => reader.env[name]?.trim())) return undefined;
  return readSetting(reader, key);
}

function readIntegerSetting(reader: Reader, key: EnvKey, fallback?: number): number | undefined {
  const value = readSetting(reader, key, fallback === undefined ? undefined : String(fallback));
  if (value === undefined) return undefined;
  if (!/^\d+$/u.test(value) || Number(value) <= 0) {
    reader.problems.push(`${primary(key)} must be a positive integer`);
    return undefined;
  }
  return Number(value);
}

export interface ConfigLoadOptions {
  readonly env: Env;
  readonly cwd: string;
  readonly home?: string;
  readonly fileExists?: (filePath: string) => boolean;
  /** Permission bits of a file, or null when it cannot be read. */
  readonly fileMode?: (filePath: string) => number | null;
  readonly loadOperatingConfig?: (repositoryRoot: string, relativePath: string) => OperatingConfig;
  readonly loadTrustPolicy?: (repositoryRoot: string, relativePath: string) => TrustPolicy;
}

function defaultFileMode(filePath: string): number | null {
  try {
    return statSync(filePath).mode & 0o777;
  } catch {
    return null;
  }
}

/** Digest pinned in a `repo@sha256:<hex>` image reference, if any. */
export function imageReferenceDigest(reference: string): string | null {
  const at = reference.lastIndexOf('@');
  if (at < 0) return null;
  const digest = reference.slice(at + 1);
  return isSha256Digest(digest) ? digest : null;
}

export function loadConfig(options: ConfigLoadOptions): ResolvedConfig {
  const { env, cwd } = options;
  const home = options.home ?? homedir();
  const fileExists = options.fileExists ?? ((filePath) => existsSync(filePath));
  const fileMode = options.fileMode ?? defaultFileMode;
  const problems: string[] = [];
  const reader: Reader = { env, problems };

  const appId = readIntegerSetting(reader, 'appId');
  const installationId = readIntegerSetting(reader, 'installationId');
  const repositoryId = readIntegerSetting(reader, 'repositoryId');
  const repository = readOptionalSetting(reader, 'repository');
  if (repository !== undefined && !REPOSITORY_PATTERN.test(repository)) {
    problems.push(`${primary('repository')} must be owner/repo`);
  }

  const keychainAccount =
    readSetting(reader, 'keychainAccount', DEFAULT_KEYCHAIN_ACCOUNT) ?? DEFAULT_KEYCHAIN_ACCOUNT;
  let appKey: AppKeySource | undefined;
  const privateKeyPath = readOptionalSetting(reader, 'privateKeyPath');
  if (privateKeyPath !== undefined) {
    if (!path.isAbsolute(privateKeyPath)) {
      problems.push(`${primary('privateKeyPath')} must be an absolute path`);
    } else if (!fileExists(privateKeyPath)) {
      problems.push(`${primary('privateKeyPath')} does not exist: ${privateKeyPath}`);
    } else {
      const mode = fileMode(privateKeyPath);
      if (mode === null) {
        problems.push(`${primary('privateKeyPath')} is not readable`);
      } else if ((mode & 0o077) !== 0) {
        problems.push(
          `${primary('privateKeyPath')} must not be group/world accessible (chmod 600)`,
        );
      } else {
        appKey = { kind: 'file', path: privateKeyPath };
      }
    }
  } else {
    const service =
      readSetting(reader, 'keychainGithubAppKey', DEFAULT_KEYCHAIN_GITHUB_APP_KEY) ??
      DEFAULT_KEYCHAIN_GITHUB_APP_KEY;
    appKey = { kind: 'keychain', service, account: keychainAccount };
  }

  const catalogPolicyVersion = PROFILES.main.policyVersion;
  const policyVersion = readOptionalSetting(reader, 'policyVersion');
  if (policyVersion !== undefined && policyVersion !== catalogPolicyVersion) {
    problems.push(
      `${primary('policyVersion')} ${policyVersion} does not match the profile catalog policy version ${catalogPolicyVersion} (scripts/ci/profiles/catalog.ts)`,
    );
  }

  const imageDigest = readSetting(reader, 'imageDigest');
  if (imageDigest !== undefined && !isSha256Digest(imageDigest)) {
    problems.push(`${primary('imageDigest')} must be sha256:<64 lowercase hex>`);
  }
  const jobImage = readOptionalSetting(reader, 'jobImage');
  if (jobImage !== undefined) {
    const pinned = imageReferenceDigest(jobImage);
    if (pinned === null) {
      problems.push(
        `${primary('jobImage')} must be a digest-pinned image reference (repo@sha256:<hex>)`,
      );
    } else if (imageDigest !== undefined && pinned !== imageDigest) {
      problems.push(
        `${primary('imageDigest')} does not match the digest pinned in ${primary('jobImage')}`,
      );
    }
  }
  if (
    imageDigest !== undefined &&
    isSha256Digest(IMAGE.jobImageDigest) &&
    IMAGE.jobImageDigest !== imageDigest
  ) {
    problems.push(
      `${primary('imageDigest')} does not match the profile catalog job image digest ${IMAGE.jobImageDigest}`,
    );
  }

  const heartbeatUrl = readSetting(reader, 'heartbeatUrl');
  if (heartbeatUrl !== undefined && !/^https:\/\//u.test(heartbeatUrl)) {
    problems.push(`${primary('heartbeatUrl')} must be an https URL`);
  }
  const heartbeatKeychainService =
    readSetting(reader, 'keychainHeartbeatToken', DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN) ??
    DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN;
  const heartbeatKeychainAccount =
    readSetting(reader, 'heartbeatKeychainAccount', keychainAccount) ?? keychainAccount;

  const operatingConfigPath =
    readSetting(reader, 'operatingConfig', OPERATING_CONFIG_PATH) ?? OPERATING_CONFIG_PATH;
  const trustPolicyPath =
    readSetting(reader, 'trustPolicy', TRUST_POLICY_PATH) ?? TRUST_POLICY_PATH;

  let operating: OperatingConfig | undefined;
  try {
    operating = (options.loadOperatingConfig ?? loadOperatingConfig)(cwd, operatingConfigPath);
  } catch (error) {
    problems.push(
      `operating config ${operatingConfigPath} is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let trustPolicy: TrustPolicy | undefined;
  try {
    trustPolicy = (options.loadTrustPolicy ?? loadTrustPolicy)(cwd, trustPolicyPath);
  } catch (error) {
    problems.push(
      `trust policy ${trustPolicyPath} is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    trustPolicy !== undefined &&
    repositoryId !== undefined &&
    isTrustPolicyConfigured(trustPolicy) &&
    String(trustPolicy.trustedRepositoryId) !== String(repositoryId)
  ) {
    problems.push(
      `trust policy trustedRepositoryId ${String(trustPolicy.trustedRepositoryId)} does not match ${primary('repositoryId')} ${repositoryId}`,
    );
  }

  const defaultQueueDb = path.join(
    home,
    'Library',
    'Application Support',
    'nabatable-local-ci',
    'queue.sqlite',
  );
  const queueDb = readSetting(reader, 'queueDb', defaultQueueDb) ?? defaultQueueDb;
  const stateDir =
    readSetting(reader, 'stateDir', path.join(path.dirname(queueDb), 'attempts')) ??
    path.dirname(queueDb);
  const workspace = readSetting(reader, 'workspace', cwd) ?? cwd;
  const executorCommand =
    readSetting(reader, 'executorCommand', 'pnpm ci:executor') ?? 'pnpm ci:executor';
  const defaultBranch = readSetting(reader, 'defaultBranch', 'main') ?? 'main';
  const maxAttempts = readIntegerSetting(reader, 'maxAttempts', 2) ?? 2;
  if (maxAttempts > MAX_CONTROLLER_ATTEMPTS) {
    problems.push(`${primary('maxAttempts')} must not exceed ${MAX_CONTROLLER_ATTEMPTS}`);
  }
  const leaseTtlMs = readIntegerSetting(reader, 'leaseTtlMs', 300_000) ?? 300_000;
  const controllerId = readSetting(reader, 'controllerId', 'mac-controller') ?? 'mac-controller';
  if (!CONTROLLER_ID_PATTERN.test(controllerId)) {
    problems.push(`${primary('controllerId')} must match [A-Za-z0-9._+-]{1,64}`);
  }

  if (
    problems.length > 0 ||
    appId === undefined ||
    installationId === undefined ||
    appKey === undefined ||
    repositoryId === undefined ||
    imageDigest === undefined ||
    heartbeatUrl === undefined ||
    operating === undefined ||
    trustPolicy === undefined
  ) {
    throw new ConfigError(problems);
  }
  const [command, ...args] = executorCommand.split(/\s+/u);
  const policyVersions: Record<CiProfile, string> = {
    pr: PROFILES.pr.policyVersion,
    main: PROFILES.main.policyVersion,
    nightly: PROFILES.nightly.policyVersion,
  };

  return {
    controller: {
      controllerId,
      controllerVersion: CONTROLLER_VERSION,
      repositoryId,
      installationId,
      defaultBranch,
      policyVersions,
      imageDigest,
      leaseTtlMs,
      maxAttempts,
      nightlyHourLondon: Math.floor(clockMinutes(operating.nightlyStart) / 60),
      skipDraftPullRequests: true,
      trustPolicy,
    },
    github: { appId, installationId, repository, appKey },
    heartbeat: {
      url: heartbeatUrl,
      keychainService: heartbeatKeychainService,
      keychainAccount: heartbeatKeychainAccount,
    },
    operating,
    paths: {
      repoRoot: cwd,
      queueDb,
      stateDir,
      workspace,
      operatingConfig: operatingConfigPath,
      trustPolicy: trustPolicyPath,
    },
    executor: { command: command ?? 'pnpm', args },
  };
}

/** Operator-facing view of the configuration. Contains identifiers only, never secret material. */
export function describeConfig(config: ResolvedConfig): Record<string, unknown> {
  const { trustPolicy, ...controller } = config.controller;
  return {
    controller,
    github: {
      appSlug: LOCAL_CI_APP_SLUG,
      appId: config.github.appId,
      installationId: config.github.installationId,
      appKey: config.github.appKey,
      repositoryId: config.controller.repositoryId,
      repository: config.github.repository ?? '(resolved from repository id at start)',
    },
    heartbeat: config.heartbeat,
    trustPolicy: {
      path: config.paths.trustPolicy,
      configured: isTrustPolicyConfigured(trustPolicy),
      localActors: trustPolicy.actorPolicy.localActors.length,
      note: isTrustPolicyConfigured(trustPolicy)
        ? 'pull requests from listed local actors run locally'
        : 'unconfigured: every pull request is routed to hosted CI; only main/nightly run locally',
    },
    operating: {
      path: config.paths.operatingConfig,
      timezone: config.operating.timezone,
      dedicatedWindow: config.operating.dedicatedWindow,
      nightlyStart: config.operating.nightlyStart,
      minFreeGiB: config.operating.disk.minFreeGiB,
      polling: config.operating.polling,
    },
    paths: {
      repoRoot: config.paths.repoRoot,
      queueDb: config.paths.queueDb,
      stateDir: config.paths.stateDir,
      workspace: config.paths.workspace,
    },
    executor: config.executor,
    runtime: {
      activeRuntime: ACTIVE_RUNTIME,
      candidateRuntime: CANDIDATE_RUNTIME,
      note: RUNTIME_QUALIFICATION_NOTE,
    },
  };
}

/** Key material may be the PEM verbatim or base64-encoded (single line, as stored in the Keychain). */
export function decodePrivateKeyMaterial(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('-----BEGIN')) return `${trimmed}\n`;
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
  if (decoded.startsWith('-----BEGIN')) return `${decoded}\n`;
  throw new Error('GitHub App private key is neither PEM nor base64-encoded PEM');
}

const runCommand: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, [...args], { encoding: 'utf8', timeout: 15_000 }, (error, stdout) => {
      if (error) reject(new Error(`${command} failed: ${error.message}`));
      else resolve(stdout);
    });
  });

export interface DaemonDeps {
  readonly execFile?: ExecFileLike;
}

async function loadPrivateKeyPem(config: ResolvedConfig, daemon: DaemonDeps): Promise<string> {
  const { appKey } = config.github;
  if (appKey.kind === 'file') return decodePrivateKeyMaterial(readFileSync(appKey.path, 'utf8'));
  const provider = createKeychainSecretProvider({
    service: appKey.service,
    account: appKey.account,
    ...(daemon.execFile === undefined ? {} : { execFile: daemon.execFile }),
  });
  return decodePrivateKeyMaterial(await provider());
}

async function runDaemon(
  args: CliArgs,
  config: ResolvedConfig,
  logger: ControllerLogger,
  daemon: DaemonDeps = {},
): Promise<number> {
  const privateKeyPem = await loadPrivateKeyPem(config, daemon);
  mkdirSync(path.dirname(config.paths.queueDb), { recursive: true });
  mkdirSync(config.paths.stateDir, { recursive: true });
  const backend =
    args.store === 'memory' ? createMemoryBackend() : await openSqliteBackend(config.paths.queueDb);
  const store = new QueueStore({ backend });
  const github = createGitHubClient({
    credentials: {
      appId: config.github.appId,
      installationId: config.github.installationId,
      privateKeyPem,
    },
    identity: { localAppId: config.github.appId, appSlug: LOCAL_CI_APP_SLUG },
    repositoryId: config.controller.repositoryId,
    ...(config.github.repository === undefined ? {} : { repository: config.github.repository }),
    pollIntervalMs: config.operating.polling.intervalSeconds * 1000,
    pollJitterMs: config.operating.polling.jitterSeconds * 1000,
    logger: logger.child({ component: 'github' }),
  });
  const heartbeat = createHeartbeatEmitter({
    url: config.heartbeat.url,
    token: createKeychainSecretProvider({
      service: config.heartbeat.keychainService,
      account: config.heartbeat.keychainAccount,
      ...(daemon.execFile === undefined ? {} : { execFile: daemon.execFile }),
    }),
    logger: logger.child({ component: 'heartbeat' }),
  });
  const controller = createController({
    config: config.controller,
    store,
    github,
    runner: createProcessRunner({
      command: config.executor.command,
      args: config.executor.args,
      cwd: config.paths.repoRoot,
      stateDir: config.paths.stateDir,
    }),
    admission: createAdmissionEvaluator({
      probes: createSystemProbes(runCommand, config.paths.workspace),
      policy: admissionPolicyFromOperatingConfig(config.operating),
    }),
    heartbeat,
    sleepAssertion: createCaffeinateAssertion({}),
    logger,
    ownerToken: `${config.controller.controllerId}:${process.pid}:${randomUUID()}`,
  });

  try {
    if (args.once) {
      await controller.reconcile();
      await controller.tick();
      await controller.waitForIdle();
      return 0;
    }
    const abort = new AbortController();
    const stop = (): void => {
      logger.info('controller.stop_requested');
      abort.abort();
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    await controller.run(abort.signal);
    return 0;
  } finally {
    store.close();
  }
}

export async function main(argv: readonly string[], env: Env = process.env): Promise<number> {
  const logger = createLogger(
    { level: env[primary('logLevel')] === 'debug' ? 'debug' : 'info' },
    {
      component: 'controller',
      controllerVersion: CONTROLLER_VERSION,
    },
  );
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  let config: ResolvedConfig;
  try {
    config = loadConfig({ env, cwd: process.cwd() });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  if (args.checkConfig) {
    process.stdout.write(`${JSON.stringify(describeConfig(config), null, 2)}\n`);
    return 0;
  }
  if (process.platform !== 'darwin') {
    process.stderr.write(
      'The local CI controller only runs on macOS (pmset/caffeinate/Keychain).\n',
    );
    return 2;
  }
  try {
    return await runDaemon(args, config, logger);
  } catch (error) {
    logger.error('controller.fatal', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 1;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && /controller[\\/]main\.(ts|js)$/u.test(process.argv[1]);

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
