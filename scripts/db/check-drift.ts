import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_INVENTORY_RELATIVE_PATH,
  compareInventory,
  inspectSchemaInventory,
  parseInventoryBaseline,
  renderInventoryBaseline,
  renderInventoryDifferences,
  type InventoryQuery,
} from './migrations/drift-inventory';
import {
  databaseUrlFromEnv,
  isRemoteTarget,
  readLinkedProjectRef,
  validateRemoteTarget,
} from './migrations/targets';
import { ISOLATED_WORKDIR_ENV } from './migrations/workdir';

/**
 * Remote schema drift checker.
 *
 * Default scope (`DB_DRIFT_SCOPE` unset or `public`): `supabase db diff --linked --schema public`
 * against the linked project, optionally inside the isolated workdir handed over by
 * scripts/db/safe-run.ts through DB_ISOLATED_WORKDIR.
 *
 * Extended scope (`DB_DRIFT_SCOPE=extended`): additionally inventories functions, grants, RLS
 * policies, constraints, table RLS flags, role settings and default privileges through a
 * validated database connection and compares them with config/db/schema-inventory.json.
 * A missing baseline fails closed; DB_DRIFT_RECORD_INVENTORY=true records it from staging.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runPublicDiff(env: NodeJS.ProcessEnv): number {
  const args = ['db', 'diff', '--linked', '--schema', 'public'];
  const isolatedWorkdir = env[ISOLATED_WORKDIR_ENV]?.trim();
  if (isolatedWorkdir) {
    if (!path.isAbsolute(isolatedWorkdir)) {
      process.stderr.write(`${ISOLATED_WORKDIR_ENV} must be an absolute path.\n`);
      return 2;
    }
    args.push('--workdir', isolatedWorkdir);
  }

  const result = spawnSync('supabase', args, { encoding: 'utf8', env });
  const commandExit = result.status ?? 1;
  const standardOutput = result.stdout ?? '';
  const standardError = result.stderr ?? '';

  if (standardError) {
    process.stderr.write(standardError);
  }

  if (commandExit !== 0) {
    if (standardOutput) {
      process.stdout.write(standardOutput);
    }
    return commandExit;
  }
  if (standardOutput.trim()) {
    process.stdout.write(standardOutput);
    process.stderr.write('Schema drift detected.\n');
    return 1;
  }
  process.stdout.write('No schema drift detected.\n');
  return 0;
}

function inventoryBaselinePath(env: NodeJS.ProcessEnv): string {
  const override = env.DB_DRIFT_INVENTORY_BASELINE?.trim();
  return override && path.isAbsolute(override)
    ? override
    : path.join(REPO_ROOT, SCHEMA_INVENTORY_RELATIVE_PATH);
}

export async function runExtendedInspection(
  env: NodeJS.ProcessEnv,
  query: InventoryQuery,
): Promise<number> {
  const baselinePath = inventoryBaselinePath(env);
  const record = env.DB_DRIFT_RECORD_INVENTORY === 'true';
  const target = env.DB_TARGET_ENV;

  let actual;
  try {
    actual = await inspectSchemaInventory(query);
  } catch (error) {
    process.stderr.write(`inventory: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  if (!existsSync(baselinePath)) {
    if (record && target === 'staging') {
      writeFileSync(
        baselinePath,
        renderInventoryBaseline(actual, new Date().toISOString()),
        'utf8',
      );
      process.stdout.write(`inventory: recorded baseline at ${baselinePath}\n`);
      return 0;
    }
    process.stderr.write(
      `inventory: baseline missing at ${SCHEMA_INVENTORY_RELATIVE_PATH}; record it from staging with DB_DRIFT_RECORD_INVENTORY=true.\n`,
    );
    return 1;
  }

  let baseline;
  try {
    baseline = parseInventoryBaseline(readFileSync(baselinePath, 'utf8'));
  } catch (error) {
    process.stderr.write(`inventory: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const comparison = compareInventory(baseline.inventory, actual);
  if (!comparison.ok) {
    process.stdout.write(renderInventoryDifferences(comparison));
    if (record && target === 'staging') {
      writeFileSync(
        baselinePath,
        renderInventoryBaseline(actual, new Date().toISOString()),
        'utf8',
      );
      process.stdout.write(`inventory: re-recorded baseline at ${baselinePath}\n`);
      return 0;
    }
    process.stderr.write('Schema inventory drift detected.\n');
    return 1;
  }
  process.stdout.write('No schema inventory drift detected.\n');
  return 0;
}

async function main(): Promise<number> {
  const env = process.env;
  const scope = env.DB_DRIFT_SCOPE?.trim() || 'public';
  if (scope !== 'public' && scope !== 'extended') {
    process.stderr.write('DB_DRIFT_SCOPE must be public or extended.\n');
    return 2;
  }

  const diffExit = runPublicDiff(env);
  if (diffExit !== 0 || scope === 'public') {
    return diffExit;
  }

  const target = env.DB_TARGET_ENV;
  if (!isRemoteTarget(target)) {
    process.stderr.write(
      'DB_TARGET_ENV must be exactly staging or production for extended drift.\n',
    );
    return 2;
  }
  const databaseUrl = databaseUrlFromEnv(env);
  const linkedRoot = env[ISOLATED_WORKDIR_ENV]?.trim() || env.SUPABASE_WORKDIR?.trim() || REPO_ROOT;
  const validation = validateRemoteTarget({
    target,
    linkedProjectRef: readLinkedProjectRef(linkedRoot),
    databaseUrl,
    requireDatabaseUrl: true,
  });
  if (!validation.ok) {
    process.stderr.write(`${validation.message}\n`);
    return 2;
  }

  const { Client } = await import('pg');
  const { getPgSslConfig } = await import('./pg-ssl');
  const client = new Client({ connectionString: databaseUrl, ssl: getPgSslConfig() });
  await client.connect();
  try {
    return await runExtendedInspection(env, async (sql) => {
      const result = await client.query(sql);
      return (result.rows ?? []) as readonly Record<string, unknown>[];
    });
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `check-drift: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
