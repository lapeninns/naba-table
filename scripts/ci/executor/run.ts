import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_COLLECT_POLICY,
  harvestStagedArtefacts,
  stageArtefactsFromContainer,
  type HarvestResult,
} from '../evidence/collect';
import { buildResults, canonicalJson, type BuiltResult } from '../evidence/result';
import { applyLogRetention, type RetentionReport } from '../evidence/retention';
import {
  assertConfigured,
  loadExecutorConfig,
  R2_OBJECT_TTL_DAYS,
  type ExecutorConfig,
} from './config';
import {
  buildDockerExecArgs,
  buildDockerRunArgs,
  buildDockerSimpleArgs,
  CONTAINER_WORKDIR,
  dockerJobNames,
  PREPARE_PROXY_ENV_KEYS,
  type DockerContextSpec,
} from './docker/command';
import { setEgressPhase } from './lima/egress';
import {
  dockerContextSpec,
  planLima,
  sha256File,
  withLimaInstance,
  type LimaDestroyReport,
  type LimaHandle,
  type LimaInstanceInput,
} from './lima/instance';
import { allowedEnvKeys, resolveExecutorProfile } from './profiles';
import { loadR2Credentials } from './r2/credentials';
import {
  evidenceObjectKey,
  uploadEvidence,
  type FetchLike,
  type UploadedObject,
} from './r2/upload';
import { ciJobId, parseRequestEnvelope } from './request';
import { assertSucceeded, renderCommand, type CommandRunner } from './runner';
import { createSpoolBundle, planSpool, type SpoolDeps, type SpoolInput } from './spool/bundle';
import { acquireSourceToken } from './spool/source-auth';
import { runSupervisor } from './supervisor/run';
import type {
  CiRequest,
  ExecutorProfile,
  ProbedRuntime,
  RequestEnvelope,
  StopSignal,
  SupervisorResult,
} from './types';

/**
 * Executor orchestration: spool -> lima -> docker -> supervisor -> evidence -> r2.
 * The Lima instance is always destroyed, whatever happens in between.
 */

export interface ExecutorDeps {
  readonly runner: CommandRunner;
  readonly fetch: FetchLike;
  readonly acquireFetchToken?: SpoolDeps['acquireFetchToken'];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly repoRoot: string;
  readonly now?: () => Date;
  readonly digestFile?: (filePath: string) => Promise<string>;
  readonly log?: (line: string) => void;
  /** Controller stop signal (from --control-file); polled at suite boundaries. */
  readonly stopSignal?: () => StopSignal;
  /** Called on progress so the controller can extend its lease. */
  readonly touch?: () => void;
}

export interface ExecutorRun {
  readonly jobId: string;
  readonly jobDir: string;
  readonly built: BuiltResult;
  readonly uploaded: readonly UploadedObject[];
  readonly destroy: LimaDestroyReport;
  readonly retention: RetentionReport;
}

/** Tuple-level refusal: the request is well-formed but must not run here. */
export class ExecutorRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutorRefusalError';
  }
}

/** Wraps any failure after the request was accepted so the caller can still emit a result. */
export class ExecutorFailure extends Error {
  constructor(
    readonly cause: unknown,
    readonly request: CiRequest,
    readonly profile: ExecutorProfile | null,
    readonly startedAt: Date,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ExecutorFailure';
  }
}

const GUEST_BUNDLE_NAME = 'job.bundle';
const CHECKOUT_TIMEOUT_MS = 10 * 60_000;

function pathEnv(env: Readonly<Record<string, string | undefined>>): string {
  return env.PATH ?? '/usr/local/bin:/usr/bin:/bin';
}

function limaHome(env: Readonly<Record<string, string | undefined>>): string {
  if (env.LIMA_HOME) return env.LIMA_HOME;
  return path.join(env.HOME ?? '/var/empty', '.lima');
}

function prepareProxyEnv(config: ExecutorConfig): Readonly<Record<string, string>> {
  // Dependency preparation may only reach the outbound proxy. NO_PROXY is empty
  // on purpose so nothing bypasses it; the guest nftables rules deny everything
  // except the proxy address, and only while the egress phase is `prep`.
  const proxy = config.docker.egressProxyUrl;
  return Object.fromEntries(
    PREPARE_PROXY_ENV_KEYS.map((key) => [key, key.toLowerCase().startsWith('no_') ? '' : proxy]),
  );
}

