import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  CI_RESULT_SCHEMA,
  formatCiResultDocument,
  parseCiResult,
  type CiResult,
  type SuiteResult,
} from './ci-result';
import { createGitHubApi, type GateGitHubApi } from './github-api';
import { parseCiRequestTuple, tupleKey, tuplesEqual, type CiRequestTuple } from './tuple';

/**
 * Hosted profile fallback runner.
 *
 * Executes the commands of a resolved CI profile (the JSON printed by
 * `pnpm ci:profile <name> --json` from the protected `main` checkout) inside a
 * separate checkout of the exact `testedSha`, and produces the same
 * `nabatable.ci-result/v1` evidence document the local controller publishes, with
 * `source: hosted-fallback`. The "Fork profile" workflow runs the same code without
 * publishing so fork PRs produce an identical evidence shape.
 *
 * Trust model: this script and the profile definition come from `main`; only the
 * commands run against the candidate tree. Commands receive the profile's sanitized
 * environment plus a fixed allowlist of process variables, never the runner's secrets.
 */

export type CommandRunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type CommandRunner = (
  command: string,
  options: { cwd: string; env: Record<string, string>; timeoutMs: number },
) => CommandRunResult;

export type ResolvedProfileCommand = {
  id: string;
  suiteId: string;
  run: string;
  timeoutMinutes: number;
  effectiveEnv: Record<string, string>;
};

export type ResolvedProfileSuite = { suiteId: string; displayName: string; included: boolean };

export type ResolvedProfileInput = {
  name: string;
  policyVersion: string;
  suites: ResolvedProfileSuite[];
  commands: ResolvedProfileCommand[];
};

export type FallbackRunOptions = {
  profile: ResolvedProfileInput;
  tuple: CiRequestTuple;
  runId: number;
  workdir: string;
  outDir: string;
  runner?: CommandRunner;
  now?: () => Date;
  /** Process variables copied into every command; defaults to a safe allowlist. */
  passthroughEnv?: Record<string, string | undefined>;
  log?: (line: string) => void;
};

/**
 * Commands never see the runner's HOME or RUNNER_TEMP: `$RUNNER_TEMP/_runner_file_commands`
 * carries GITHUB_ENV/GITHUB_PATH for the following steps, and the runner HOME holds the
 * trusted checkout's caches. Each run gets a private HOME and TMPDIR inside the candidate tree.
 */
export const PRIVATE_HOME_DIRNAME = '.fallback-home';
export const PRIVATE_TMP_DIRNAME = '.fallback-tmp';

export function privateCommandDirs(workdir: string): { HOME: string; TMPDIR: string } {
  return {
    HOME: path.join(workdir, PRIVATE_HOME_DIRNAME),
    TMPDIR: path.join(workdir, PRIVATE_TMP_DIRNAME),
  };
}

export type FallbackRunOutcome = {
  result: CiResult;
  passed: boolean;
  logs: Record<string, string>;
};

/**
 * Variables that commands need to find tools and caches; nothing credential-shaped and
 * nothing that locates the runner's own state (HOME, TMPDIR and RUNNER_TEMP are replaced by
 * the private directories from `privateCommandDirs`).
 */
export const PASSTHROUGH_ENV_KEYS = [
  'PATH',
  'LANG',
  'LC_ALL',
  'USER',
  'SHELL',
  'TERM',
  'CI',
  'GITHUB_ACTIONS',
  'RUNNER_OS',
  'COREPACK_ENABLE_DOWNLOAD_PROMPT',
  'COREPACK_HOME',
  'PNPM_HOME',
  'XDG_CACHE_HOME',
  'PLAYWRIGHT_BROWSERS_PATH',
  'NEXT_TELEMETRY_DISABLED',
  'DO_NOT_TRACK',
] as const;

const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

