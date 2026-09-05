import { isCredentialLikeKey } from '../../contracts/credential-guard';
import type { ExecutorResources } from '../types';

/**
 * Hardened `docker` argv builders.
 *
 * Every argument is constructed here from validated inputs; nothing from the
 * request tuple or from container output is ever spliced into a docker command.
 * The default docker context is never used or modified; every command carries
 * an explicit `--context`.
 */

export const CONTAINER_WORKDIR = '/workspace';
export const CONTAINER_HOME = '/home/ci';
export const CONTAINER_TMPDIR = `${CONTAINER_HOME}/tmp`;
export const CONTAINER_HOSTNAME = 'ci-job';

/** Environment keys allowed on prepare steps in addition to the profile env. */
export const PREPARE_PROXY_ENV_KEYS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'NO_PROXY',
  'no_proxy',
] as const;

const NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/u;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const IMAGE_PATTERN = /^[a-z0-9][a-z0-9._/-]*@sha256:[0-9a-f]{64}$/u;
const SIZE_PATTERN = /^\d+[kmg]$/u;
/** Same shape the profile contract enforces for credential-shaped env values. */
const DUMMY_VALUE_PATTERN = /^test-[a-z0-9-]+$/u;
const FORBIDDEN_FLAG_PREFIXES = [
  '--privileged',
  '--pid',
  '--userns',
  '--cgroupns',
  '--device',
  '--cap-add',
  '--volume',
  '-v',
  '--mount',
  '--network',
  '--net',
  '--security-opt',
  '--env',
  '-e',
  '--env-file',
  '--user',
  '-u',
];

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export class DockerArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DockerArgumentError';
  }
}

export interface DockerContextSpec {
  readonly context: string;
  /** Contexts that must never be touched (`default`, `desktop-linux`, ...). */
  readonly protectedContexts: readonly string[];
}

export interface DockerJobSpec extends DockerContextSpec {
  readonly jobId: string;
  readonly image: string;
  readonly seccompProfilePath: string;
  readonly user: string;
  readonly resources: ExecutorResources;
  readonly env: Readonly<Record<string, string>>;
  readonly allowedEnvKeys: readonly string[];
  /** Pre-created internal job network inside the guest. */
  readonly network: string;
}

export interface DockerJobNames {
  readonly container: string;
  readonly workspaceVolume: string;
  readonly homeVolume: string;
}

export function dockerJobNames(jobId: string): DockerJobNames {
  assertName(jobId, 'jobId');
  return {
    container: `${jobId}-job`,
    workspaceVolume: `${jobId}-workspace`,
    homeVolume: `${jobId}-home`,
  };
}

export function assertName(value: string, what: string): void {
  if (!NAME_PATTERN.test(value)) {
    throw new DockerArgumentError(`${what} "${value}" is not a safe docker name`);
  }
}

export function assertContext(spec: DockerContextSpec): void {
  assertName(spec.context, 'docker context');
  if (spec.context === 'default' || spec.protectedContexts.includes(spec.context)) {
    throw new DockerArgumentError(
      `docker context "${spec.context}" is protected and must never be used for CI jobs`,
    );
  }
}

/**
 * Reject anything that could be interpreted as a docker flag or that carries
 * control characters. Applied to every free-form value that lands in argv.
 */
export function assertNoFlagInjection(values: readonly string[], what: string): void {
  for (const value of values) {
    if (value.startsWith('-')) {
      throw new DockerArgumentError(`${what} "${value}" looks like a docker flag and is rejected`);
    }
    if (hasControlCharacters(value)) {
      throw new DockerArgumentError(`${what} contains control characters and is rejected`);
    }
    for (const prefix of FORBIDDEN_FLAG_PREFIXES) {
      if (value === prefix || value.startsWith(`${prefix}=`)) {
        throw new DockerArgumentError(`${what} "${value}" attempts to pass a docker flag`);
      }
    }
  }
}

/**
 * Only keys from the profile's sanitized env (plus proxy keys on prepare steps)
 * may reach the container. Values must be single-line and flag-free, and any
 * credential-shaped key must carry an obviously fake `test-*` value.
 */
export function assertSanitizedEnv(
  env: Readonly<Record<string, string>>,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set<string>(allowedKeys);
  for (const [key, value] of Object.entries(env)) {
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new DockerArgumentError(`environment key "${key}" is not a valid identifier`);
    }
    if (!allowed.has(key)) {
      throw new DockerArgumentError(
        `environment key "${key}" is not part of the sanitized profile env`,
      );
    }
    if (hasControlCharacters(value)) {
      throw new DockerArgumentError(`environment value for "${key}" contains control characters`);
    }
    if (value.startsWith('-')) {
      throw new DockerArgumentError(`environment value for "${key}" looks like a flag`);
    }
    if (isCredentialLikeKey(key) && !DUMMY_VALUE_PATTERN.test(value)) {
      throw new DockerArgumentError(
        `environment key "${key}" is credential-shaped and must carry a test-* dummy value`,
      );
    }
  }
}

function envArgs(env: Readonly<Record<string, string>>): string[] {
  return Object.keys(env)
    .sort()
    .flatMap((key) => ['--env', `${key}=${env[key]}`]);
}