function checkoutCommands(jobId: string, testedSha: string): readonly (readonly string[])[] {
  const ref = `refs/ci/${jobId}/tested`;
  return [
    ['mkdir', '-p', `${CONTAINER_WORKDIR}/.home`],
    ['git', 'init', '--quiet', '--initial-branch=ci', CONTAINER_WORKDIR],
    [
      'git',
      'fetch',
      '--quiet',
      '--no-tags',
      `${CONTAINER_WORKDIR}/${GUEST_BUNDLE_NAME}`,
      `${ref}:refs/ci/tested`,
    ],
    ['git', 'checkout', '--quiet', '--detach', testedSha],
    ['rm', '-f', `${CONTAINER_WORKDIR}/${GUEST_BUNDLE_NAME}`],
  ];
}

function verifyImageDigest(request: CiRequest, config: ExecutorConfig, profile: ExecutorProfile) {
  if (request.imageDigest !== config.docker.imageDigest) {
    throw new ExecutorRefusalError(
      `request imageDigest ${request.imageDigest} does not match the configured job image ${config.docker.image}`,
    );
  }
  if (profile.jobImageDigest !== null && profile.jobImageDigest !== request.imageDigest) {
    throw new ExecutorRefusalError(
      `request imageDigest ${request.imageDigest} does not match profile ${profile.name} image digest ${profile.jobImageDigest}`,
    );
  }
}

export interface DryRunPlanInput {
  readonly rawRequest: unknown;
  readonly deps: Pick<ExecutorDeps, 'env' | 'repoRoot' | 'now'>;
}

/** Print everything the executor would do, without touching git, lima, docker, disk or the network. */
export function renderDryRunPlan(input: DryRunPlanInput): string {
  const loaded = loadExecutorConfig(input.deps.env, input.deps.repoRoot);
  const { config } = loaded;
  const now = input.deps.now ?? (() => new Date());
  const lines: string[] = [];
  lines.push(`executor dry-run (config source: ${loaded.source})`);
  if (loaded.problems.length > 0) {
    lines.push('UNCONFIGURED: a real run would refuse because:');
    for (const problem of loaded.problems) lines.push(`  - ${problem}`);
  }

  let envelope: RequestEnvelope;
  try {
    envelope = parseRequestEnvelope(input.rawRequest, config.repositoryId);
  } catch (error) {
    lines.push(`REQUEST REJECTED: ${(error as Error).message}`);
    return `${lines.join('\n')}\n`;
  }
  const { request } = envelope;
  let profile: ExecutorProfile;
  try {
    profile = resolveExecutorProfile({
      request,
      changedPaths: null,
      allocation: envelope.allocation,
    });
    if (config.docker.imageDigest === '') {
      lines.push('imageDigest check: skipped in dry-run because the job image is unconfigured');
    } else {
      verifyImageDigest(request, config, profile);
    }
  } catch (error) {
    lines.push(`REQUEST REFUSED: ${(error as Error).message}`);
    return `${lines.join('\n')}\n`;
  }

  const jobId = ciJobId(request);
  const jobDir = path.join(config.jobRoot, jobId);
  const names = dockerJobNames(jobId);
  const docker = dockerContextSpec(config.lima);
  lines.push(
    `request: profile=${request.profile} policy=${request.policyVersion} tested=${request.testedSha} head=${request.headSha} base=${request.baseSha} attempt=${request.attempt}`,
  );
  lines.push(`job: ${jobId} -> ${jobDir}`);
  lines.push('spool:');
  const spoolInput: SpoolInput = {
    request,
    spoolRoot: config.spoolRoot,
    remoteUrl: config.sourceRemoteUrl,
    jobId,
  };
  for (const step of planSpool(spoolInput)) {
    lines.push(`  [${step.purpose}] ${renderCommand(step)}`);
  }
  lines.push('lima:');
  const limaInput: LimaInstanceInput = {
    jobId,
    config: config.lima,
    jobDir,
    limaHome: limaHome(input.deps.env),
  };
  for (const step of planLima(
    limaInput,
    path.join(config.spoolRoot, String(request.repositoryId), 'bundles', `${jobId}.bundle`),
  )) {
    lines.push(`  [${step.purpose}] ${renderCommand(step)}`);
  }
  lines.push('docker:');
  lines.push(
    `  docker ${renderCommand({ command: '', args: buildDockerSimpleArgs(docker, 'network', 'inspect', config.docker.jobNetwork) }).trim()}`,
  );
  try {
    const runArgs = buildDockerRunArgs({
      ...docker,
      jobId,
      image: config.docker.image,
      seccompProfilePath: config.docker.seccompProfilePath,
      user: config.docker.user,
      resources: profile.resources,
      env: profile.env,
      allowedEnvKeys: allowedEnvKeys(profile),
      network: config.docker.jobNetwork,
    });
    lines.push(`  docker ${renderCommand({ command: '', args: runArgs }).trim()}`);
  } catch (error) {
    lines.push(`  docker run: REJECTED (${(error as Error).message})`);
  }
  lines.push('checkout (inside container, verified against testedSha):');
  for (const command of checkoutCommands(jobId, request.testedSha)) {
    lines.push(`  ${renderCommand({ command: command[0], args: command.slice(1) })}`);
  }
  lines.push(
    `supervisor: profile=${profile.name} hard-timeout=${profile.profileTimeoutMs}ms egress-script=${config.lima.egressScript}`,
  );
  for (const suite of profile.suites) {
    lines.push(
      `  suite ${suite.id} (${suite.displayName}) hard-limit=${suite.hardLimitMs}ms p95=${suite.p95BudgetMs}ms`,
    );
    for (const stepId of suite.stepIds) {
      const step = profile.steps.find((candidate) => candidate.id === stepId);
      if (!step) continue;
      lines.push(
        `    [${step.phase}] ${step.id}: ${renderCommand({ command: step.command[0], args: step.command.slice(1) })} (timeout ${step.timeoutMs}ms)`,
      );
    }
  }
  for (const skipped of profile.skippedSuites) {
    lines.push(`  suite ${skipped.suiteId}: SKIPPED (${skipped.reason})`);
  }
  lines.push(
    `  network: ${config.docker.jobNetwork} (internal); phase prep => proxy ${config.docker.egressProxyUrl} only; phase test => no egress`,
  );
  lines.push(
    `evidence: roots=${profile.artefactPaths.join(',')} perFile<=${DEFAULT_COLLECT_POLICY.perFileBytes} total<=${DEFAULT_COLLECT_POLICY.totalBytes}`,
  );
  lines.push(
    `r2: ${config.r2.endpoint}/${config.r2.bucket} key=${evidenceObjectKey({ ...config.r2, keyPrefix: config.r2.keyPrefix || 'ci-evidence' }, jobId, 'result.json', now())} (lifecycle ${R2_OBJECT_TTL_DAYS} days)`,
  );
  lines.push(
    `retention: ${config.retention.maxAgeMs}ms / ${config.retention.maxTotalBytes} bytes under ${config.jobRoot}`,
  );
  lines.push(`container: ${names.container}; workspace volume: ${names.workspaceVolume}`);
  lines.push('dry-run: nothing executed');
  return `${lines.join('\n')}\n`;
}

