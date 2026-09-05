import { spawnSync } from 'node:child_process';

/**
 * Minimal injectable process runner used by every deploy script so provider CLIs
 * (vercel, wrangler) can be replaced by fakes in tests. Real invocations never use a
 * shell, so arguments are passed verbatim and cannot be interpolated.
 */
export type CommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv },
) => CommandResult;

/**
 * Thrown when the binary itself cannot be started (ENOENT). Without this the caller only
 * sees `status: null` and reports a misleading provider failure; the hosted delivery
 * workflow installs the pinned provider CLIs before any deploy script runs.
 */
export class CommandNotFoundError extends Error {
  readonly command: string;

  constructor(command: string) {
    super(
      `${command}: command not found on PATH. Install the pinned CLI before running this script (see scripts/deploy/provider-clis.json and the "Install ... CLI (pinned)" steps in .github/workflows/deploy.yml).`,
    );
    this.name = 'CommandNotFoundError';
    this.command = command;
  }
}

export const spawnCommandRunner: CommandRunner = (command, args, options = {}) => {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new CommandNotFoundError(command);
    return {
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: `${result.stderr ?? ''}\n${result.error.message}`.trim(),
    };
  }
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

export class CommandFailedError extends Error {
  readonly command: string;
  readonly status: number | null;

  constructor(command: string, args: readonly string[], result: CommandResult) {
    const stderr = result.stderr.trim();
    super(
      `${command} ${args.join(' ')} exited with status ${String(result.status)}${
        stderr ? `: ${stderr.slice(0, 2000)}` : ''
      }`,
    );
    this.name = 'CommandFailedError';
    this.command = command;
    this.status = result.status;
  }
}

export function runOrThrow(
  runner: CommandRunner,
  command: string,
  args: readonly string[],
  options?: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv },
): CommandResult {
  const result = runner(command, args, options);
  if (result.status !== 0) {
    throw new CommandFailedError(command, args, result);
  }
  return result;
}

export function parseFlags(argv: readonly string[]): {
  readonly flags: ReadonlyMap<string, string | true>;
  readonly positionals: readonly string[];
} {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const equals = body.indexOf('=');
    if (equals >= 0) {
      flags.set(body.slice(0, equals), body.slice(equals + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(body, next);
      index += 1;
    } else {
      flags.set(body, true);
    }
  }
  return { flags, positionals };
}

export function flagString(
  flags: ReadonlyMap<string, string | true>,
  name: string,
): string | undefined {
  const value = flags.get(name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function flagBoolean(flags: ReadonlyMap<string, string | true>, name: string): boolean {
  const value = flags.get(name);
  return value === true || value === 'true' || value === '1';
}
