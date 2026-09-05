import path from 'node:path';
import process from 'node:process';

import {
  isRecord,
  parseDeployTarget,
  readJsonEvidence,
  writeJsonEvidence,
  type DeployTarget,
} from './evidence';
import {
  flagBoolean,
  flagString,
  parseFlags,
  runOrThrow,
  spawnCommandRunner,
  type CommandResult,
  type CommandRunner,
} from './exec';
import { verifyReadiness, type FetchLike } from './readiness';
import {
  PLACEHOLDER_PATTERN,
  digestWorkerConfigs,
  loadWorkerConfigs,
  separationEvidencePath,
} from './validate-separation';
import {
  environmentSection,
  isCustomerWorker,
  productionSection,
  readWranglerConfig,
  workerNameFor,
  wranglerConfigPath,
  type CustomerWorker,
} from './wrangler-config';

/**
 * Cloudflare Worker deployment through wrangler versions.
 *
 * `wrangler versions upload` creates an immutable version without traffic; `wrangler
 * versions deploy <id>@100%` then shifts traffic to it. When the installed wrangler does
 * not support versions the script falls back to `wrangler deploy`. Both paths bake the
 * source revision as DEPLOY_SHA/NABATABLE_SOURCE_REVISION vars and verify `/ready`.
 */
export const SEPARATION_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class WorkerDeployRefusedError extends Error {
  constructor(message: string) {
    super(`Refusing worker deploy: ${message}`);
    this.name = 'WorkerDeployRefusedError';
  }
}

export function assertSeparationEvidence(params: {
  readonly evidence: unknown;
  readonly target: DeployTarget;
  readonly currentDigest: string;
  readonly now?: Date;
}): void {
  const { evidence } = params;
  if (!isRecord(evidence))
    throw new WorkerDeployRefusedError('separation evidence is not an object.');
  if (evidence.kind !== 'separation-validation') {
    throw new WorkerDeployRefusedError('separation evidence kind is not "separation-validation".');
  }
  if (evidence.target !== params.target) {
    throw new WorkerDeployRefusedError(
      `separation evidence is for "${String(evidence.target)}", not "${params.target}".`,
    );
  }
  if (evidence.ok !== true) {
    throw new WorkerDeployRefusedError('separation validation did not pass for this target.');
  }
  if (evidence.configDigest !== params.currentDigest) {
    throw new WorkerDeployRefusedError(
      'separation evidence is stale: wrangler configs changed since validation; re-run deploy:validate-separation.',
    );
  }
  const checkedAt = typeof evidence.checkedAt === 'string' ? Date.parse(evidence.checkedAt) : NaN;
  const now = (params.now ?? new Date()).getTime();
  if (
    Number.isNaN(checkedAt) ||
    now - checkedAt > SEPARATION_EVIDENCE_MAX_AGE_MS ||
    checkedAt > now + 60_000
  ) {
    throw new WorkerDeployRefusedError(
      'separation evidence is missing a valid checkedAt or is older than 24h.',
    );
  }
}

export function envArgs(target: DeployTarget): readonly string[] {
  return target === 'production' ? [] : ['--env', target];
}

export function parseVersionId(output: string): string | null {
  const match =
    output.match(/Worker Version ID:\s*([0-9a-f-]{36})/iu) ??
    output.match(/Current Version ID:\s*([0-9a-f-]{36})/iu);
  return match?.[1] ?? null;
}

export function versionsUnsupported(result: CommandResult): boolean {
  return /unknown (argument|command)|not a wrangler command|did you mean/iu.test(
    `${result.stdout}\n${result.stderr}`,
  );
}

export function parseLatestVersionId(output: string): string | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return null;
    const entries = parsed
      .filter(isRecord)
      .map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : null,
        createdOn:
          isRecord(entry.metadata) && typeof entry.metadata.created_on === 'string'
            ? Date.parse(entry.metadata.created_on)
            : Number.NaN,
      }))
      .filter((entry): entry is { id: string; createdOn: number } => entry.id !== null);
    if (entries.length === 0) return null;
    entries.sort(
      (a, b) =>
        (Number.isNaN(b.createdOn) ? 0 : b.createdOn) -
        (Number.isNaN(a.createdOn) ? 0 : a.createdOn),
    );
    return entries[0]?.id ?? null;
  } catch {
    return null;
  }
}

export type WorkerDeploymentEvidence = {
  readonly kind: 'worker-deployment';
  readonly worker: CustomerWorker;
  readonly target: DeployTarget;
  readonly workerName: string;
  readonly versionId: string;
  readonly previousVersionId: string | null;
  readonly strategy: 'versions' | 'deploy';
  readonly sourceRevision: string;
  readonly verified: boolean;
  readonly verifiedAt: string;
  readonly readiness: {
    readonly url: string;
    readonly revision: string;
    readonly attempts: number;
  };
  readonly separationEvidencePath: string;
  readonly configDigest: string;
  readonly commands: readonly string[];
  readonly rollbackCommand: string;
};