interface JobBody {
  readonly supervisor: SupervisorResult;
  readonly harvest: HarvestResult;
  readonly probed: ProbedRuntime | null;
}

interface JobContext {
  readonly request: CiRequest;
  readonly profile: ExecutorProfile;
  readonly config: ExecutorConfig;
  readonly jobId: string;
  readonly jobDir: string;
  readonly bundlePath: string;
  readonly deps: ExecutorDeps;
  readonly handle: LimaHandle;
}

async function runJobInInstance(ctx: JobContext): Promise<JobBody> {
  const { request, profile, config, jobId, jobDir, deps, handle } = ctx;
  const names = dockerJobNames(jobId);
  const docker: DockerContextSpec = handle.docker;
  const dockerEnv = {
    PATH: pathEnv(deps.env),
    HOME: deps.env.HOME ?? '/var/empty',
    DOCKER_CONFIG: path.join(jobDir, '.docker'),
  };
  const dockerRun = async (args: readonly string[], purpose: string, timeoutMs = 5 * 60_000) => {
    const result = await deps.runner.run({
      command: 'docker',
      args,
      env: dockerEnv,
      purpose,
      timeoutMs,
    });
    assertSucceeded(result, purpose);
    return result;
  };
  const exec = (command: readonly string[], purpose: string, timeoutMs: number) =>
    dockerRun(
      buildDockerExecArgs({
        ...docker,
        container: names.container,
        user: config.docker.user,
        env: profile.env,
        allowedEnvKeys: allowedEnvKeys(profile),
        command,
      }),
      purpose,
      timeoutMs,
    );

  const guestBundle = `${config.lima.guestSpoolDir}/${GUEST_BUNDLE_NAME}`;
  await handle.shell(['mkdir', '-p', config.lima.guestSpoolDir], 'create guest spool dir', 60_000);
  await handle.copyIn(ctx.bundlePath, guestBundle);

  // The job network is pre-created by infra/local-ci/network/setup.sh; refuse to
  // run on anything else, and refuse if it is not internal.
  const network = await dockerRun(
    buildDockerSimpleArgs(
      docker,
      'network',
      'inspect',
      '--format',
      '{{.Internal}}',
      config.docker.jobNetwork,
    ),
    'inspect job network',
    60_000,
  );
  if (network.stdout.trim() !== 'true') {
    throw new Error(`job network ${config.docker.jobNetwork} is missing or not internal`);
  }

  await dockerRun(
    buildDockerSimpleArgs(docker, 'volume', 'create', names.workspaceVolume),
    'create workspace volume',
  );
  await dockerRun(
    buildDockerRunArgs({
      ...docker,
      jobId,
      image: config.docker.image,
      seccompProfilePath: config.docker.seccompProfilePath,
      user: config.docker.user,
      resources: profile.resources,
      env: profile.env,
      allowedEnvKeys: allowedEnvKeys(profile),
      network: config.docker.jobNetwork,
    }),
    'start job container',
  );
  // The bundle moves guest -> container inside the VM; the container never sees the host.
  await handle.shell(
    ['docker', 'cp', guestBundle, `${names.container}:${CONTAINER_WORKDIR}/${GUEST_BUNDLE_NAME}`],
    'copy bundle into container',
    5 * 60_000,
  );

  for (const command of checkoutCommands(jobId, request.testedSha)) {
    await exec(command, `checkout: ${command.slice(0, 2).join(' ')}`, CHECKOUT_TIMEOUT_MS);
  }
  const head = await exec(['git', 'rev-parse', 'HEAD'], 'verify checked-out commit', 60_000);
  if (head.stdout.trim() !== request.testedSha) {
    throw new Error(
      `checked-out commit ${head.stdout.trim()} does not equal testedSha ${request.testedSha}`,
    );
  }

  let probed: ProbedRuntime | null = null;
  try {
    const node = await exec(['node', '--version'], 'probe node version', 60_000);
    const pnpm = await exec(['pnpm', '--version'], 'probe pnpm version', 60_000);
    probed = { nodeVersion: node.stdout.trim(), pnpmVersion: pnpm.stdout.trim() };
  } catch {
    probed = null;
  }

  const stagingDir = path.join(jobDir, 'staging');
  let supervisor: SupervisorResult;
  try {
    supervisor = await runSupervisor(
      {
        profile,
        docker,
        container: names.container,
        user: config.docker.user,
        dockerEnv,
        logDir: path.join(stagingDir, 'logs'),
        prepareEnv: prepareProxyEnv(config),
        onPhase: (phase) =>
          setEgressPhase(handle, config.lima.egressScript, phase === 'prepare' ? 'prep' : 'test'),
        stopSignal: deps.stopSignal,
        onProgress: () => deps.touch?.(),
        oomProbe: async () => {
          const inspect = await deps.runner.run({
            command: 'docker',
            args: buildDockerSimpleArgs(
              docker,
              'inspect',
              '--format',
              '{{.State.OOMKilled}}',
              names.container,
            ),
            env: dockerEnv,
            timeoutMs: 60_000,
            purpose: 'inspect oom state',
          });
          if (inspect.exitCode !== 0) return null;
          return inspect.stdout.trim() === 'true';
        },
      },
      { runner: deps.runner, now: deps.now },
    );
  } finally {
    // Whatever happened, leave the guest isolated before collecting anything.
    await setEgressPhase(handle, config.lima.egressScript, 'test').catch(() => undefined);
  }

  await stageArtefactsFromContainer(
    {
      docker,
      env: dockerEnv,
      container: names.container,
      allowedRoots: profile.artefactPaths,
      stagingDir,
    },
    deps.runner,
  );
  await deps.runner
    .run({
      command: 'docker',
      args: buildDockerSimpleArgs(docker, 'rm', '--force', '--volumes', names.container),
      env: dockerEnv,
      timeoutMs: 120_000,
      purpose: 'remove container',
    })
    .catch(() => undefined);

  const harvest = harvestStagedArtefacts({
    stagingDir,
    evidenceDir: path.join(jobDir, 'evidence'),
    allowedRoots: [...profile.artefactPaths, 'logs'],
  });
  return { supervisor, harvest, probed };
}