export function parseResolvedProfile(raw: unknown): ResolvedProfileInput {
  if (!isRecord(raw)) throw new Error('resolved profile must be an object');
  if (typeof raw.name !== 'string' || typeof raw.policyVersion !== 'string') {
    throw new Error('resolved profile must carry name and policyVersion');
  }
  if (!Array.isArray(raw.suites) || !Array.isArray(raw.commands)) {
    throw new Error('resolved profile must carry suites and commands arrays');
  }
  const suites: ResolvedProfileSuite[] = raw.suites.map((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.suiteId !== 'string' ||
      typeof entry.displayName !== 'string' ||
      typeof entry.included !== 'boolean'
    ) {
      throw new Error(`resolved profile suites[${index}] is malformed`);
    }
    return { suiteId: entry.suiteId, displayName: entry.displayName, included: entry.included };
  });
  const commands: ResolvedProfileCommand[] = raw.commands.map((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.suiteId !== 'string' ||
      typeof entry.run !== 'string' ||
      typeof entry.timeoutMinutes !== 'number' ||
      !isStringRecord(entry.effectiveEnv)
    ) {
      throw new Error(`resolved profile commands[${index}] is malformed`);
    }
    return {
      id: entry.id,
      suiteId: entry.suiteId,
      run: entry.run,
      timeoutMinutes: entry.timeoutMinutes,
      effectiveEnv: { ...entry.effectiveEnv },
    };
  });
  const suiteIds = new Set(suites.map((suite) => suite.suiteId));
  for (const command of commands) {
    if (!suiteIds.has(command.suiteId)) {
      throw new Error(`command ${command.id} references unknown suite ${command.suiteId}`);
    }
  }
  return { name: raw.name, policyVersion: raw.policyVersion, suites, commands };
}

export function sha256Digest(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

/** Same construction as the controller: sha256 over sorted `name=digest` lines. */
export function bundleDigest(digests: Record<string, string>): string {
  const material = Object.entries(digests)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, digest]) => `${name}=${digest}`)
    .join('\n');
  return sha256Digest(material);
}

export const spawnCommandRunner: CommandRunner = (command, options) => {
  const result = spawnSync('bash', ['-c', command], {
    cwd: options.cwd,
    // The repository augments ProcessEnv with a required NODE_ENV; commands receive
    // exactly the sanitized record built by the caller, nothing implicit.
    env: options.env as NodeJS.ProcessEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: MAX_CAPTURE_BYTES,
  });
  const timedOut =
    result.error !== undefined && 'code' in result.error && result.error.code === 'ETIMEDOUT';
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut,
  };
};

function passthrough(source: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of PASSTHROUGH_ENV_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) env[key] = value;
  }
  return env;
}