export type WorkerDeployOptions = {
  readonly worker: CustomerWorker;
  readonly target: DeployTarget;
  readonly sourceRevision: string;
  readonly monitoringToken: string;
  readonly rootDir: string;
  readonly separationEvidencePath: string;
  readonly evidencePath: string;
  readonly baseUrl?: string;
  readonly skipMigrations?: boolean;
  readonly runner?: CommandRunner;
  readonly fetchImpl?: FetchLike;
  readonly env?: NodeJS.ProcessEnv;
  readonly readinessAttempts?: number;
  readonly readinessDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => Date;
};

const PUBLIC_URL_VARS: Readonly<Record<CustomerWorker, string | null>> = {
  'booking-short-links': 'SHORT_LINKS_PUBLIC_BASE_URL',
  // No public base URL var: pass --url or WORKER_URL_EMAIL_QUEUE_GATEWAY
  // (deploy.yml maps vars.<ENV>_EMAIL_QUEUE_GATEWAY_URL onto it).
  'email-queue-gateway': null,
  'sms-summary-gateway': 'SMS_SUMMARY_GATEWAY_PUBLIC_URL',
  // No public base URL var: pass --url or WORKER_URL_OPERATIONAL_CONTROL.
  'operational-control': null,
};

export function resolveWorkerBaseUrl(params: {
  readonly worker: CustomerWorker;
  readonly target: DeployTarget;
  readonly config: Record<string, unknown>;
  readonly explicit?: string;
  readonly env?: NodeJS.ProcessEnv;
}): string {
  const envKey = `WORKER_URL_${params.worker.toUpperCase().replace(/-/gu, '_')}`;
  const section =
    params.target === 'production'
      ? productionSection(params.config)
      : environmentSection(params.config, params.target);
  const varName = PUBLIC_URL_VARS[params.worker];
  const vars = section && isRecord(section.vars) ? section.vars : {};
  const fromConfig = varName && typeof vars[varName] === 'string' ? vars[varName] : undefined;
  const candidate = params.explicit ?? params.env?.[envKey] ?? fromConfig;
  if (!candidate || PLACEHOLDER_PATTERN.test(candidate)) {
    throw new WorkerDeployRefusedError(
      `no readiness URL for ${params.worker} (${params.target}); pass --url or set ${envKey}.`,
    );
  }
  return candidate;
}

