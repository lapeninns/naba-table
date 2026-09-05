import { spawn } from 'node:child_process';

/**
 * Injectable process runner. Every external tool the executor touches (git,
 * limactl, docker, security) goes through this interface so tests can supply
 * fakes and `--dry-run` can plan without executing.
 */
export interface CommandSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  /** Explicit environment. The runner never inherits `process.env` implicitly. */
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  /** Bounded capture: output beyond this many bytes per stream is dropped. */
  readonly maxOutputBytes?: number;
  readonly onStdout?: (chunk: Buffer) => void;
  readonly onStderr?: (chunk: Buffer) => void;
  /** Free-text purpose used by dry-run and diagnostics. Never passed to the process. */
  readonly purpose?: string;
}

export interface CommandResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
}

export interface CommandRunner {
  run(spec: CommandSpec): Promise<CommandResult>;
}

export const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

class BoundedBuffer {
  private readonly chunks: Buffer[] = [];
  private size = 0;
  truncated = false;

  constructor(private readonly limit: number) {}

  push(chunk: Buffer): void {
    if (this.size >= this.limit) {
      this.truncated = true;
      return;
    }
    const room = this.limit - this.size;
    if (chunk.length > room) {
      this.chunks.push(chunk.subarray(0, room));
      this.size += room;
      this.truncated = true;
      return;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  toString(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

/** Real runner backed by `child_process.spawn` without a shell. */
export class SpawnCommandRunner implements CommandRunner {
  run(spec: CommandSpec): Promise<CommandResult> {
    const limit = spec.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    const stdout = new BoundedBuffer(limit);
    const stderr = new BoundedBuffer(limit);
    const startedAt = Date.now();

    return new Promise<CommandResult>((resolve, reject) => {
      const env = { ...(spec.env ?? {}) } as NodeJS.ProcessEnv;
      const child = spawn(spec.command, [...spec.args], {
        cwd: spec.cwd,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'] as const,
      });

      let timedOut = false;
      let timer: NodeJS.Timeout | undefined;
      if (spec.timeoutMs !== undefined && spec.timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, spec.timeoutMs);
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout.push(chunk);
        spec.onStdout?.(chunk);
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr.push(chunk);
        spec.onStderr?.(chunk);
      });
      child.on('error', (error) => {
        if (timer) clearTimeout(timer);
        reject(error);
      });
      child.on('close', (exitCode, signal) => {
        if (timer) clearTimeout(timer);
        resolve({
          exitCode,
          signal,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          timedOut,
          durationMs: Date.now() - startedAt,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        });
      });
    });
  }
}

export function renderCommand(spec: Pick<CommandSpec, 'command' | 'args'>): string {
  return [spec.command, ...spec.args]
    .map((part) => (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(part) ? part : JSON.stringify(part)))
    .join(' ');
}

export function assertSucceeded(result: CommandResult, what: string): void {
  if (result.timedOut) {
    throw new Error(`${what}: timed out`);
  }
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim().split('\n').slice(-5).join(' | ');
    throw new Error(
      `${what}: exit ${result.exitCode ?? result.signal ?? 'unknown'}${detail ? ` (${detail})` : ''}`,
    );
  }
}
