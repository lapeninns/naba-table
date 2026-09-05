import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { canonicalTuple, parseCiTuple, sameTuple, type CiRequestTuple } from './ci-tuple';
import { isRecord } from './evidence';
import { flagString, parseFlags } from './exec';

/**
 * Staging deployment lock.
 *
 * The lock lives in a GitHub Actions repository variable (default STAGING_DEPLOY_LOCK) so
 * both hosted workflows and the local controller see the same holder. A lock is held by a
 * (owner, CI tuple) pair with a TTL; a different tuple cannot acquire or release it while
 * it is live. Expired locks are treated as free. All HTTP goes through an injectable fetch.
 */
export type LockRecord = {
  readonly owner: string;
  readonly tuple: CiRequestTuple;
  readonly acquiredAt: string;
  readonly expiresAt: string;
};

export interface LockStore {
  read(): Promise<LockRecord | null>;
  write(record: LockRecord | null): Promise<void>;
}

export class LockHeldError extends Error {
  readonly holder: LockRecord;

  constructor(action: string, holder: LockRecord) {
    super(
      `Staging lock is held by owner "${holder.owner}" for tuple ${canonicalTuple(holder.tuple)} until ${holder.expiresAt}; refusing to ${action}.`,
    );
    this.name = 'LockHeldError';
    this.holder = holder;
  }
}

export function parseLockRecord(value: unknown): LockRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.owner !== 'string' || !value.owner) return null;
  if (typeof value.acquiredAt !== 'string' || typeof value.expiresAt !== 'string') return null;
  if (Number.isNaN(Date.parse(value.expiresAt))) return null;
  try {
    return {
      owner: value.owner,
      tuple: parseCiTuple(value.tuple),
      acquiredAt: value.acquiredAt,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

export function isLive(record: LockRecord | null, now: Date): record is LockRecord {
  return record !== null && Date.parse(record.expiresAt) > now.getTime();
}

export type LockOperation = {
  readonly store: LockStore;
  readonly owner: string;
  readonly tuple: CiRequestTuple;
  readonly now?: () => Date;
};

export async function acquireLock(
  operation: LockOperation & { readonly ttlSeconds: number },
): Promise<{ readonly status: 'acquired' | 'renewed'; readonly record: LockRecord }> {
  if (!Number.isInteger(operation.ttlSeconds) || operation.ttlSeconds <= 0) {
    throw new Error('ttlSeconds must be a positive integer.');
  }
  if (!operation.owner.trim()) throw new Error('owner is required.');
  const now = (operation.now ?? (() => new Date()))();
  const current = await operation.store.read();
  let status: 'acquired' | 'renewed' = 'acquired';
  if (isLive(current, now)) {
    if (!sameTuple(current.tuple, operation.tuple) || current.owner !== operation.owner) {
      throw new LockHeldError('acquire', current);
    }
    status = 'renewed';
  }
  const record: LockRecord = {
    owner: operation.owner,
    tuple: operation.tuple,
    acquiredAt: status === 'renewed' && current ? current.acquiredAt : now.toISOString(),
    expiresAt: new Date(now.getTime() + operation.ttlSeconds * 1000).toISOString(),
  };
  await operation.store.write(record);
  return { status, record };
}

export async function releaseLock(
  operation: LockOperation,
): Promise<{ readonly status: 'released' | 'not-held' }> {
  const now = (operation.now ?? (() => new Date()))();
  const current = await operation.store.read();
  if (!isLive(current, now)) {
    if (current) await operation.store.write(null);
    return { status: 'not-held' };
  }
  if (!sameTuple(current.tuple, operation.tuple) || current.owner !== operation.owner) {
    throw new LockHeldError('release', current);
  }
  await operation.store.write(null);
  return { status: 'released' };
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type GitHubVariableStoreOptions = {
  readonly repository: string;
  readonly token: string;
  readonly variableName?: string;
  readonly fetchImpl?: FetchLike;
  readonly apiBaseUrl?: string;
};

export const DEFAULT_LOCK_VARIABLE = 'STAGING_DEPLOY_LOCK';

/** Lock persisted as the JSON value of a GitHub Actions repository variable. */
export class GitHubVariableLockStore implements LockStore {
  private readonly repository: string;
  private readonly token: string;
  private readonly variableName: string;
  private readonly fetchImpl: FetchLike;
  private readonly apiBaseUrl: string;

  constructor(options: GitHubVariableStoreOptions) {
    if (!/^[\w.-]+\/[\w.-]+$/u.test(options.repository)) {
      throw new Error('GITHUB_REPOSITORY must be "owner/repo".');
    }
    if (!options.token) throw new Error('A GitHub token is required for the staging lock.');
    this.repository = options.repository;
    this.token = options.token;
    this.variableName = options.variableName ?? DEFAULT_LOCK_VARIABLE;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBaseUrl = (options.apiBaseUrl ?? 'https://api.github.com').replace(/\/$/u, '');
  }

  private url(suffix: string): string {
    return `${this.apiBaseUrl}/repos/${this.repository}/actions/variables${suffix}`;
  }

  private headers(): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${this.token}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    };
  }

  async read(): Promise<LockRecord | null> {
    const response = await this.fetchImpl(this.url(`/${this.variableName}`), {
      method: 'GET',
      headers: this.headers(),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`GitHub variable read failed with HTTP ${response.status}.`);
    }
    const body = (await response.json()) as unknown;
    if (!isRecord(body) || typeof body.value !== 'string') return null;
    try {
      return parseLockRecord(JSON.parse(body.value) as unknown);
    } catch {
      return null;
    }
  }

  async write(record: LockRecord | null): Promise<void> {
    const value = JSON.stringify(record ?? { released: true });
    const patch = await this.fetchImpl(this.url(`/${this.variableName}`), {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ name: this.variableName, value }),
    });
    if (patch.status === 404) {
      const create = await this.fetchImpl(this.url(''), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ name: this.variableName, value }),
      });
      if (!create.ok) throw new Error(`GitHub variable create failed with HTTP ${create.status}.`);
      return;
    }
    if (!patch.ok) throw new Error(`GitHub variable update failed with HTTP ${patch.status}.`);
  }
}