export async function deployWorker(
  options: WorkerDeployOptions,
): Promise<WorkerDeploymentEvidence> {
  if (!/^[0-9a-f]{40}$/u.test(options.sourceRevision)) {
    throw new WorkerDeployRefusedError('sourceRevision must be a 40-hex git SHA.');
  }
  if (!options.monitoringToken) {
    throw new WorkerDeployRefusedError('MONITORING_TOKEN is required to verify /ready.');
  }
  const currentDigest = digestWorkerConfigs(loadWorkerConfigs(options.rootDir));
  assertSeparationEvidence({
    evidence: readJsonEvidence(options.separationEvidencePath),
    target: options.target,
    currentDigest,
    now: options.now?.(),
  });

  const configPath = wranglerConfigPath(options.rootDir, options.worker);
  const config = readWranglerConfig(configPath);
  const workerName = workerNameFor(config, options.target === 'production' ? null : options.target);
  const baseUrl = resolveWorkerBaseUrl({
    worker: options.worker,
    target: options.target,
    config,
    explicit: options.baseUrl,
    env: options.env,
  });
  const runner = options.runner ?? spawnCommandRunner;
  const commonArgs = ['--config', configPath, ...envArgs(options.target)];
  const varArgs = [
    '--var',
    `DEPLOY_SHA:${options.sourceRevision}`,
    '--var',
    `NABATABLE_SOURCE_REVISION:${options.sourceRevision}`,
  ];
  const commands: string[] = [];
  const invoke = (args: readonly string[]): CommandResult => {
    commands.push(`wrangler ${args.join(' ')}`);
    return runner('wrangler', args, { cwd: options.rootDir, env: options.env });
  };
  const invokeOrThrow = (args: readonly string[]): CommandResult => {
    commands.push(`wrangler ${args.join(' ')}`);
    return runOrThrow(runner, 'wrangler', args, { cwd: options.rootDir, env: options.env });
  };

  const listing = invoke(['versions', 'list', ...commonArgs, '--json']);
  const previousVersionId = listing.status === 0 ? parseLatestVersionId(listing.stdout) : null;

  if (options.worker === 'booking-short-links' && !options.skipMigrations) {
    invokeOrThrow([
      'd1',
      'migrations',
      'apply',
      'BOOKING_SHORT_LINKS_DB',
      '--remote',
      ...commonArgs,
    ]);
  }

  let strategy: 'versions' | 'deploy' = 'versions';
  let versionId: string | null = null;
  const upload = invoke([
    'versions',
    'upload',
    ...commonArgs,
    ...varArgs,
    '--message',
    `nabatable ${options.target} ${options.sourceRevision}`,
  ]);
  if (upload.status === 0) {
    versionId = parseVersionId(`${upload.stdout}\n${upload.stderr}`);
    if (!versionId)
      throw new WorkerDeployRefusedError('wrangler versions upload did not report a version id.');
    invokeOrThrow(['versions', 'deploy', `${versionId}@100%`, ...commonArgs, '--yes']);
  } else if (versionsUnsupported(upload)) {
    strategy = 'deploy';
    const deployed = invokeOrThrow(['deploy', ...commonArgs, ...varArgs]);
    versionId = parseVersionId(`${deployed.stdout}\n${deployed.stderr}`);
    if (!versionId)
      throw new WorkerDeployRefusedError('wrangler deploy did not report a version id.');
  } else {
    throw new WorkerDeployRefusedError(
      `wrangler versions upload failed (status ${String(upload.status)}): ${upload.stderr.trim().slice(0, 2000)}`,
    );
  }

  const readiness = await verifyReadiness({
    baseUrl,
    path: '/ready',
    expectedRevision: options.sourceRevision,
    monitoringToken: options.monitoringToken,
    fetchImpl: options.fetchImpl,
    attempts: options.readinessAttempts,
    delayMs: options.readinessDelayMs,
    sleep: options.sleep,
  });

  const evidence: WorkerDeploymentEvidence = {
    kind: 'worker-deployment',
    worker: options.worker,
    target: options.target,
    workerName,
    versionId,
    previousVersionId,
    strategy,
    sourceRevision: options.sourceRevision,
    verified: true,
    verifiedAt: (options.now ?? (() => new Date()))().toISOString(),
    readiness: { url: readiness.url, revision: readiness.revision, attempts: readiness.attempts },
    separationEvidencePath: options.separationEvidencePath,
    configDigest: currentDigest,
    commands,
    rollbackCommand: previousVersionId
      ? `wrangler rollback ${previousVersionId} --config ${configPath}${envArgs(options.target).length ? ` --env ${options.target}` : ''} --yes`
      : `wrangler rollback --config ${configPath}${envArgs(options.target).length ? ` --env ${options.target}` : ''} (previous version id unknown; pick from wrangler versions list)`,
  };
  writeJsonEvidence(options.evidencePath, evidence);
  return evidence;
}

export function defaultWorkerEvidencePath(
  rootDir: string,
  worker: CustomerWorker,
  target: DeployTarget,
): string {
  return path.join(rootDir, 'test-results', 'deploy', `worker-${worker}-${target}.json`);
}

/** Injectable seams for the CLI entrypoint so tests can drive `main` without real wrangler. */
export type WorkerDeployMainDeps = Pick<
  WorkerDeployOptions,
  'runner' | 'fetchImpl' | 'sleep' | 'now' | 'readinessAttempts' | 'readinessDelayMs'
>;

export async function main(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  deps: WorkerDeployMainDeps = {},
): Promise<number> {
  const { flags } = parseFlags(argv);
  const target = parseDeployTarget(flagString(flags, 'env'));
  const worker = flagString(flags, 'worker') ?? '';
  if (!isCustomerWorker(worker)) {
    throw new Error(
      '--worker must be one of booking-short-links|email-queue-gateway|sms-summary-gateway|operational-control.',
    );
  }
  const rootDir = flagString(flags, 'root') ?? process.cwd();
  const evidence = await deployWorker({
    worker,
    target,
    sourceRevision: flagString(flags, 'revision') ?? env.NABATABLE_SOURCE_REVISION ?? '',
    monitoringToken: env.MONITORING_TOKEN ?? '',
    rootDir,
    separationEvidencePath:
      flagString(flags, 'separation-evidence') ?? separationEvidencePath(rootDir, target),
    evidencePath:
      flagString(flags, 'evidence') ?? defaultWorkerEvidencePath(rootDir, worker, target),
    baseUrl: flagString(flags, 'url'),
    skipMigrations: flagBoolean(flags, 'skip-migrations'),
    env,
    ...deps,
  });
  process.stdout.write(
    `deployed ${evidence.workerName} version ${evidence.versionId} (${evidence.strategy}) revision ${evidence.sourceRevision} verified\nrollback: ${evidence.rollbackCommand}\n`,
  );
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'workers.ts') {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
