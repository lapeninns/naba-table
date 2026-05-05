import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import { assertExactSupabaseProjectRef } from './db/safety';

const MIGRATION_FILE = 'supabase/migrations/20260502190006_add_gbp_foodmenus_sync_storage.sql';
const TASK_ARTIFACT_DIR = 'tasks/gbp-foodmenus-sync-design-20260502-1850/artifacts';

const TARGETS = {
  staging: {
    projectRef: 'ndxmivcrehsacuerwxtm',
    applyConfirmationEnv: null,
  },
  production: {
    projectRef: 'vrdiqfudmwydclqpydee',
    applyConfirmationEnv: 'CONFIRM_GBP_FOODMENUS_PRODUCTION_MIGRATION',
  },
} as const;

type TargetName = keyof typeof TARGETS;
type Mode = 'verify' | 'apply';

type Args = {
  target: TargetName | null;
  mode: Mode;
  outPrefix: string | null;
};

function usage(): never {
  console.error(
    [
      'Usage:',
      '  pnpm -s tsx scripts/rollout-gbp-foodmenus-storage.ts --target staging|production [--mode verify|apply] [--out-prefix <path-prefix>]',
      '',
      'Env:',
      '  SUPABASE_ACCESS_TOKEN is required for verify/apply postchecks.',
      '  SUPABASE_DB_URL or DATABASE_URL is required for --mode apply.',
      '  CONFIRM_GBP_FOODMENUS_PRODUCTION_MIGRATION=true is required for production --mode apply.',
      '',
      'Notes:',
      '  - Default mode is verify.',
      '  - Verify is read-only.',
      '  - Apply delegates to scripts/apply-sql-file.ts with an expected project ref guard.',
      '  - Secrets and connection strings are never printed by this wrapper.',
    ].join('\n'),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let target: TargetName | null = null;
  let mode: Mode = 'verify';
  let outPrefix: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;

    if (token === '--target') {
      const value = argv[index + 1] ?? null;
      if (value !== 'staging' && value !== 'production') {
        usage();
      }
      target = value;
      index += 1;
      continue;
    }

    if (token.startsWith('--target=')) {
      const value = token.slice('--target='.length);
      if (value !== 'staging' && value !== 'production') {
        usage();
      }
      target = value;
      continue;
    }

    if (token === '--mode') {
      const value = argv[index + 1] ?? null;
      if (value !== 'verify' && value !== 'apply') {
        usage();
      }
      mode = value;
      index += 1;
      continue;
    }

    if (token.startsWith('--mode=')) {
      const value = token.slice('--mode='.length);
      if (value !== 'verify' && value !== 'apply') {
        usage();
      }
      mode = value;
      continue;
    }

    if (token === '--out-prefix') {
      outPrefix = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--out-prefix=')) {
      outPrefix = token.slice('--out-prefix='.length);
      continue;
    }
  }

  if (!target) {
    usage();
  }

  return { target, mode, outPrefix };
}

function artifactPath(args: Args, suffix: string): string {
  const prefix = args.outPrefix ?? `${TASK_ARTIFACT_DIR}/${args.target}-foodmenus-storage-rollout`;
  return path.normalize(`${prefix}-${suffix}.json`);
}

function runStep(label: string, command: string, args: string[], env = process.env) {
  console.log(`[gbp-foodmenus-storage-rollout] ${label}`);
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function assertConnectionStringMatches(projectRef: string): void {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL or DATABASE_URL is required for apply.');
  }
  assertExactSupabaseProjectRef(connectionString, projectRef);
}

function assertApplyAllowed(target: TargetName) {
  const config = TARGETS[target];
  assertConnectionStringMatches(config.projectRef);

  if (config.applyConfirmationEnv && process.env[config.applyConfirmationEnv] !== 'true') {
    throw new Error(`Refusing production apply without ${config.applyConfirmationEnv}=true.`);
  }
}

function runVerify(args: Args, expect: 'applied' | 'missing' | 'any', suffix: string) {
  const target = args.target;
  if (!target) {
    usage();
  }

  runStep('read-only storage verification', 'pnpm', [
    '-s',
    'tsx',
    'scripts/verify-gbp-foodmenus-storage.ts',
    '--project-ref',
    TARGETS[target].projectRef,
    '--expect',
    expect,
    '--out',
    artifactPath(args, suffix),
  ]);
}

function runApply(args: Args) {
  const target = args.target;
  if (!target) {
    usage();
  }

  assertApplyAllowed(target);
  runStep('apply FoodMenus storage migration', 'pnpm', [
    '-s',
    'tsx',
    'scripts/apply-sql-file.ts',
    '--file',
    MIGRATION_FILE,
    '--expected-ref',
    TARGETS[target].projectRef,
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'verify') {
    runVerify(args, 'any', 'verify');
    return;
  }

  runVerify(args, 'any', 'before-apply');
  runApply(args);
  runVerify(args, 'applied', 'after-apply');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
