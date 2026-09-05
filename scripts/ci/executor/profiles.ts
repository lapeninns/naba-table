import { isImageConfigured } from '../contracts/profile';
import { resolveProfile } from '../profiles/conditional';
import { getProfile } from '../profiles/registry';
import type {
  CiProfileName,
  CiRequest,
  ExecutorProfile,
  ExecutorResources,
  ExecutorStep,
  ExecutorSuite,
  SkippedSuite,
} from './types';

/**
 * Executor view of a CI profile.
 *
 * The step list is derived from `scripts/ci/profiles/**` (the single source of
 * truth shared with `pnpm ci:profile`) before the instance is created and is
 * recorded in the result; nothing inside the container can change which
 * profile or which commands ran. Conditional suites are resolved from the
 * changed paths computed in the spool (unknown => run, fail closed).
 */

const MINUTE = 60_000;

export class ProfileResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileResolutionError';
  }
}

/**
 * Executor-owned environment layered under the profile env. Every value is a
 * fixed constant; none is credential-shaped.
 */
export const EXECUTOR_ENV: Readonly<Record<string, string>> = Object.freeze({
  HOME: '/workspace/.home',
  PNPM_HOME: '/workspace/.home/.local/share/pnpm',
  LANG: 'C.UTF-8',
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  NEXT_TELEMETRY_DISABLED: '1',
  DO_NOT_TRACK: '1',
});

export const PREPARE_SUITE_ID = 'prepare';
export const PREPARE_STEP_ID = 'prepare:install';
const PREPARE_TIMEOUT_MS = 15 * MINUTE;
const PREPARE_HARD_LIMIT_MS = 20 * MINUTE;

/** Executables a profile command may start. Everything else is refused. */
export const ALLOWED_COMMAND_EXECUTABLES: ReadonlySet<string> = new Set([
  'pnpm',
  'bash',
  'node',
  'corepack',
]);

