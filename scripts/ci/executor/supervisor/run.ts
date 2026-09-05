import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import path from 'node:path';

import {
  buildDockerExecArgs,
  buildDockerSimpleArgs,
  PREPARE_PROXY_ENV_KEYS,
  type DockerContextSpec,
} from '../docker/command';
import { allowedEnvKeys, stepLogStem } from '../profiles';
import type { CommandResult, CommandRunner } from '../runner';
import type {
  ExecutorProfile,
  ExecutorStep,
  ExecutorSuite,
  StepOutcome,
  StepPhase,
  StepResult,
  StopSignal,
  SupervisorOutcome,
  SupervisorResult,
} from '../types';

/**
 * Step supervisor.
 *
 * Runs the profile's suites and steps in order via `docker exec`, enforces
 * per-step, per-suite and whole-profile hard timeouts, owns the exit status and
 * classifies the outcome. The profile is fixed before the first step starts and
 * echoed into the result; nothing the container prints can change it. Controller
 * stop signals are honoured only at suite boundaries (safe points).
 */

export const DEFAULT_MAX_LOG_BYTES = 32 * 1024 * 1024;
const STORAGE_EXHAUSTION = /ENOSPC|No space left on device|Disk quota exceeded|EDQUOT/iu;

export interface SupervisorInput {
  readonly profile: ExecutorProfile;
  readonly docker: DockerContextSpec;
  readonly container: string;
  readonly user: string;
  /** Environment for the docker CLI on the host (PATH, HOME, job-private DOCKER_CONFIG). */
  readonly dockerEnv: Readonly<Record<string, string>>;
  readonly logDir: string;
  readonly maxLogBytes?: number;
  /** Proxy variables for prepare steps only (HTTP(S)_PROXY, NO_PROXY=""). */
  readonly prepareEnv: Readonly<Record<string, string>>;
  /** Called before the first step of each phase (guest egress phase switch). */
  readonly onPhase?: (phase: StepPhase) => Promise<void>;
  /** Controller stop signal, polled at suite boundaries. */
  readonly stopSignal?: () => StopSignal;
  /** `docker inspect .State.OOMKilled`; consulted when a step exits 137. */
  readonly oomProbe?: () => Promise<boolean | null>;
  /** Called after every step so the caller can extend its lease. */
  readonly onProgress?: (step: StepResult) => void;
}

export interface SupervisorDeps {
  readonly runner: CommandRunner;
  readonly now?: () => Date;
}

export function classifyStep(result: CommandResult, oomKilled: boolean | null): StepOutcome {
  if (result.timedOut) return 'timeout';
  if (result.exitCode === 0) return 'passed';
  if (STORAGE_EXHAUSTION.test(result.stderr) || STORAGE_EXHAUSTION.test(result.stdout)) {
    return 'storage-exhausted';
  }
  if (result.exitCode === 137 || result.signal === 'SIGKILL') {
    return oomKilled === false ? 'crashed' : 'oom';
  }
  if (
    result.exitCode === 139 ||
    result.exitCode === 134 ||
    result.exitCode === 135 ||
    result.signal === 'SIGSEGV' ||
    result.signal === 'SIGABRT' ||
    result.signal === 'SIGBUS'
  ) {
    return 'crashed';
  }
  if (result.exitCode === 125 || result.exitCode === 126 || result.exitCode === 127) {
    return 'infrastructure-error';
  }
  return 'failed';
}

class BoundedLogFile {
  private readonly fd: number;
  private written = 0;
  truncated = false;

  constructor(
    readonly filePath: string,
    private readonly limit: number,
  ) {
    this.fd = openSync(filePath, 'w', 0o600);
  }

  write(chunk: Buffer): void {
    if (this.truncated) return;
    const room = this.limit - this.written;
    if (chunk.length > room) {
      writeSync(this.fd, chunk.subarray(0, Math.max(room, 0)));
      writeSync(this.fd, Buffer.from(`\n[log truncated at ${this.limit} bytes]\n`));
      this.written = this.limit;
      this.truncated = true;
      return;
    }
    writeSync(this.fd, chunk);
    this.written += chunk.length;
  }