export async function runFallbackProfile(options: FallbackRunOptions): Promise<FallbackRunOutcome> {
  const { profile, tuple } = options;
  if (profile.name !== tuple.profile) {
    throw new Error(
      `resolved profile is "${profile.name}" but the tuple requests "${tuple.profile}"`,
    );
  }
  if (profile.policyVersion !== tuple.policyVersion) {
    throw new Error(
      `resolved profile policy ${profile.policyVersion} differs from tuple policy ${tuple.policyVersion}`,
    );
  }
  const runner = options.runner ?? spawnCommandRunner;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => undefined);
  const privateDirs = privateCommandDirs(options.workdir);
  const baseEnv = { ...passthrough(options.passthroughEnv ?? process.env), ...privateDirs };
  const startedAt = now().toISOString();
  mkdirSync(options.outDir, { recursive: true });
  mkdirSync(privateDirs.HOME, { recursive: true });
  mkdirSync(privateDirs.TMPDIR, { recursive: true });

  const suites: SuiteResult[] = [];
  const logs: Record<string, string> = {};
  const digests: Record<string, string> = {};
  for (const suite of profile.suites) {
    const lines: string[] = [`# suite ${suite.suiteId} (${suite.displayName})`];
    let status: SuiteResult['status'] = suite.included ? 'passed' : 'skipped';
    const suiteStarted = Date.now();
    if (!suite.included) {
      lines.push('skipped by the profile conditional rule (recorded, not executed)');
    } else {
      for (const command of profile.commands.filter((entry) => entry.suiteId === suite.suiteId)) {
        if (status === 'failed') {
          lines.push(`## ${command.id}: not run (earlier command failed)`);
          continue;
        }
        log(`[${suite.suiteId}] ${command.run}`);
        const result = runner(command.run, {
          cwd: options.workdir,
          env: { ...baseEnv, ...command.effectiveEnv },
          timeoutMs: command.timeoutMinutes * 60_000,
        });
        lines.push(`## ${command.id}: ${command.run}`);
        lines.push(
          `exit=${result.status === null ? 'signal' : result.status} timedOut=${result.timedOut}`,
        );
        lines.push(result.stdout, result.stderr);
        if (result.status !== 0 || result.timedOut) status = 'failed';
      }
    }
    const content = lines.join('\n');
    const logPath = path.join(options.outDir, `${suite.suiteId}.log`);
    writeFileSync(logPath, content, 'utf8');
    logs[suite.suiteId] = logPath;
    const digest = sha256Digest(content);
    digests[`${suite.suiteId}.log`] = digest;
    suites.push({
      id: suite.suiteId,
      name: suite.displayName,
      status,
      evidenceDigest: digest,
      durationMs: Date.now() - suiteStarted,
    });
  }

  const coverageSuite = suites.find((suite) => suite.id === 'coverage-and-performance-evidence');
  const evidenceBundleDigest = bundleDigest(digests);
  const result: CiResult = {
    schema: CI_RESULT_SCHEMA,
    source: 'hosted-fallback',
    tuple,
    runId: options.runId,
    suites,
    coverage: {
      status: coverageSuite?.status === 'passed' ? 'passed' : 'failed',
      evidenceDigest: coverageSuite?.evidenceDigest ?? evidenceBundleDigest,
    },
    evidence: { bundleDigest: evidenceBundleDigest },
    startedAt,
    completedAt: now().toISOString(),
  };
  const parsed = parseCiResult(result);
  if (!parsed.ok)
    throw new Error(`fallback produced an invalid ci result: ${parsed.errors.join('; ')}`);
  writeFileSync(
    path.join(options.outDir, 'ci-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  writeFileSync(path.join(options.outDir, 'check-run.md'), formatCiResultDocument(result), 'utf8');
  const passed = suites.every((suite) => suite.status !== 'failed');
  return { result, passed, logs };
}

export type PublishFallbackOptions = {
  api: GateGitHubApi;
  result: CiResult;
  checkNamePrefix: string;
  runUrl: string;
  /**
   * Result of the job that ran the candidate (`needs.profile.result`). The runner computes
   * it from step exit codes, so a tampered evidence file cannot turn a failed job green.
   */
  profileJobResult?: string;
};

export class FallbackEvidenceMismatchError extends Error {
  constructor(message: string) {
    super(`Refusing to publish fallback evidence: ${message}`);
    this.name = 'FallbackEvidenceMismatchError';
  }
}

/**
 * The publish job trusts only what it derived itself: the tuple rebuilt from the workflow
 * inputs and its own run id. Evidence produced next to candidate code must agree exactly.
 */
export function assertEvidenceBinding(params: {
  result: CiResult;
  expectedTuple: CiRequestTuple;
  expectedRunId?: number;
}): void {
  const { result, expectedTuple, expectedRunId } = params;
  if (result.source !== 'hosted-fallback') {
    throw new FallbackEvidenceMismatchError(`source is "${result.source}", not hosted-fallback`);
  }
  if (!tuplesEqual(result.tuple, expectedTuple)) {
    throw new FallbackEvidenceMismatchError(
      `evidence tuple ${tupleKey(result.tuple)} differs from the workflow inputs ${tupleKey(expectedTuple)}`,
    );
  }
  if (expectedRunId !== undefined && result.runId !== expectedRunId) {
    throw new FallbackEvidenceMismatchError(
      `evidence names run ${result.runId ?? 'none'}, this run is ${expectedRunId}`,
    );
  }
}

/** Publishes the fallback evidence as a check run on the head commit, bound to the tuple key. */
export async function publishFallbackCheck(
  options: PublishFallbackOptions,
): Promise<{ id: number }> {
  const { result, profileJobResult } = options;
  const failed = result.suites.filter((suite) => suite.status === 'failed');
  const jobFailed = profileJobResult !== undefined && profileJobResult !== 'success';
  const passed = failed.length === 0 && !jobFailed;
  const summary = jobFailed
    ? `Profile job finished with result "${profileJobResult}"; evidence recorded ${failed.length} failed suite(s).`
    : failed.length === 0
      ? `All ${result.suites.length} suites recorded for attempt ${result.tuple.attempt}.`
      : `Failed suites: ${failed.map((suite) => suite.id).join(', ')}.`;
  return options.api.createCheckRun({
    name: `${options.checkNamePrefix}${result.tuple.profile}`,
    headSha: result.tuple.headSha,
    externalId: tupleKey(result.tuple),
    conclusion: passed ? 'success' : 'failure',
    title: passed
      ? 'Hosted fallback profile passed'
      : jobFailed
        ? 'Hosted fallback profile job failed'
        : 'Hosted fallback profile failed',
    summary,
    text: formatCiResultDocument(result),
    detailsUrl: options.runUrl,
  });
}

type CliArgs = Map<string, string>;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [name, inline] = token.slice(2).split('=', 2);
    if (inline !== undefined) {
      args.set(name, inline);
    } else if (argv[index + 1] !== undefined && !argv[index + 1].startsWith('--')) {
      args.set(name, argv[index + 1]);
      index += 1;
    } else {
      args.set(name, 'true');
    }
  }
  return args;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(path.resolve(filePath), 'utf8'));
}

