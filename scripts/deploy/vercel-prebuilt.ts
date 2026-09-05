import path from 'node:path';
import process from 'node:process';

import { ENVIRONMENTS } from './environments';
import { parseDeployTarget, writeJsonEvidence, type DeployTarget } from './evidence';
import {
  flagBoolean,
  flagString,
  parseFlags,
  runOrThrow,
  spawnCommandRunner,
  type CommandRunner,
} from './exec';
import { assertProviderCli, type ProviderCliCheck } from './provider-clis';
import { verifyReadiness, type FetchLike } from './readiness';

/**
 * Vercel prebuilt deployment.
 *
 * The Vercel CLI is not a workspace dependency: deploy.yml installs the version pinned in
 * scripts/deploy/provider-clis.json and `assertProviderCli` refuses to start on a missing
 * or drifted binary.
 *
 * Flags relied upon (Vercel CLI):
 * - `vercel pull --yes --environment=<env>`: fetches project settings + env for the target
 *   so `vercel build` compiles with the same configuration the deployment will run with.
 * - `vercel build --yes [--prod|--target=staging]`: compiles into `.vercel/output` locally.
 *   NABATABLE_SOURCE_REVISION is exported into the build process so the compiled app bakes
 *   the exact source SHA that readiness later reports. Vercel supplies VERCEL_DEPLOYMENT_ID
 *   itself at deploy time, which the app exposes as NABATABLE_BUILD_ID.
 * - `vercel deploy --prebuilt --skip-domain --yes [--prod|--target=staging]`:
 *   `--prebuilt` uploads `.vercel/output` verbatim (no remote rebuild, so the artifact we
 *   verified is the artifact that ships); `--skip-domain` stops Vercel from aliasing the
 *   deployment onto the environment domain, keeping it immutable and un-promoted until
 *   `deploy:vercel:promote` runs against verified evidence; `--prod`/`--target` selects the
 *   environment configuration without promoting because of `--skip-domain`; `--yes`
 *   disables interactive prompts. The immutable deployment URL is printed on stdout.
 * - `vercel inspect <url>`: resolves the immutable deployment id (`dpl_...`) for promotion
 *   and rollback evidence.
 */
export const ACTIVE_RUNTIME = 'node22';
export const CANDIDATE_RUNTIME = 'node24';
export const RUNTIME_QUALIFICATION_NOTE =
  'Production Vercel already runs Node 24; hosted workflows stay on Node 22 until the CI profiles are qualified on Node 24.';

export type VercelDeploymentEvidence = {
  readonly kind: 'vercel-deployment';
  readonly target: DeployTarget;
  readonly deploymentId: string;
  readonly deploymentUrl: string;
  readonly sourceRevision: string;
  readonly verified: boolean;
  readonly verifiedAt: string;
  readonly readiness: {
    readonly url: string;
    readonly revision: string;
    readonly buildId: string | null;
    readonly attempts: number;
  };
  readonly commands: readonly string[];
  readonly providerCli: ProviderCliCheck;
  readonly activeRuntime: typeof ACTIVE_RUNTIME;
  readonly candidateRuntime: typeof CANDIDATE_RUNTIME;
  readonly runtimeQualificationNote: string;
};

export type VercelPrebuiltOptions = {
  readonly target: DeployTarget;
  readonly sourceRevision: string;
  readonly monitoringToken: string;
  readonly rootDir: string;
  readonly evidencePath: string;
  readonly runner?: CommandRunner;
  readonly fetchImpl?: FetchLike;
  readonly env?: NodeJS.ProcessEnv;
  readonly readinessAttempts?: number;
  readonly readinessDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => Date;
  readonly providerCliPinsPath?: string;
};

const DEPLOYMENT_URL_PATTERN = /https:\/\/[a-z0-9][a-z0-9.-]*\.vercel\.app\b/giu;
const DEPLOYMENT_ID_PATTERN = /\bdpl_[A-Za-z0-9]+\b/u;

export function parseDeploymentUrl(stdout: string): string {
  const matches = stdout.match(DEPLOYMENT_URL_PATTERN);
  const last = matches?.[matches.length - 1];
  if (!last) throw new Error('vercel deploy did not print a deployment URL; refusing to continue.');
  return last;
}

export function parseDeploymentId(stdout: string): string {
  const match = stdout.match(DEPLOYMENT_ID_PATTERN);
  if (!match) throw new Error('vercel inspect did not report a deployment id (dpl_...).');
  return match[0];
}

export function pullArgs(target: DeployTarget): readonly string[] {
  return ['pull', '--yes', `--environment=${target}`];
}

export function buildArgs(target: DeployTarget): readonly string[] {
  return ['build', '--yes', ...ENVIRONMENTS[target].vercelTargetFlag];
}