export function loadTupleFile(filePath: string): CiRequestTuple {
  return parseCiTuple(JSON.parse(readFileSync(filePath, 'utf8')) as unknown);
}

export async function main(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  storeFactory?: () => LockStore,
): Promise<number> {
  const { flags, positionals } = parseFlags(argv);
  const action = positionals[0];
  if (action !== 'acquire' && action !== 'release' && action !== 'status') {
    throw new Error(
      'Usage: deploy:staging-lock acquire|release|status --owner <name> --tuple-file <path> [--ttl-seconds 1800]',
    );
  }
  const store =
    storeFactory?.() ??
    (() => {
      const repository = env.GITHUB_REPOSITORY?.trim() ?? '';
      const token = env.STAGING_LOCK_GITHUB_TOKEN?.trim() || env.GITHUB_TOKEN?.trim() || '';
      if (!repository || !token) {
        throw new Error(
          'Staging lock is unconfigured: set GITHUB_REPOSITORY and GITHUB_TOKEN (or STAGING_LOCK_GITHUB_TOKEN).',
        );
      }
      return new GitHubVariableLockStore({
        repository,
        token,
        variableName: env.STAGING_LOCK_VARIABLE?.trim() || DEFAULT_LOCK_VARIABLE,
      });
    })();

  if (action === 'status') {
    const current = await store.read();
    const live = isLive(current, new Date());
    process.stdout.write(
      `${JSON.stringify({ held: live, owner: live ? current.owner : null, expiresAt: live ? current.expiresAt : null })}\n`,
    );
    return 0;
  }

  const owner = flagString(flags, 'owner');
  const tupleFile = flagString(flags, 'tuple-file');
  if (!owner || !tupleFile) throw new Error('--owner and --tuple-file are required.');
  const tuple = loadTupleFile(tupleFile);
  if (action === 'acquire') {
    const ttlSeconds = Number(flagString(flags, 'ttl-seconds') ?? '1800');
    const result = await acquireLock({ store, owner, tuple, ttlSeconds });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  }
  const result = await releaseLock({ store, owner, tuple });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'staging-lock.ts') {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