/**
 * Flags:
 *   run     --profile-json FILE --tuple-json FILE --run-id N --workdir DIR --out DIR
 *   publish --out DIR --tuple-json FILE --check-name-prefix "Hosted profile fallback / " --run-url URL
 *           [--run-id N] [--profile-job-result success|failure|cancelled|skipped]
 *           (uses GITHUB_TOKEN / GITHUB_REPOSITORY; refuses without them, and refuses evidence
 *           whose tuple or run id differs from the values the publish job derived itself)
 */
async function main(): Promise<number> {
  const mode = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  if (mode === 'run') {
    const profileJson = args.get('profile-json');
    const tupleJson = args.get('tuple-json');
    const runId = Number(args.get('run-id') ?? '');
    const workdir = args.get('workdir');
    const outDir = args.get('out');
    if (
      !profileJson ||
      !tupleJson ||
      !workdir ||
      !outDir ||
      !Number.isSafeInteger(runId) ||
      runId <= 0
    ) {
      console.error(
        'usage: fallback-run.ts run --profile-json F --tuple-json F --run-id N --workdir D --out D',
      );
      return 2;
    }
    const tupleParse = parseCiRequestTuple(readJson(tupleJson));
    if (!tupleParse.ok) {
      console.error(`Refusing to run: invalid tuple: ${tupleParse.errors.join('; ')}`);
      return 2;
    }
    const outcome = await runFallbackProfile({
      profile: parseResolvedProfile(readJson(profileJson)),
      tuple: tupleParse.tuple,
      runId,
      workdir: path.resolve(workdir),
      outDir: path.resolve(outDir),
      log: (line) => console.log(line),
    });
    for (const suite of outcome.result.suites) console.log(`${suite.id}: ${suite.status}`);
    return outcome.passed ? 0 : 1;
  }
  if (mode === 'publish') {
    const outDir = args.get('out');
    const tupleJson = args.get('tuple-json');
    const prefix = args.get('check-name-prefix');
    const runUrl = args.get('run-url');
    const rawRunId = args.get('run-id');
    const profileJobResult = args.get('profile-job-result');
    const token = process.env.GITHUB_TOKEN ?? '';
    const repository = process.env.GITHUB_REPOSITORY ?? '';
    if (!outDir || !tupleJson || !prefix || !runUrl) {
      console.error(
        'usage: fallback-run.ts publish --out D --tuple-json F --check-name-prefix P --run-url URL [--run-id N] [--profile-job-result R]',
      );
      return 2;
    }
    if (!token || !repository) {
      console.error('Refusing to publish: GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
      return 2;
    }
    const tupleParse = parseCiRequestTuple(readJson(tupleJson));
    if (!tupleParse.ok) {
      console.error(`Refusing to publish: invalid tuple: ${tupleParse.errors.join('; ')}`);
      return 2;
    }
    let expectedRunId: number | undefined;
    if (rawRunId !== undefined) {
      expectedRunId = Number(rawRunId);
      if (!Number.isSafeInteger(expectedRunId) || expectedRunId <= 0) {
        console.error('Refusing to publish: --run-id must be a positive integer.');
        return 2;
      }
    }
    const parsed = parseCiResult(readJson(path.join(outDir, 'ci-result.json')));
    if (!parsed.ok) {
      console.error(`Refusing to publish invalid evidence: ${parsed.errors.join('; ')}`);
      return 2;
    }
    try {
      assertEvidenceBinding({
        result: parsed.result,
        expectedTuple: tupleParse.tuple,
        expectedRunId,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
    const created = await publishFallbackCheck({
      api: createGitHubApi({ token, repository, apiUrl: process.env.GITHUB_API_URL }),
      result: parsed.result,
      checkNamePrefix: prefix,
      runUrl,
      profileJobResult,
    });
    console.log(`Published check run ${created.id}.`);
    return 0;
  }
  console.error('usage: fallback-run.ts run|publish ...');
  return 2;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
