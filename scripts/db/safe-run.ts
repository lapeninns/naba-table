#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

import { loadEnvironmentFiles } from '../validate-env';
import { evaluateDbTargetSafety, normalizeTargetEnv, type DbTargetEnv } from './safety';

type Operation = {
  description: string;
  commands: string[];
};

const OPERATIONS: Record<string, Operation> = {
  reset: {
    description: 'Apply init-database + seeds to target database',
    commands: [
      'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-database.sql',
      'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-seeds.sql',
    ],
  },
  migrate: {
    description: 'Apply init-database (schema and migrations) to target database',
    commands: ['psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-database.sql'],
  },
  'seed-only': {
    description: 'Apply seeds only to target database',
    commands: ['psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-seeds.sql'],
  },
  wipe: {
    description: 'Drop public schema on target database',
    commands: ['psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/wipe-public-schema.sql'],
  },
};

const ALIASES: Record<string, keyof typeof OPERATIONS> = {
  'full-reset': 'reset',
};

function resolveOperation(name?: string): { key: string; operation: Operation } | null {
  if (!name) return null;
  const normalized = name.trim();
  const opKey = (OPERATIONS[normalized] ? normalized : ALIASES[normalized]) as keyof typeof OPERATIONS | undefined;
  if (!opKey) return null;
  return { key: normalized, operation: OPERATIONS[opKey] };
}

async function promptForConfirmation(targetEnv: DbTargetEnv, operation: string): Promise<boolean> {
  if (!process.stdin.isTTY || process.env.CI === 'true') {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));
  const answer = await question(
    `⚠️  You are about to run "${operation}" against "${targetEnv}". Type the target environment to continue: `,
  );
  rl.close();
  return answer.trim().toLowerCase() === targetEnv;
}

function ensureEnvFileLoad() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const cwd = process.cwd();
  const paths = [resolvePath(cwd, '.env.local'), resolvePath(cwd, '.env.development'), resolvePath(cwd, '.env')];
  loadEnvironmentFiles(paths);

  // Also attempt parent of scripts directory in case cwd differs
  const altPaths = [
    resolvePath(root, '.env.local'),
    resolvePath(root, '.env.development'),
    resolvePath(root, '.env'),
  ];
  loadEnvironmentFiles(altPaths);
}

async function main() {
  ensureEnvFileLoad();

  const opArg = process.argv[2];
  const op = resolveOperation(opArg);

  if (!op) {
    console.error(`❌ Unknown or missing db operation "${opArg ?? '<empty>'}". Use one of: ${Object.keys(OPERATIONS).join(', ')}`);
    process.exit(1);
  }

  const targetEnv = normalizeTargetEnv(process.env.DB_TARGET_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV);
  const safety = evaluateDbTargetSafety({
    appEnv: process.env.APP_ENV ?? process.env.NODE_ENV,
    targetEnv,
    supabaseDbUrl: process.env.SUPABASE_DB_URL ?? null,
    productionSupabaseUrl: process.env.PRODUCTION_SUPABASE_URL ?? null,
    allowProdOverride:
      process.env.ALLOW_PROD_DB_WIPE === 'true' || process.env.ALLOW_PROD_RESOURCES_IN_NONPROD === 'true',
  });

  if (!safety.allowed) {
    console.error('❌ Database safety checks failed:');
    safety.reasons.forEach((reason) => console.error(` - ${reason}`));
    process.exit(1);
  }

  if (process.env.DB_SAFETY_DRY_RUN === 'true') {
    console.log(`[dry-run] Would run "${op.key}" (${op.operation.description}) against ${targetEnv}.`);
    return;
  }

  const confirmed = await promptForConfirmation(safety.targetEnv, op.key);
  if (!confirmed) {
    console.error('Aborted by user.');
    process.exit(1);
  }

  for (const command of op.operation.commands) {
    const result = spawnSync(command, {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    if (result.status !== 0) {
      console.error(`❌ Command failed: ${command}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log(`✅ Completed "${op.key}" against ${safety.targetEnv}`);
}

main().catch((error) => {
  console.error('❌ Unexpected error during database operation:', error);
  process.exit(1);
});
