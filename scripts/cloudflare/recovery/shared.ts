import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared helpers for the Cloudflare recovery tooling (D1 backup, KV rebuild, queue
 * reconciliation). Everything that talks to Cloudflare goes through an injectable
 * `WranglerRunner`; the real runner shells out to the worker's own wrangler via pnpm,
 * so a test never needs (and never touches) a Cloudflare account.
 */

export type WorkerEnvName = 'staging' | 'production';
export const WORKER_ENV_NAMES: readonly WorkerEnvName[] = ['staging', 'production'];

export const PLACEHOLDER_PATTERN = /^REPLACE_ME_[A-Z0-9_]+$/u;

export class RecoveryToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryToolError';
  }
}

export type CommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type WranglerRunner = {
  /** Run `wrangler <args>` inside the worker directory. Never receives credentials in argv. */
  run(workerDir: string, args: readonly string[]): Promise<CommandResult>;
};

export function createPnpmWranglerRunner(env: NodeJS.ProcessEnv = process.env): WranglerRunner {
  return {
    run(workerDir, args) {
      return new Promise((resolve, reject) => {
        const child = spawn('pnpm', ['exec', 'wrangler', ...args], {
          cwd: workerDir,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
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
      });
    },
  };
}

export function parseWorkerEnvName(value: string | undefined): WorkerEnvName {
  if (value === 'staging' || value === 'production') return value;
  throw new RecoveryToolError('--env must be exactly staging or production.');
}

/** Wrangler flags selecting the named environment (production is the top-level config). */
export function envFlags(envName: WorkerEnvName): readonly string[] {
  return envName === 'production' ? [] : ['--env', envName];
}

/**
 * Minimal JSONC reader for wrangler.jsonc: strips line and block comments (outside
 * string literals) and trailing commas, then parses as JSON.
 */
export function parseJsonc(text: string): unknown {
  let out = '';
  let index = 0;
  let inString = false;
  while (index < text.length) {
    const char = text[index] ?? '';
    const next = text[index + 1] ?? '';
    if (inString) {
      out += char;
      if (char === '\\') {
        out += next;
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    out += char;
    index += 1;
  }
  const withoutTrailingCommas = out.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type D1Binding = {
  readonly binding: string;
  readonly databaseName: string;
  readonly databaseId: string;
  readonly migrationsDir: string;
};

export type KvBinding = {
  readonly binding: string;
  readonly namespaceId: string;
};

export type QueueConsumer = {
  readonly queue: string;
  readonly deadLetterQueue: string | null;
  readonly maxRetries: number | null;
};

export type WorkerBindings = {
  readonly workerName: string;
  readonly d1: readonly D1Binding[];
  readonly kv: readonly KvBinding[];
  readonly queueConsumers: readonly QueueConsumer[];
  readonly durableObjectClasses: readonly string[];
};

export type BindingResolution =
  | { readonly kind: 'configured'; readonly bindings: WorkerBindings }
  | { readonly kind: 'unconfigured'; readonly placeholders: readonly string[] };

function sectionFor(
  config: Record<string, unknown>,
  envName: WorkerEnvName,
): Record<string, unknown> {
  if (envName === 'production') return config;
  const env = isRecord(config.env) ? config.env : {};
  const section = env[envName];
  if (!isRecord(section)) {
    throw new RecoveryToolError(`wrangler config has no env.${envName} section.`);
  }
  return section;
}

/** Resolve the bindings of one environment; REPLACE_ME_ ids make the result "unconfigured". */
export function resolveWorkerBindings(config: unknown, envName: WorkerEnvName): BindingResolution {
  if (!isRecord(config)) throw new RecoveryToolError('wrangler config must be an object.');
  const section = sectionFor(config, envName);
  const workerName = typeof section.name === 'string' ? section.name : '';
  if (!workerName) throw new RecoveryToolError(`wrangler config env ${envName} has no name.`);
  const placeholders: string[] = [];
  const check = (value: string, label: string): string => {
    if (PLACEHOLDER_PATTERN.test(value)) placeholders.push(label);
    return value;
  };

  const d1 = (Array.isArray(section.d1_databases) ? section.d1_databases : [])
    .filter(isRecord)
    .map((entry, index) => ({
      binding: String(entry.binding ?? ''),
      databaseName: String(entry.database_name ?? ''),
      databaseId: check(String(entry.database_id ?? ''), `d1_databases[${index}].database_id`),
      migrationsDir: String(entry.migrations_dir ?? 'migrations'),
    }));
  const kv = (Array.isArray(section.kv_namespaces) ? section.kv_namespaces : [])
    .filter(isRecord)
    .map((entry, index) => ({
      binding: String(entry.binding ?? ''),
      namespaceId: check(String(entry.id ?? ''), `kv_namespaces[${index}].id`),
    }));
  const queues = isRecord(section.queues) ? section.queues : {};
  const queueConsumers = (Array.isArray(queues.consumers) ? queues.consumers : [])
    .filter(isRecord)
    .map((entry) => ({
      queue: String(entry.queue ?? ''),
      deadLetterQueue: typeof entry.dead_letter_queue === 'string' ? entry.dead_letter_queue : null,
      maxRetries: typeof entry.max_retries === 'number' ? entry.max_retries : null,
    }));
  const durableObjects = isRecord(section.durable_objects) ? section.durable_objects : {};
  const durableObjectClasses = (
    Array.isArray(durableObjects.bindings) ? durableObjects.bindings : []
  )
    .filter(isRecord)
    .map((entry) => String(entry.class_name ?? ''))
    .filter((name) => name.length > 0);

  if (placeholders.length > 0) return { kind: 'unconfigured', placeholders };
  return {
    kind: 'configured',
    bindings: { workerName, d1, kv, queueConsumers, durableObjectClasses },
  };
}

export function loadWranglerConfig(workerDir: string): unknown {
  const configPath = path.join(workerDir, 'wrangler.jsonc');
  let text: string;
  try {
    text = fs.readFileSync(configPath, 'utf8');
  } catch {
    throw new RecoveryToolError(`wrangler.jsonc not found at ${configPath}.`);
  }
  return parseJsonc(text);
}

/** Parse `wrangler d1 execute --json` output into result rows. */
export function parseD1JsonResults(stdout: string): readonly Record<string, unknown>[] {
  const start = stdout.indexOf('[');
  if (start === -1) throw new RecoveryToolError('wrangler d1 execute did not return JSON.');
  const parsed: unknown = JSON.parse(stdout.slice(start));
  if (!Array.isArray(parsed))
    throw new RecoveryToolError('wrangler d1 execute JSON is not an array.');
  const rows: Record<string, unknown>[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry) || !Array.isArray(entry.results)) continue;
    for (const row of entry.results) if (isRecord(row)) rows.push(row);
  }
  return rows;
}

export function requireExit(result: CommandResult, what: string): CommandResult {
  if (result.status !== 0) {
    throw new RecoveryToolError(`${what} failed with status ${String(result.status)}.`);
  }
  return result;
}

export function workerDir(repoRoot: string, worker: string): string {
  return path.join(repoRoot, 'cloudflare', worker);
}
