import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';

import type { RestoreManifest } from './restore-manifest';

/** Minimal, injectable process runner used by backup and restore tooling. */

/**
 * Environment handed to child processes. Deliberately not `NodeJS.ProcessEnv`: the
 * Next.js global type augmentation makes NODE_ENV mandatory there, and libpq
 * environments are built from scratch so no ambient variable leaks into pg tools.
 */
export type CommandEnv = Record<string, string | undefined>;

export type CommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type StreamingProcess = {
  readonly stdout: Readable;
  /** Resolves with the exit status; rejects if the process could not be spawned. */
  readonly exit: Promise<{ readonly status: number | null; readonly stderr: string }>;
};

export type CommandRunner = {
  run(command: string, args: readonly string[], env?: CommandEnv): Promise<CommandResult>;
  /** Run with a stdin payload (used for pg_restore so plaintext never touches disk). */
  runWithInput(
    command: string,
    args: readonly string[],
    input: Buffer,
    env?: CommandEnv,
  ): Promise<CommandResult>;
  stream(command: string, args: readonly string[], env?: CommandEnv): StreamingProcess;
};

export const REQUIRED_PG_DUMP_MAJOR = 17;

export class PgDumpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PgDumpError';
  }
}

function spawnEnv(env: CommandEnv | undefined): NodeJS.ProcessEnv {
  return (env ?? process.env) as NodeJS.ProcessEnv;
}

function collect(
  command: string,
  args: readonly string[],
  env: CommandEnv | undefined,
  input: Buffer | null,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: spawnEnv(env),
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (status) =>
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }),
    );
    if (input && child.stdin) {
      child.stdin.on('error', () => undefined);
      child.stdin.end(input);
    }
  });
}

export function createNodeCommandRunner(): CommandRunner {
  return {
    run(command, args, env) {
      return collect(command, args, env, null);
    },
    runWithInput(command, args, input, env) {
      return collect(command, args, env, input);
    },
    stream(command, args, env) {
      const child = spawn(command, args, { env: spawnEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
      const stderr: Buffer[] = [];
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
      const exit = new Promise<{ status: number | null; stderr: string }>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (status) =>
          resolve({ status, stderr: Buffer.concat(stderr).toString('utf8') }),
        );
      });
      if (!child.stdout) {
        throw new PgDumpError(`${command} did not expose a stdout stream.`);
      }
      return { stdout: child.stdout, exit };
    },
  };
}

/** Parse `pg_dump (PostgreSQL) 17.4` style output into a major version. */
export function parsePgClientMajor(versionOutput: string): number | null {
  const match = versionOutput.match(/\(PostgreSQL\)\s+(\d+)(?:\.\d+)*/);
  if (!match) return null;
  return Number.parseInt(match[1] ?? '', 10);
}

export async function assertPgClientMajor(
  runner: CommandRunner,
  command: 'pg_dump' | 'pg_restore' | 'psql',
  requiredMajor = REQUIRED_PG_DUMP_MAJOR,
): Promise<string> {
  let result: CommandResult;
  try {
    result = await runner.run(command, ['--version']);
  } catch {
    throw new PgDumpError(`${command} is not installed or not on PATH.`);
  }
  if (result.status !== 0) {
    throw new PgDumpError(`${command} --version failed with status ${String(result.status)}.`);
  }
  const major = parsePgClientMajor(result.stdout);
  if (major === null) {
    throw new PgDumpError(`Unable to parse ${command} version from "${result.stdout.trim()}".`);
  }
  if (major !== requiredMajor) {
    throw new PgDumpError(
      `${command} major version ${major} is not supported; exactly ${requiredMajor} is required.`,
    );
  }
  return result.stdout.trim();
}

export type DumpPart = {
  readonly id: string;
  readonly args: readonly string[];
};

/**
 * Turn the restore manifest into pg_dump invocations. Connection details are passed
 * through libpq environment variables (never argv) so secrets do not reach `ps`.
 * Output is custom format on stdout so it can be streamed into the encryptor.
 */
export function buildPgDumpParts(manifest: RestoreManifest): readonly DumpPart[] {
  const baseArgs = ['--format=custom', '--no-password', '--compress=6', '--file=-'];
  const parts: DumpPart[] = [];

  const fullSchemas = manifest.schemas
    .filter((schema) => schema.mode === 'schema_and_data')
    .map((schema) => schema.name);
  if (fullSchemas.length > 0) {
    parts.push({
      id: 'core',
      args: [...baseArgs, ...fullSchemas.map((schema) => `--schema=${schema}`)],
    });
  }

  for (const schema of manifest.schemas) {
    if (schema.mode !== 'data_only_required_tables') continue;
    parts.push({
      id: `${schema.name}_data`,
      args: [
        ...baseArgs,
        '--data-only',
        ...schema.tables.map((table) => `--table=${schema.name}.${table}`),
      ],
    });
  }
  return parts;
}

/** libpq env derived from a connection URL; the URL itself is never placed in argv. */
export function libpqEnvFromUrl(connectionUrl: string, base: CommandEnv = {}): CommandEnv {
  const url = new URL(connectionUrl);
  const env: CommandEnv = {
    PATH: base.PATH,
    HOME: base.HOME,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, '') || 'postgres',
    PGSSLMODE: 'require',
    PGCONNECT_TIMEOUT: '30',
  };
  if (base.PGSSLROOTCERT) env.PGSSLROOTCERT = base.PGSSLROOTCERT;
  return env;
}