export async function executeRequest(
  rawRequest: unknown,
  deps: ExecutorDeps,
): Promise<ExecutorRun> {
  const log = deps.log ?? (() => undefined);
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const config = assertConfigured(loadExecutorConfig(deps.env, deps.repoRoot));
  const envelope = parseRequestEnvelope(rawRequest, config.repositoryId);
  const { request } = envelope;

  // Tuple-level refusals happen before any infrastructure or network is touched.
  const preliminaryProfile = resolveExecutorProfile({
    request,
    changedPaths: null,
    allocation: envelope.allocation,
  });
  verifyImageDigest(request, config, preliminaryProfile);

  let profile: ExecutorProfile | null = null;
  try {
    const jobId = ciJobId(request);
    const jobDir = path.join(config.jobRoot, jobId);
    mkdirSync(jobDir, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(jobDir, 'request.json'), `${canonicalJson(envelope)}\n`, {
      mode: 0o600,
    });

    // Fail closed before any infrastructure is touched: evidence must be uploadable.
    const credentials = await loadR2Credentials({
      env: deps.env,
      keychain: config.keychain,
      runner: deps.runner,
      pathEnv: pathEnv(deps.env),
    });
    if (!credentials.ok) {
      throw new Error(credentials.reason);
    }
    log(`job ${jobId}: r2 credentials from ${credentials.source}`);

    const bundle = await createSpoolBundle(
      { request, spoolRoot: config.spoolRoot, remoteUrl: config.sourceRemoteUrl, jobId },
      {
        runner: deps.runner,
        pathEnv: pathEnv(deps.env),
        acquireFetchToken:
          deps.acquireFetchToken ??
          (() =>
            acquireSourceToken(
              {
                repositoryId: config.repositoryId,
                remoteUrl: config.sourceRemoteUrl,
                keychainAccount: config.keychain.account,
                env: deps.env,
              },
              deps,
            )),
      },
    );
    log(`job ${jobId}: bundle ready (${bundle.bundlePath})`);

    profile = resolveExecutorProfile({
      request,
      changedPaths: bundle.changedPaths,
      allocation: envelope.allocation,
    });
    verifyImageDigest(request, config, profile);
    const fixedProfile = profile;
    log(
      `job ${jobId}: profile ${fixedProfile.name} with ${fixedProfile.steps.length} step(s), ${fixedProfile.skippedSuites.length} skipped suite(s)`,
    );

    const limaInput: LimaInstanceInput = {
      jobId,
      config: config.lima,
      jobDir,
      limaHome: limaHome(deps.env),
    };
    const { value, destroy } = await withLimaInstance(
      limaInput,
      {
        runner: deps.runner,
        pathEnv: pathEnv(deps.env),
        digestFile: deps.digestFile ?? sha256File,
        dockerConfigDir: path.join(jobDir, '.docker'),
      },
      (handle) =>
        runJobInInstance({
          request,
          profile: fixedProfile,
          config,
          jobId,
          jobDir,
          bundlePath: bundle.bundlePath,
          deps,
          handle,
        }),
    );
    log(`job ${jobId}: instance destroyed (${destroy.failures.length} cleanup failure(s))`);

    const evidenceDir = path.join(jobDir, 'evidence');
    mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
    const built = buildResults({
      jobId,
      request,
      profile: fixedProfile,
      supervisor: value.supervisor,
      harvest: value.harvest,
      evidenceDir,
      probed: value.probed,
    });
    const resultPath = path.join(evidenceDir, 'result.json');
    const resultJson = `${canonicalJson(built.result)}\n`;
    writeFileSync(resultPath, resultJson, { mode: 0o600 });
    const reportPath = path.join(evidenceDir, 'executor-report.json');
    const reportJson = `${canonicalJson(built.report)}\n`;
    writeFileSync(reportPath, reportJson, { mode: 0o600 });

    const files = [
      ...built.report.evidence.files.map((file) => ({
        relativePath: file.path,
        absolutePath: path.join(evidenceDir, file.path),
        sha256: file.sha256,
        bytes: file.bytes,
      })),
      {
        relativePath: 'result.json',
        absolutePath: resultPath,
        sha256: createHash('sha256').update(resultJson).digest('hex'),
        bytes: Buffer.byteLength(resultJson),
      },
      {
        relativePath: 'executor-report.json',
        absolutePath: reportPath,
        sha256: createHash('sha256').update(reportJson).digest('hex'),
        bytes: Buffer.byteLength(reportJson),
      },
    ];
    const uploaded = await uploadEvidence(
      { config: config.r2, credentials: credentials.credentials, jobId, files, now },
      { fetch: deps.fetch },
    );
    writeFileSync(path.join(jobDir, 'upload.json'), `${canonicalJson(uploaded)}\n`, {
      mode: 0o600,
    });
    log(`job ${jobId}: uploaded ${uploaded.length} object(s)`);

    const retention = applyLogRetention(config.jobRoot, config.retention, () => now().getTime());
    return { jobId, jobDir, built, uploaded, destroy, retention };
  } catch (error) {
    if (error instanceof ExecutorRefusalError) throw error;
    throw new ExecutorFailure(error, request, profile ?? preliminaryProfile, startedAt);
  }
}