function assertResources(resources: ExecutorResources): void {
  if (!Number.isFinite(resources.cpus) || resources.cpus <= 0 || resources.cpus > 64) {
    throw new DockerArgumentError('resources.cpus must be between 0 and 64');
  }
  if (
    !Number.isSafeInteger(resources.pidsLimit) ||
    resources.pidsLimit <= 0 ||
    resources.pidsLimit > 65_536
  ) {
    throw new DockerArgumentError('resources.pidsLimit must be a positive integer');
  }
  for (const [name, value] of [
    ['memory', resources.memory],
    ['tmpfsSize', resources.tmpfsSize],
    ['shmSize', resources.shmSize],
  ] as const) {
    if (!SIZE_PATTERN.test(value)) {
      throw new DockerArgumentError(`resources.${name} must look like 8g`);
    }
  }
}

/**
 * `docker run` argv for the job container. The container idles on `sleep
 * infinity`; steps run through `docker exec` so the supervisor owns ordering,
 * timeouts and exit status.
 *
 * Network: the container joins the guest's pre-created `--internal` job network
 * only. It has no route to anything but the guest bridge address, and the
 * nftables policy in infra/local-ci/network/egress.sh drops even that except
 * for the proxy port while the executor holds phase `prep`. In phase `test`
 * the job_to_proxy chain is empty, so the network is equivalent to `none`.
 */
export function buildDockerRunArgs(spec: DockerJobSpec): readonly string[] {
  assertContext(spec);
  const names = dockerJobNames(spec.jobId);
  if (!IMAGE_PATTERN.test(spec.image)) {
    throw new DockerArgumentError('job image must be a digest-pinned reference (name@sha256:...)');
  }
  if (!/^\d+:\d+$/u.test(spec.user) || spec.user.startsWith('0:')) {
    throw new DockerArgumentError('container user must be a non-root uid:gid pair');
  }
  if (!spec.seccompProfilePath.startsWith('/') || /[\n\r\t,]/u.test(spec.seccompProfilePath)) {
    throw new DockerArgumentError('seccomp profile path must be absolute and free of separators');
  }
  assertName(spec.network, 'job network');
  if (spec.network === 'bridge' || spec.network === 'host' || spec.network === 'none') {
    throw new DockerArgumentError('job network must be the dedicated internal job network');
  }
  assertResources(spec.resources);
  assertSanitizedEnv(spec.env, spec.allowedEnvKeys);
  assertNoFlagInjection(Object.values(spec.env), 'environment value');

  return [
    '--context',
    spec.context,
    'run',
    '--detach',
    '--name',
    names.container,
    '--hostname',
    CONTAINER_HOSTNAME,
    '--user',
    spec.user,
    '--cap-drop=ALL',
    '--security-opt',
    'no-new-privileges',
    '--security-opt',
    `seccomp=${spec.seccompProfilePath}`,
    '--pids-limit',
    String(spec.resources.pidsLimit),
    '--memory',
    spec.resources.memory,
    '--memory-swap',
    spec.resources.memory,
    '--cpus',
    String(spec.resources.cpus),
    '--network',
    spec.network,
    '--shm-size',
    spec.resources.shmSize,
    '--read-only',
    '--tmpfs',
    `/tmp:rw,noexec,nosuid,nodev,size=${spec.resources.tmpfsSize}`,
    '--mount',
    `type=volume,src=${names.workspaceVolume},dst=${CONTAINER_WORKDIR}`,
    '--mount',
    `type=volume,src=${names.homeVolume},dst=${CONTAINER_HOME}`,
    '--workdir',
    CONTAINER_WORKDIR,
    '--init',
    '--label',
    `nabatable.ci.job=${spec.jobId}`,
    ...envArgs(spec.env),
    spec.image,
    'sleep',
    'infinity',
  ];
}

export interface DockerExecSpec extends DockerContextSpec {
  readonly container: string;
  readonly user: string;
  readonly env: Readonly<Record<string, string>>;
  readonly allowedEnvKeys: readonly string[];
  readonly command: readonly string[];
}

export function buildDockerExecArgs(spec: DockerExecSpec): readonly string[] {
  assertContext(spec);
  assertName(spec.container, 'container');
  assertSanitizedEnv(spec.env, spec.allowedEnvKeys);
  assertNoFlagInjection(Object.values(spec.env), 'environment value');
  if (spec.command.length === 0) {
    throw new DockerArgumentError('exec command must not be empty');
  }
  assertNoFlagInjection([spec.command[0]], 'exec command');
  if (spec.command.some((part) => hasControlCharacters(part))) {
    throw new DockerArgumentError('exec command contains control characters');
  }
  return [
    '--context',
    spec.context,
    'exec',
    '--user',
    spec.user,
    '--workdir',
    CONTAINER_WORKDIR,
    ...envArgs(spec.env),
    spec.container,
    ...spec.command,
  ];
}

export function buildDockerSimpleArgs(
  spec: DockerContextSpec,
  ...args: readonly string[]
): readonly string[] {
  assertContext(spec);
  return ['--context', spec.context, ...args];
}
