import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createLogger, type Logger } from '../../db/backup/log';
import {
  createPnpmWranglerRunner,
  envFlags,
  loadWranglerConfig,
  parseD1JsonResults,
  parseWorkerEnvName,
  RecoveryToolError,
  requireExit,
  resolveWorkerBindings,
  workerDir,
  type WorkerEnvName,
  type WranglerRunner,
} from './shared';

/**
 * KV rebuild for BOOKING_SHORT_LINKS_CACHE (see kv-rebuild.md). The namespace is a
 * rebuildable cache: D1 is authoritative for every short link. Rebuild = invalidate
 * every key, then rewarm the readiness sentinel and the active links from D1.
 * Mutation requires --confirm; without it the script only prints the plan.
 */

export const KV_WORKER = 'booking-short-links';
export const KV_BINDING = 'BOOKING_SHORT_LINKS_CACHE';
export const KV_D1_BINDING = 'BOOKING_SHORT_LINKS_DB';
export const READINESS_SENTINEL_KEY = 'readiness:sentinel';
export const LINK_KEY_PREFIX = 'link:';

export type KvKey = { readonly name: string };

export function parseKvKeyList(stdout: string): readonly KvKey[] {
  const start = stdout.indexOf('[');
  if (start === -1) throw new RecoveryToolError('wrangler kv key list did not return JSON.');
  const parsed: unknown = JSON.parse(stdout.slice(start));
  if (!Array.isArray(parsed))
    throw new RecoveryToolError('wrangler kv key list JSON is not an array.');
  return parsed
    .map((entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { name?: unknown }).name === 'string'
        ? { name: (entry as { name: string }).name }
        : null,
    )
    .filter((entry): entry is KvKey => entry !== null);
}

export type KvBulkEntry = {
  readonly key: string;
  readonly value: string;
  readonly expiration?: number;
};

export type ActiveLinkRow = {
  readonly token: string;
  readonly destination_url: string;
  readonly destination_host: string;
  readonly purpose: string;
  readonly booking_id: string | null;
  readonly restaurant_id: string | null;
  readonly created_at: string;
  readonly expires_at: string;
  readonly created_by: string;
};

export function activeLinksQuery(nowIso: string): string {
  return (
    'select token, destination_url, destination_host, purpose, booking_id, restaurant_id, created_at, expires_at, created_by ' +
    `from booking_short_links where revoked_at is null and expires_at > '${nowIso.replace(/'/g, '')}' order by created_at`
  );
}

function asRow(value: Record<string, unknown>): ActiveLinkRow | null {
  const str = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : '');
  const nullable = (key: string) =>
    typeof value[key] === 'string' ? (value[key] as string) : null;
  const token = str('token');
  if (!token || !str('destination_url') || !str('expires_at')) return null;
  return {
    token,
    destination_url: str('destination_url'),
    destination_host: str('destination_host'),
    purpose: str('purpose'),
    booking_id: nullable('booking_id'),
    restaurant_id: nullable('restaurant_id'),
    created_at: str('created_at'),
    expires_at: str('expires_at'),
    created_by: str('created_by'),
  };
}

/** Rewarm entries: sentinel plus one `link:<token>` per active link, expiring with the link. */
export function buildRewarmEntries(
  rows: readonly Record<string, unknown>[],
  now: Date,
): readonly KvBulkEntry[] {
  const entries: KvBulkEntry[] = [
    {
      key: READINESS_SENTINEL_KEY,
      value: JSON.stringify({ ok: true, rewarmedAt: now.toISOString() }),
    },
  ];
  for (const raw of rows) {
    const row = asRow(raw);
    if (!row) continue;
    const expiresAtMs = Date.parse(row.expires_at);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) continue;
    entries.push({
      key: `${LINK_KEY_PREFIX}${row.token}`,
      value: JSON.stringify({
        token: row.token,
        destinationUrl: row.destination_url,
        destinationHost: row.destination_host,
        purpose: row.purpose,
        bookingId: row.booking_id,
        restaurantId: row.restaurant_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        revokedAt: null,
        lastAccessedAt: null,
        createdBy: row.created_by,
      }),
      expiration: Math.floor(expiresAtMs / 1000),
    });
  }
  return entries;
}

export type KvRebuildPlan = {
  readonly worker: string;
  readonly environment: WorkerEnvName;
  readonly namespaceId: string;
  readonly keysToDelete: number;
  readonly entriesToWrite: number;
  readonly mode: 'plan' | 'applied';
};

export type KvRebuildDeps = {
  readonly wrangler: WranglerRunner;
  readonly logger: Logger;
  readonly tempDir: () => string;
};

