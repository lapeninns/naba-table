import { spawn as nodeSpawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Runner, RunnerJob } from './types';

/**
 * Default runner: runs the executor as a child process. The controller never
 * imports the executor implementation; the contract is the executor CLI:
 *
 *   pnpm ci:executor --request @<request.json> --json
 *
 * `request.json` holds exactly the CI request tuple (the executor rejects
 * unknown fields). The executor prints its result document as JSON on stdout
 * and exits non-zero when the profile failed; the controller validates the
 * document with `isCompleteCiResult` before it is allowed anywhere near a
 * check run, so an exit code alone never becomes a conclusion.
 *
 * Side channels (paths exported in the child's environment, not CLI flags):
 *   NABATABLE_CI_CONTROL_FILE     {"stop":"continue"|"preempt"|"cancel"}, rewritten
 *                                 whenever the controller's stop signal changes
 *   NABATABLE_CI_ALLOCATION_FILE  {"mode","allocation"} for the admitted job
 *
 * A `cancel` signal also sends SIGTERM to the child: a superseded revision
 * never needs to finish.
 */
export interface RunnerProcess {
  readonly pid: number | undefined;
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  kill(signal?: NodeJS.Signals): void;
}

export interface RunnerSpawnOptions {
  readonly cwd: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly env: Readonly<Record<string, string>>;
}

export type RunnerSpawn = (
  command: string,
  args: readonly string[],
  options: RunnerSpawnOptions,
) => RunnerProcess;

export const defaultRunnerSpawn: RunnerSpawn = (command, args, options) => {
  const stdout = openSync(options.stdoutPath, 'a');
  const stderr = openSync(options.stderrPath, 'a');
  const child = nodeSpawn(command, [...args], {
    cwd: options.cwd,
    stdio: ['ignore', stdout, stderr],
    env: { ...process.env, ...options.env },
  });
  child.on('exit', () => {
    closeSync(stdout);
    closeSync(stderr);
  });
  return {
    pid: child.pid,
    onExit: (listener) => {
      child.on('exit', (code, signal) => listener(code, signal));
    },
    kill: (signal) => {
      child.kill(signal);
    },
  };
};

export interface ProcessRunnerOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly stateDir: string;
  readonly spawn?: RunnerSpawn;
  readonly controlPollMs?: number;
  readonly setInterval?: typeof globalThis.setInterval;
  readonly clearInterval?: typeof globalThis.clearInterval;
}

/**
 * Extracts the executor's JSON document from captured stdout. Accepts a pure
 * JSON stream or trailing JSON after log lines; anything else is an error.
 */
export function parseExecutorStdout(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('executor printed nothing on stdout');
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // fall through to the trailing-document scan
  }
  let start = trimmed.lastIndexOf('\n{');
  while (start >= 0) {
    try {
      return JSON.parse(trimmed.slice(start + 1)) as unknown;
    } catch {
      start = trimmed.lastIndexOf('\n{', start - 1);
    }
  }
  throw new Error('executor stdout does not contain a JSON result document');
}

export function createProcessRunner(options: ProcessRunnerOptions): Runner {
  const spawn = options.spawn ?? defaultRunnerSpawn;
  const pollMs = options.controlPollMs ?? 2000;
  const setIntervalImpl = options.setInterval ?? globalThis.setInterval;
  const clearIntervalImpl = options.clearInterval ?? globalThis.clearInterval;

  return (job: RunnerJob) =>
    new Promise<unknown>((resolve, reject) => {
      const dir = path.join(options.stateDir, job.attemptId);
      mkdirSync(dir, { recursive: true });
      const requestFile = path.join(dir, 'request.json');
      const controlFile = path.join(dir, 'control.json');
      const allocationFile = path.join(dir, 'allocation.json');
      const stdoutPath = path.join(dir, 'executor.stdout.log');
      writeFileSync(requestFile, JSON.stringify(job.request, null, 2));
      writeFileSync(controlFile, JSON.stringify({ stop: 'continue' }));
      writeFileSync(
        allocationFile,
        JSON.stringify({ mode: job.mode, allocation: job.allocation }, null, 2),
      );

      let lastSignal = job.stopSignal();
      let terminated = false;
      const child = spawn(
        options.command,
        [...options.args, '--request', `@${requestFile}`, '--json'],
        {
          cwd: options.cwd,
          stdoutPath,
          stderrPath: path.join(dir, 'executor.stderr.log'),
          env: {
            NABATABLE_CI_CONTROLLER_MANAGED: '1',
            NABATABLE_CI_CONTROL_FILE: controlFile,
            NABATABLE_CI_ALLOCATION_FILE: allocationFile,
          },
        },
      );
      const timer = setIntervalImpl(() => {
        const signal = job.stopSignal();
        if (signal !== lastSignal) {
          lastSignal = signal;
          writeFileSync(controlFile, JSON.stringify({ stop: signal }));
        }
        if (signal === 'cancel' && !terminated) {
          terminated = true;
          child.kill('SIGTERM');
        }
        job.touch();
      }, pollMs);
      child.onExit((code, signal) => {
        clearIntervalImpl(timer);
        let stdout = '';
        try {
          stdout = readFileSync(stdoutPath, 'utf8');
        } catch {
          stdout = '';
        }
        try {
          resolve(parseExecutorStdout(stdout));
        } catch (error) {
          reject(
            new Error(
              `executor exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}) without a result document: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
        }
      });
    });
}