export function deployArgs(target: DeployTarget): readonly string[] {
  return [
    'deploy',
    '--prebuilt',
    '--skip-domain',
    '--yes',
    ...ENVIRONMENTS[target].vercelTargetFlag,
  ];
}

export async function deployVercelPrebuilt(
  options: VercelPrebuiltOptions,
): Promise<VercelDeploymentEvidence> {
  if (!/^[0-9a-f]{40}$/u.test(options.sourceRevision)) {
    throw new Error('sourceRevision must be a 40-hex git SHA (NABATABLE_SOURCE_REVISION).');
  }
  if (!options.monitoringToken) {
    throw new Error('MONITORING_TOKEN is required to verify the deployment; refusing to deploy.');
  }
  const runner = options.runner ?? spawnCommandRunner;
  const baseEnv = options.env ?? process.env;
  const buildEnv: NodeJS.ProcessEnv = {
    ...baseEnv,
    NABATABLE_SOURCE_REVISION: options.sourceRevision,
    VERCEL_TARGET_ENV: options.target,
  };
  const providerCli = assertProviderCli({
    cli: 'vercel',
    runner,
    cwd: options.rootDir,
    env: baseEnv,
    pinsPath: options.providerCliPinsPath,
  });
  const commands: string[] = [];
  const run = (args: readonly string[], env: NodeJS.ProcessEnv) => {
    commands.push(`vercel ${args.join(' ')}`);
    return runOrThrow(runner, 'vercel', args, { cwd: options.rootDir, env });
  };

  run(pullArgs(options.target), buildEnv);
  run(buildArgs(options.target), buildEnv);
  const deployment = run(deployArgs(options.target), buildEnv);
  const deploymentUrl = parseDeploymentUrl(deployment.stdout);
  const inspect = run(['inspect', deploymentUrl], buildEnv);
  const deploymentId = parseDeploymentId(`${inspect.stdout}\n${inspect.stderr}`);

  const bypassSecret = baseEnv.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const readiness = await verifyReadiness({
    baseUrl: deploymentUrl,
    path: '/api/ready',
    expectedRevision: options.sourceRevision,
    monitoringToken: options.monitoringToken,
    ...(bypassSecret ? { headers: { 'x-vercel-protection-bypass': bypassSecret } } : {}),
    fetchImpl: options.fetchImpl,
    attempts: options.readinessAttempts,
    delayMs: options.readinessDelayMs,
    sleep: options.sleep,
  });

  const evidence: VercelDeploymentEvidence = {
    kind: 'vercel-deployment',
    target: options.target,
    deploymentId,
    deploymentUrl,
    sourceRevision: options.sourceRevision,
    verified: true,
    verifiedAt: (options.now ?? (() => new Date()))().toISOString(),
    readiness: {
      url: readiness.url,
      revision: readiness.revision,
      buildId: readiness.buildId,
      attempts: readiness.attempts,
    },
    commands,
    providerCli,
    activeRuntime: ACTIVE_RUNTIME,
    candidateRuntime: CANDIDATE_RUNTIME,
    runtimeQualificationNote: RUNTIME_QUALIFICATION_NOTE,
  };
  writeJsonEvidence(options.evidencePath, evidence);
  return evidence;
}

export function defaultVercelEvidencePath(rootDir: string, target: DeployTarget): string {
  return path.join(rootDir, 'test-results', 'deploy', `vercel-${target}.json`);
}

export async function main(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const { flags } = parseFlags(argv);
  const target = parseDeployTarget(flagString(flags, 'env'));
  const rootDir = flagString(flags, 'root') ?? process.cwd();
  const sourceRevision = flagString(flags, 'revision') ?? env.NABATABLE_SOURCE_REVISION ?? '';
  const monitoringToken = env.MONITORING_TOKEN ?? '';
  const evidencePath = flagString(flags, 'evidence') ?? defaultVercelEvidencePath(rootDir, target);
  if (flagBoolean(flags, 'dry-run')) {
    process.stdout.write(
      `${JSON.stringify(
        {
          target,
          commands: [pullArgs(target), buildArgs(target), deployArgs(target)].map(
            (args) => `vercel ${args.join(' ')}`,
          ),
          readiness: '/api/ready',
          evidencePath,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }
  const evidence = await deployVercelPrebuilt({
    target,
    sourceRevision,
    monitoringToken,
    rootDir,
    evidencePath,
    env,
  });
  process.stdout.write(
    `deployed ${evidence.deploymentId} (${evidence.deploymentUrl}) revision ${evidence.sourceRevision} verified\nevidence: ${evidencePath}\n`,
  );
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'vercel-prebuilt.ts') {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