export async function runKvRebuild(
  input: {
    readonly envName: WorkerEnvName;
    readonly repoRoot: string;
    readonly confirm: boolean;
    readonly now: Date;
  },
  deps: KvRebuildDeps,
): Promise<KvRebuildPlan> {
  const dir = workerDir(input.repoRoot, KV_WORKER);
  const resolution = resolveWorkerBindings(loadWranglerConfig(dir), input.envName);
  if (resolution.kind === 'unconfigured') {
    throw new RecoveryToolError(
      `${KV_WORKER} ${input.envName} bindings are unconfigured (${resolution.placeholders.join(', ')}).`,
    );
  }
  const kv = resolution.bindings.kv.find((entry) => entry.binding === KV_BINDING);
  const d1 = resolution.bindings.d1.find((entry) => entry.binding === KV_D1_BINDING);
  if (!kv || !d1)
    throw new RecoveryToolError(
      `${KV_WORKER} lacks ${KV_BINDING} or ${KV_D1_BINDING} for ${input.envName}.`,
    );
  const flags = envFlags(input.envName);

  const keys = parseKvKeyList(
    requireExit(
      await deps.wrangler.run(dir, [
        'kv',
        'key',
        'list',
        '--namespace-id',
        kv.namespaceId,
        ...flags,
      ]),
      'kv key list',
    ).stdout,
  );
  const rows = parseD1JsonResults(
    requireExit(
      await deps.wrangler.run(dir, [
        'd1',
        'execute',
        d1.databaseName,
        '--remote',
        '--json',
        ...flags,
        '--command',
        activeLinksQuery(input.now.toISOString()),
      ]),
      'd1 active links',
    ).stdout,
  );
  const entries = buildRewarmEntries(rows, input.now);
  const plan: KvRebuildPlan = {
    worker: KV_WORKER,
    environment: input.envName,
    namespaceId: kv.namespaceId,
    keysToDelete: keys.length,
    entriesToWrite: entries.length,
    mode: 'plan',
  };
  if (!input.confirm) return plan;

  const temp = deps.tempDir();
  try {
    if (keys.length > 0) {
      const deleteFile = path.join(temp, 'delete.json');
      fs.writeFileSync(deleteFile, JSON.stringify(keys.map((key) => key.name)));
      requireExit(
        await deps.wrangler.run(dir, [
          'kv',
          'bulk',
          'delete',
          deleteFile,
          '--namespace-id',
          kv.namespaceId,
          '--force',
          ...flags,
        ]),
        'kv bulk delete',
      );
    }
    const putFile = path.join(temp, 'put.json');
    fs.writeFileSync(putFile, JSON.stringify(entries));
    requireExit(
      await deps.wrangler.run(dir, [
        'kv',
        'bulk',
        'put',
        putFile,
        '--namespace-id',
        kv.namespaceId,
        ...flags,
      ]),
      'kv bulk put',
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  deps.logger.info('KV namespace rebuilt', {
    environment: input.envName,
    deleted: keys.length,
    written: entries.length,
  });
  return { ...plan, mode: 'applied' };
}

const HELP = `Nabatable KV rebuild (booking short links cache)

Usage: tsx scripts/cloudflare/recovery/kv-rebuild.ts --env staging|production [--confirm] [--repo-root <dir>]
Without --confirm only the plan is printed. See scripts/cloudflare/recovery/kv-rebuild.md.
`;

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: {
    readonly stdout: (line: string) => void;
    readonly logger: Logger;
    readonly now: () => Date;
    readonly cwd: string;
  },
): Promise<number> {
  if (args.includes('--help')) {
    io.stdout(HELP);
    return 0;
  }
  const values = new Map<string, string>();
  let confirm = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--confirm') {
      confirm = true;
      continue;
    }
    const value = args[index + 1];
    if (!['--env', '--repo-root'].includes(arg) || value === undefined || value.startsWith('--')) {
      io.logger.error(`Invalid argument ${arg}.`);
      return 2;
    }
    values.set(arg, value);
    index += 1;
  }
  let envName: WorkerEnvName;
  try {
    envName = parseWorkerEnvName(values.get('--env'));
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Invalid --env.');
    return 2;
  }
  try {
    const plan = await runKvRebuild(
      { envName, repoRoot: values.get('--repo-root') ?? io.cwd, confirm, now: io.now() },
      {
        wrangler: createPnpmWranglerRunner(env),
        logger: io.logger,
        tempDir: () => {
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-kv-'));
          fs.chmodSync(dir, 0o700);
          return dir;
        },
      },
    );
    io.stdout(JSON.stringify(plan, null, 2));
    return 0;
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'KV rebuild failed.');
    return error instanceof RecoveryToolError && /unconfigured/.test(error.message) ? 2 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    logger: createLogger(),
    now: () => new Date(),
    cwd: process.cwd(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'KV rebuild failed.'}\n`);
      process.exitCode = 1;
    },
  );
}