  close(): void {
    closeSync(this.fd);
  }
}

export function stepLogPaths(logDir: string, stepId: string): { stdout: string; stderr: string } {
  const stem = stepLogStem(stepId);
  return {
    stdout: path.join(logDir, `${stem}.stdout.log`),
    stderr: path.join(logDir, `${stem}.stderr.log`),
  };
}

function stepEnv(
  input: SupervisorInput,
  step: ExecutorStep,
  baseAllowed: readonly string[],
): { env: Readonly<Record<string, string>>; allowed: readonly string[] } {
  if (step.phase === 'prepare') {
    return {
      env: { ...step.env, ...input.prepareEnv },
      allowed: [...baseAllowed, ...PREPARE_PROXY_ENV_KEYS],
    };
  }
  return { env: step.env, allowed: baseAllowed };
}

function skipped(step: ExecutorStep, logDir: string, outcome: 'not-run' | 'cancelled' | 'timeout') {
  const logs = stepLogPaths(logDir, step.id);
  const result: StepResult = {
    id: step.id,
    suiteId: step.suiteId,
    phase: step.phase,
    outcome,
    exitCode: null,
    signal: null,
    durationMs: 0,
    timedOut: outcome === 'timeout',
    stdoutLog: logs.stdout,
    stderrLog: logs.stderr,
    stdoutTruncated: false,
    stderrTruncated: false,
  };
  return result;
}

interface Clock {
  readonly now: () => Date;
  readonly profileDeadline: number;
}

interface RunState {
  readonly steps: StepResult[];
  outcome: SupervisorOutcome;
  reason: string | null;
  halted: boolean;
  stopSignal: StopSignal;
  readonly enteredPhases: Set<StepPhase>;
}

function halt(state: RunState, outcome: SupervisorOutcome, reason: string): void {
  state.outcome = outcome;
  state.reason = reason;
  state.halted = true;
}

async function runStep(
  input: SupervisorInput,
  deps: SupervisorDeps,
  step: ExecutorStep,
  timeoutMs: number,
  baseAllowed: readonly string[],
): Promise<StepResult | { readonly startError: string }> {
  const maxLogBytes = input.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES;
  const { env, allowed } = stepEnv(input, step, baseAllowed);
  const args = buildDockerExecArgs({
    context: input.docker.context,
    protectedContexts: input.docker.protectedContexts,
    container: input.container,
    user: input.user,
    env,
    allowedEnvKeys: allowed,
    command: step.command,
  });
  const logs = stepLogPaths(input.logDir, step.id);
  const stdoutLog = new BoundedLogFile(logs.stdout, maxLogBytes);
  const stderrLog = new BoundedLogFile(logs.stderr, maxLogBytes);
  let result: CommandResult;
  try {
    result = await deps.runner.run({
      command: 'docker',
      args,
      env: input.dockerEnv,
      timeoutMs,
      maxOutputBytes: 64 * 1024,
      onStdout: (chunk) => stdoutLog.write(chunk),
      onStderr: (chunk) => stderrLog.write(chunk),
      purpose: `step ${step.id}`,
    });
  } catch (error) {
    const message = (error as Error).message;
    stderrLog.write(Buffer.from(`supervisor: failed to start step: ${message}\n`));
    stdoutLog.close();
    stderrLog.close();
    return { startError: message };
  }
  stdoutLog.close();
  stderrLog.close();

  let oomKilled: boolean | null = null;
  if (result.exitCode === 137 && input.oomProbe) {
    oomKilled = await input.oomProbe().catch(() => null);
  }
  const outcome = classifyStep(result, oomKilled);
  if (result.timedOut) {
    // The docker client was killed; make sure the in-container process is too.
    await deps.runner
      .run({
        command: 'docker',
        args: buildDockerSimpleArgs(input.docker, 'kill', input.container),
        env: input.dockerEnv,
        timeoutMs: 30_000,
        purpose: 'kill container after step timeout',
      })
      .catch(() => undefined);
  }
  return {
    id: step.id,
    suiteId: step.suiteId,
    phase: step.phase,
    outcome,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    stdoutLog: logs.stdout,
    stderrLog: logs.stderr,
    stdoutTruncated: result.stdoutTruncated,
    stderrTruncated: result.stderrTruncated,
  };
}

