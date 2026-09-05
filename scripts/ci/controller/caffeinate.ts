import { spawn as nodeSpawn } from 'node:child_process';

/**
 * Sleep assertion. `caffeinate -i -s -w <pid>` prevents idle sleep (and, on
 * AC power, system sleep) while the controller process is alive and exits on
 * its own when the process ends, so a crash never leaves the Mac permanently
 * awake. It does not prevent lid-close sleep; see README.md.
 */
export const CAFFEINATE_ARGS = ['-i', '-s', '-w'] as const;
export interface SpawnedProcess {
  readonly pid: number | undefined;
  kill(signal?: NodeJS.Signals): void;
  onExit(listener: (code: number | null) => void): void;
}

export type SpawnLike = (command: string, args: readonly string[]) => SpawnedProcess;

export const defaultSpawn: SpawnLike = (command, args) => {
  const child = nodeSpawn(command, [...args], { stdio: 'ignore', detached: false });
  return {
    pid: child.pid,
    kill: (signal) => {
      child.kill(signal);
    },
    onExit: (listener) => {
      child.on('exit', (code) => listener(code));
    },
  };
};

export interface SleepAssertion {
  start(): void;
  stop(): void;
  isActive(): boolean;
}

export function createCaffeinateAssertion(input: {
  readonly spawn?: SpawnLike;
  readonly pid?: number;
  readonly onExit?: (code: number | null) => void;
}): SleepAssertion {
  const spawn = input.spawn ?? defaultSpawn;
  const pid = input.pid ?? process.pid;
  let child: SpawnedProcess | null = null;
  return {
    start: () => {
      if (child) return;
      child = spawn('caffeinate', [...CAFFEINATE_ARGS, String(pid)]);
      child.onExit((code) => {
        child = null;
        input.onExit?.(code);
      });
    },
    stop: () => {
      if (!child) return;
      const current = child;
      child = null;
      current.kill('SIGTERM');
    },
    isActive: () => child !== null,
  };
}
