import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createProcessRunner,
  parseExecutorStdout,
  type RunnerProcess,
  type RunnerSpawn,
  type RunnerSpawnOptions,
} from '@/scripts/ci/controller/runner';

import { completeResultFor } from './helpers';
import { prRequest } from '../contracts/fixtures';

import type { RunnerJob, StopSignal } from '@/scripts/ci/controller/types';

interface SpawnRecord {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: RunnerSpawnOptions;
  readonly killed: NodeJS.Signals[];
  exit(code: number | null, signal?: NodeJS.Signals | null): void;
}

function fakeSpawn(): { spawn: RunnerSpawn; records: SpawnRecord[] } {
  const records: SpawnRecord[] = [];
  const spawn: RunnerSpawn = (command, args, options) => {
    const listeners: ((code: number | null, signal: NodeJS.Signals | null) => void)[] = [];
    const killed: NodeJS.Signals[] = [];
    const record: SpawnRecord = {
      command,
      args,
      options,
      killed,
      exit: (code, signal = null) => {
        for (const listener of listeners) listener(code, signal);
      },
    };
    records.push(record);
    const process: RunnerProcess = {
      pid: 4321,
      onExit: (listener) => {
        listeners.push(listener);
      },
      kill: (signal) => {
        killed.push(signal ?? 'SIGTERM');
      },
    };
    return process;
  };
  return { spawn, records };
}

function fakeTimers(): {
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
  fire(): void;
  cleared: boolean;
} {
  let callback: (() => void) | null = null;
  const timers = {
    cleared: false,
    setInterval: ((handler: () => void) => {
      callback = handler;
      return 1 as unknown as ReturnType<typeof globalThis.setInterval>;
    }) as unknown as typeof globalThis.setInterval,
    clearInterval: (() => {
      timers.cleared = true;
    }) as unknown as typeof globalThis.clearInterval,
    fire: () => {
      callback?.();
    },
  };
  return timers;
}

function job(stop: () => StopSignal, touched: number[]): RunnerJob {
  return {
    attemptId: 'attempt-1',
    request: prRequest(),
    mode: 'normal',
    allocation: { cpus: 4, memoryGiB: 8 },
    stopSignal: stop,
    touch: () => {
      touched.push(1);
    },
  };
}

describe('parseExecutorStdout', () => {
  it('parses a pure JSON document or trailing JSON after log lines', () => {
    expect(parseExecutorStdout('{"a":1}')).toEqual({ a: 1 });
    expect(parseExecutorStdout('progress line\nanother\n{\n  "a": 2\n}\n')).toEqual({ a: 2 });
  });

  it('rejects empty or non-JSON output', () => {
    expect(() => parseExecutorStdout('')).toThrow(/nothing/u);
    expect(() => parseExecutorStdout('just logs\nno document')).toThrow(/JSON result/u);
  });
});

describe('process runner', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function stateDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'nabatable-ci-runner-'));
    dirs.push(dir);
    return dir;
  }

  it('invokes the executor CLI with the tuple file and returns the parsed stdout document', async () => {
    const dir = stateDir();
    const { spawn, records } = fakeSpawn();
    const timers = fakeTimers();
    const touched: number[] = [];
    const runner = createProcessRunner({
      command: 'pnpm',
      args: ['ci:executor'],
      cwd: '/repo',
      stateDir: dir,
      spawn,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    const pending = runner(job(() => 'continue', touched));
    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record.command).toBe('pnpm');
    const requestFile = path.join(dir, 'attempt-1', 'request.json');
    expect(record.args).toEqual(['ci:executor', '--request', `@${requestFile}`, '--json']);
    expect(record.options.cwd).toBe('/repo');
    expect(record.options.env.NABATABLE_CI_CONTROL_FILE).toBe(
      path.join(dir, 'attempt-1', 'control.json'),
    );
    expect(record.options.env.NABATABLE_CI_CONTROLLER_MANAGED).toBe('1');
    // The request file carries exactly the tuple; the executor rejects extra fields.
    expect(JSON.parse(readFileSync(requestFile, 'utf8'))).toEqual(prRequest());
    expect(
      JSON.parse(readFileSync(record.options.env.NABATABLE_CI_ALLOCATION_FILE!, 'utf8')),
    ).toEqual({
      mode: 'normal',
      allocation: { cpus: 4, memoryGiB: 8 },
    });

    timers.fire();
    expect(touched).toHaveLength(1);
    const result = completeResultFor(prRequest());
    writeFileSync(record.options.stdoutPath, `spool ok\n${JSON.stringify(result, null, 2)}\n`);
    record.exit(1);
    await expect(pending).resolves.toEqual(result);
    expect(timers.cleared).toBe(true);
    expect(record.killed).toEqual([]);
  });

  it('propagates cancel through the control file and SIGTERM, and preempt through the file only', async () => {
    const dir = stateDir();
    const { spawn, records } = fakeSpawn();
    const timers = fakeTimers();
    let signal: StopSignal = 'continue';
    const runner = createProcessRunner({
      command: 'pnpm',
      args: ['ci:executor'],
      cwd: '/repo',
      stateDir: dir,
      spawn,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    const pending = runner(job(() => signal, []));
    const record = records[0]!;
    const controlFile = record.options.env.NABATABLE_CI_CONTROL_FILE!;
    expect(JSON.parse(readFileSync(controlFile, 'utf8'))).toEqual({ stop: 'continue' });

    signal = 'preempt';
    timers.fire();
    expect(JSON.parse(readFileSync(controlFile, 'utf8'))).toEqual({ stop: 'preempt' });
    expect(record.killed).toEqual([]);

    signal = 'cancel';
    timers.fire();
    timers.fire();
    expect(JSON.parse(readFileSync(controlFile, 'utf8'))).toEqual({ stop: 'cancel' });
    expect(record.killed).toEqual(['SIGTERM']);

    record.exit(null, 'SIGTERM');
    await expect(pending).rejects.toThrow(/signal=SIGTERM/u);
  });

  it('rejects when the executor exits without a result document', async () => {
    const dir = stateDir();
    const { spawn, records } = fakeSpawn();
    const timers = fakeTimers();
    const runner = createProcessRunner({
      command: 'pnpm',
      args: [],
      cwd: '/repo',
      stateDir: dir,
      spawn,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    const pending = runner(job(() => 'continue', []));
    expect(existsSync(records[0]!.options.stdoutPath)).toBe(false);
    records[0]!.exit(2);
    await expect(pending).rejects.toThrow(/code=2/u);
  });
});