async function runSuite(
  input: SupervisorInput,
  deps: SupervisorDeps,
  suite: ExecutorSuite,
  steps: readonly ExecutorStep[],
  clock: Clock,
  state: RunState,
  baseAllowed: readonly string[],
): Promise<void> {
  const suiteDeadline = clock.now().getTime() + suite.hardLimitMs;
  for (const step of steps) {
    if (state.halted) {
      state.steps.push(
        skipped(step, input.logDir, state.outcome === 'cancelled' ? 'cancelled' : 'not-run'),
      );
      continue;
    }
    const nowMs = clock.now().getTime();
    const remaining = Math.min(suiteDeadline, clock.profileDeadline) - nowMs;
    if (remaining <= 0) {
      state.steps.push(skipped(step, input.logDir, 'timeout'));
      halt(
        state,
        'timeout',
        suiteDeadline <= clock.profileDeadline
          ? `suite ${suite.id} exceeded its hard limit`
          : 'profile exceeded its hard limit',
      );
      continue;
    }
    if (!state.enteredPhases.has(step.phase)) {
      state.enteredPhases.add(step.phase);
      try {
        await input.onPhase?.(step.phase);
      } catch (error) {
        state.steps.push(skipped(step, input.logDir, 'not-run'));
        halt(
          state,
          'infrastructure-error',
          `entering phase ${step.phase} failed: ${(error as Error).message}`,
        );
        continue;
      }
    }
    const outcome = await runStep(
      input,
      deps,
      step,
      Math.min(step.timeoutMs, remaining),
      baseAllowed,
    );
    if ('startError' in outcome) {
      state.steps.push(skipped(step, input.logDir, 'not-run'));
      halt(state, 'infrastructure-error', `step ${step.id} could not start: ${outcome.startError}`);
      continue;
    }
    state.steps.push(outcome);
    input.onProgress?.(outcome);
    if (outcome.outcome !== 'passed') {
      const failure: SupervisorOutcome =
        outcome.outcome === 'not-run' ? 'infrastructure-error' : outcome.outcome;
      halt(state, failure, `step ${step.id} ${outcome.outcome}`);
    }
  }
}

export async function runSupervisor(
  input: SupervisorInput,
  deps: SupervisorDeps,
): Promise<SupervisorResult> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const clock: Clock = {
    now,
    profileDeadline: startedAt.getTime() + input.profile.profileTimeoutMs,
  };
  mkdirSync(input.logDir, { recursive: true, mode: 0o700 });
  const baseAllowed = allowedEnvKeys(input.profile);
  const stepsById = new Map(input.profile.steps.map((step) => [step.id, step]));
  const state: RunState = {
    steps: [],
    outcome: 'passed',
    reason: null,
    halted: false,
    stopSignal: 'continue',
    enteredPhases: new Set(),
  };

  for (const suite of input.profile.suites) {
    const steps = suite.stepIds.map((id) => {
      const step = stepsById.get(id);
      if (!step) throw new Error(`suite ${suite.id} references unknown step ${id}`);
      return step;
    });
    if (!state.halted) {
      const signal = input.stopSignal?.() ?? 'continue';
      state.stopSignal = signal;
      if (signal !== 'continue') {
        halt(state, 'cancelled', `controller requested ${signal} before suite ${suite.id}`);
      }
    }
    await runSuite(input, deps, suite, steps, clock, state, baseAllowed);
  }

  const finishedAt = now();
  return {
    profile: input.profile.name,
    outcome: state.outcome,
    steps: state.steps,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    profileTimeoutMs: input.profile.profileTimeoutMs,
    stopSignal: state.stopSignal,
    reason: state.reason,
  };
}