const FORBIDDEN_RUN_CHARACTERS = /[;&|<>`$\\\n\r\t(){}]/u;

/**
 * Splits a profile `run` string into argv without a shell. Single and double
 * quotes group words; nothing is expanded. Any shell metacharacter, even inside
 * quotes, is refused so a profile can never smuggle a pipeline or a subshell.
 */
export function tokenizeRun(run: string): readonly string[] {
  if (FORBIDDEN_RUN_CHARACTERS.test(run)) {
    throw new ProfileResolutionError(`command "${run}" contains shell metacharacters`);
  }
  const tokens: string[] = [];
  let current = '';
  let inWord = false;
  let quote: '"' | "'" | null = null;
  for (const char of run) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      inWord = true;
      continue;
    }
    if (char === ' ') {
      if (inWord) {
        tokens.push(current);
        current = '';
        inWord = false;
      }
      continue;
    }
    current += char;
    inWord = true;
  }
  if (quote) {
    throw new ProfileResolutionError(`command "${run}" has an unterminated quote`);
  }
  if (inWord) tokens.push(current);
  if (tokens.length === 0) {
    throw new ProfileResolutionError('command is empty');
  }
  if (!ALLOWED_COMMAND_EXECUTABLES.has(tokens[0])) {
    throw new ProfileResolutionError(
      `command "${run}" starts with "${tokens[0]}", which is not an allowed executable`,
    );
  }
  return tokens;
}

/** Step id for a profile command; shared commands are qualified by suite. */
export function executorStepId(commandId: string, suiteId: string, shared: boolean): string {
  return shared ? `${commandId}@${suiteId}` : commandId;
}

/** File-name-safe stem for a step id (`test:ci` -> `test_ci`). */
export function stepLogStem(stepId: string): string {
  return stepId.replace(/[^A-Za-z0-9._-]/gu, '_');
}

export const ARTEFACT_PATHS: readonly string[] = Object.freeze([
  'coverage',
  'test-results',
  'cloudflare/booking-short-links/coverage',
  'cloudflare/booking-short-links/test-results',
  'cloudflare/email-queue-gateway/coverage',
  'cloudflare/email-queue-gateway/test-results',
  'cloudflare/sms-summary-gateway/coverage',
  'cloudflare/sms-summary-gateway/test-results',
]);

export interface ResolveExecutorProfileInput {
  readonly request: CiRequest;
  /** Paths changed between baseSha and headSha; null when unknown. */
  readonly changedPaths: readonly string[] | null;
  /** Controller allocation; caps the profile limits when smaller. */
  readonly allocation: { readonly cpus: number; readonly memoryGiB: number } | null;
}

function resources(
  limits: { readonly cpu: number; readonly memoryGiB: number; readonly pids: number },
  allocation: ResolveExecutorProfileInput['allocation'],
): ExecutorResources {
  const cpus = allocation ? Math.min(limits.cpu, allocation.cpus) : limits.cpu;
  const memoryGiB = allocation
    ? Math.min(limits.memoryGiB, Math.floor(allocation.memoryGiB))
    : limits.memoryGiB;
  if (cpus <= 0 || memoryGiB <= 0) {
    throw new ProfileResolutionError('allocation leaves no cpu or memory for the job');
  }
  return {
    cpus,
    memory: `${memoryGiB}g`,
    pidsLimit: limits.pids,
    tmpfsSize: '2g',
    shmSize: '1g',
  };
}

export function resolveExecutorProfile(input: ResolveExecutorProfileInput): ExecutorProfile {
  const name: CiProfileName = input.request.profile;
  const profile = getProfile(name);
  if (profile.policyVersion !== input.request.policyVersion) {
    throw new ProfileResolutionError(
      `request policyVersion ${input.request.policyVersion} does not match profile ${name} policyVersion ${profile.policyVersion}`,
    );
  }
  const resolved = resolveProfile(profile, input.changedPaths);

  const prepare: ExecutorStep = {
    id: PREPARE_STEP_ID,
    suiteId: PREPARE_SUITE_ID,
    command: ['pnpm', 'install', '--frozen-lockfile'],
    timeoutMs: PREPARE_TIMEOUT_MS,
    phase: 'prepare',
    env: { ...EXECUTOR_ENV, ...profile.env },
  };
  const steps: ExecutorStep[] = [prepare];
  // A command may be shared by several suites (e.g. the workspace stability run
  // repeated after every shuffle seed); every occurrence of such a command gets a
  // suite-qualified step id so log stems and timings stay unambiguous.
  const occurrences = new Map<string, number>();
  for (const command of resolved.commands) {
    occurrences.set(command.id, (occurrences.get(command.id) ?? 0) + 1);
  }
  const seen = new Set<string>([PREPARE_STEP_ID]);
  for (const command of resolved.commands) {
    const id = executorStepId(command.id, command.suiteId, (occurrences.get(command.id) ?? 0) > 1);
    if (seen.has(id)) {
      throw new ProfileResolutionError(`profile ${name} runs step ${id} twice`);
    }
    seen.add(id);
    steps.push({
      id,
      suiteId: command.suiteId,
      command: tokenizeRun(command.run),
      timeoutMs: command.timeoutMinutes * MINUTE,
      phase: 'test',
      env: { ...EXECUTOR_ENV, ...command.effectiveEnv },
    });
  }

  const suites: ExecutorSuite[] = [
    {
      id: PREPARE_SUITE_ID,
      displayName: 'Dependency preparation',
      kind: 'prepare',
      stepIds: [PREPARE_STEP_ID],
      hardLimitMs: PREPARE_HARD_LIMIT_MS,
      p95BudgetMs: PREPARE_TIMEOUT_MS,
    },
  ];
  const skippedSuites: SkippedSuite[] = [];
  profile.suites.forEach((suite, index) => {
    const resolution = resolved.suites[index];
    if (!resolution || resolution.suiteId !== suite.id) {
      throw new ProfileResolutionError(`profile ${name} suite order changed during resolution`);
    }
    if (!resolution.included) {
      skippedSuites.push({
        suiteId: suite.id,
        displayName: suite.displayName,
        reason: resolution.reason,
      });
      return;
    }
    suites.push({
      id: suite.id,
      displayName: suite.displayName,
      kind: suite.kind,
      stepIds: suite.commandIds.map((commandId) =>
        executorStepId(commandId, suite.id, (occurrences.get(commandId) ?? 0) > 1),
      ),
      hardLimitMs: suite.hardLimitMinutes * MINUTE,
      p95BudgetMs: suite.p95BudgetMinutes * MINUTE,
    });
  });

  return Object.freeze({
    name,
    policyVersion: profile.policyVersion,
    jobImageDigest: isImageConfigured(profile.image) ? profile.image.jobImageDigest : null,
    steps,
    suites,
    skippedSuites,
    profileTimeoutMs: profile.limits.timeoutMinutes * MINUTE + PREPARE_HARD_LIMIT_MS,
    env: { ...EXECUTOR_ENV, ...profile.env },
    artefactPaths: ARTEFACT_PATHS,
    resources: resources(profile.limits, input.allocation),
    runtime: profile.runtime,
    changedPathsProvided: resolved.changedPathsProvided,
  });
}

/** Every env key a step of this profile may carry (profile env, overlays, executor env). */
export function allowedEnvKeys(profile: ExecutorProfile): readonly string[] {
  const keys = new Set<string>(Object.keys(profile.env));
  for (const step of profile.steps) {
    for (const key of Object.keys(step.env)) keys.add(key);
  }
  return [...keys].sort();
}
