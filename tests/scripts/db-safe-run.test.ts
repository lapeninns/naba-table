import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const tsxExecutable = path.join(projectRoot, 'node_modules/.bin/tsx');
const temporaryDirectories: string[] = [];

type CliResult = {
  readonly status: number | null;
  readonly output: string;
  readonly calls: readonly string[];
};

function writeExecutable(filePath: string, source: string): void {
  writeFileSync(filePath, source);
  chmodSync(filePath, 0o755);
}

function runCli(
  args: readonly string[],
  overrides: Readonly<Record<string, string | undefined>> = {},
): CliResult {
  const directory = mkdtempSync(path.join(tmpdir(), 'nabatable-db-safe-run-'));
  const binDirectory = path.join(directory, 'bin');
  const logPath = path.join(directory, 'calls.log');
  temporaryDirectories.push(directory);
  writeFileSync(logPath, '');
  mkdirSync(binDirectory);

  writeExecutable(
    path.join(binDirectory, 'pnpm'),
    '#!/bin/sh\nprintf "pnpm %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"\nif [ "$1" = "validate:env" ]; then exit "${SAFE_RUN_TEST_VALIDATE_EXIT:-0}"; fi\nexit "${SAFE_RUN_TEST_COMMAND_EXIT:-0}"\n',
  );
  writeExecutable(
    path.join(binDirectory, 'supabase'),
    '#!/bin/sh\nprintf "supabase %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"\nexit "${SAFE_RUN_TEST_COMMAND_EXIT:-0}"\n',
  );

  const result = spawnSync(tsxExecutable, ['scripts/db/safe-run.ts', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      SAFE_RUN_TEST_LOG: logPath,
      ...overrides,
    },
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    calls: readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean),
  };
}

function runDriftCli(overrides: Readonly<Record<string, string>> = {}): CliResult {
  const directory = mkdtempSync(path.join(tmpdir(), 'nabatable-db-drift-'));
  const binDirectory = path.join(directory, 'bin');
  const logPath = path.join(directory, 'calls.log');
  temporaryDirectories.push(directory);
  mkdirSync(binDirectory);
  writeFileSync(logPath, '');
  writeExecutable(
    path.join(binDirectory, 'supabase'),
    '#!/bin/sh\nprintf "supabase %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"\nprintf "%s" "$SAFE_RUN_TEST_DRIFT_OUTPUT"\nexit "${SAFE_RUN_TEST_COMMAND_EXIT:-0}"\n',
  );

  const result = spawnSync(tsxExecutable, ['scripts/db/check-drift.ts'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      SAFE_RUN_TEST_LOG: logPath,
      ...overrides,
    },
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    calls: readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('remote database safe runner CLI', () => {
  it('prints side-effect-free operator guidance when help is requested @contract', () => {
    const whenHelpRuns = runCli(['--help']);

    expect(whenHelpRuns.status).toBe(0);
    expect(whenHelpRuns.output).toContain('DB_TARGET_ENV=staging|production');
    expect(whenHelpRuns.output).toContain('CONFIRM_PRODUCTION=true');
    expect(whenHelpRuns.calls).toEqual([]);
  });

  it('prints a redacted plan without children when dry-run is requested @contract', () => {
    const secret = 'postgres://operator:never-print-this@example.invalid/db';

    const whenDryRunRuns = runCli(['status', '--dry-run'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_DB_URL: secret,
    });

    expect(whenDryRunRuns.status).toBe(0);
    expect(whenDryRunRuns.output).toContain('target=staging access=read-only');
    expect(whenDryRunRuns.output).toContain('supabase migration list');
    expect(whenDryRunRuns.output).not.toContain(secret);
    expect(whenDryRunRuns.calls).toEqual([]);
  });

  it.each([undefined, 'development', 'STAGING '])(
    'refuses missing or invalid target %s before running children',
    (target) => {
      const whenTargetIsInvalid = runCli(['status'], { DB_TARGET_ENV: target });

      expect(whenTargetIsInvalid.status).toBe(2);
      expect(whenTargetIsInvalid.output).toContain(
        'DB_TARGET_ENV must be exactly staging or production',
      );
      expect(whenTargetIsInvalid.calls).toEqual([]);
    },
  );

  it('refuses an unconfirmed production migration before running children @contract', () => {
    const whenProductionIsUnconfirmed = runCli(['migrate'], { DB_TARGET_ENV: 'production' });

    expect(whenProductionIsUnconfirmed.status).toBe(2);
    expect(whenProductionIsUnconfirmed.output).toContain('CONFIRM_PRODUCTION=true is required');
    expect(whenProductionIsUnconfirmed.calls).toEqual([]);
  });

  it('allows an unconfirmed production migration dry-run without children @contract', () => {
    const whenProductionDryRunRuns = runCli(['migrate', '--dry-run'], {
      DB_TARGET_ENV: 'production',
    });

    expect(whenProductionDryRunRuns.status).toBe(0);
    expect(whenProductionDryRunRuns.output).toContain('target=production access=migration');
    expect(whenProductionDryRunRuns.calls).toEqual([]);
  });

  it.each([['unknown'], ['status', '--force'], ['status', 'extra'], ['status', '--', '--linked']])(
    'rejects unsupported argument boundary %j',
    (args) => {
      const whenArgumentsAreUnsupported = runCli(args, { DB_TARGET_ENV: 'staging' });

      expect(whenArgumentsAreUnsupported.status).toBe(2);
      expect(whenArgumentsAreUnsupported.output).toContain('Usage:');
      expect(whenArgumentsAreUnsupported.calls).toEqual([]);
    },
  );

  it.each([
    ['status', 'supabase migration list'],
    ['pull', 'supabase db pull'],
    ['check-drift', 'pnpm exec tsx scripts/db/check-drift.ts'],
  ])('validates before delegated read workflow %s', (workflow, delegatedCall) => {
    const whenReadWorkflowRuns = runCli([workflow], { DB_TARGET_ENV: 'production' });

    expect(whenReadWorkflowRuns.status).toBe(0);
    expect(whenReadWorkflowRuns.calls).toEqual(['pnpm validate:env', delegatedCall]);
  });

  it.each(['migrate', 'push'])('validates before staging migration alias %s', (workflow) => {
    const whenMigrationRuns = runCli([workflow], { DB_TARGET_ENV: 'staging' });

    expect(whenMigrationRuns.status).toBe(0);
    expect(whenMigrationRuns.calls).toEqual(['pnpm validate:env', 'supabase db push']);
  });

  it('allows a confirmed production migration @contract', () => {
    const whenProductionIsConfirmed = runCli(['push'], {
      CONFIRM_PRODUCTION: 'true',
      DB_TARGET_ENV: 'production',
    });

    expect(whenProductionIsConfirmed.status).toBe(0);
    expect(whenProductionIsConfirmed.calls).toEqual(['pnpm validate:env', 'supabase db push']);
  });

  it('propagates environment validation failure and stops @contract', () => {
    const whenValidationFails = runCli(['status'], {
      DB_TARGET_ENV: 'staging',
      SAFE_RUN_TEST_VALIDATE_EXIT: '17',
    });

    expect(whenValidationFails.status).toBe(17);
    expect(whenValidationFails.calls).toEqual(['pnpm validate:env']);
  });

  it('propagates the delegated workflow exit code @contract', () => {
    const whenWorkflowFails = runCli(['status'], {
      DB_TARGET_ENV: 'staging',
      SAFE_RUN_TEST_COMMAND_EXIT: '23',
    });

    expect(whenWorkflowFails.status).toBe(23);
    expect(whenWorkflowFails.calls).toEqual(['pnpm validate:env', 'supabase migration list']);
  });
});

describe('remote-only database command inventory', () => {
  it('routes supported package commands through the safe runner and removes local workflows @contract', () => {
    const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    const scripts = packageJson.scripts;

    expect(scripts['db:status']).toBe('tsx scripts/db/safe-run.ts status');
    expect(scripts['db:migrate']).toBe('tsx scripts/db/safe-run.ts migrate');
    expect(scripts['db:push']).toBe('tsx scripts/db/safe-run.ts push');
    expect(scripts['db:pull']).toBe('tsx scripts/db/safe-run.ts pull');
    expect(scripts['db:check-drift']).toBe('tsx scripts/db/safe-run.ts check-drift');
    expect(scripts['format:db-safe-run']).toBe(
      'prettier --check scripts/db/safe-run.ts scripts/db/check-drift.ts tests/scripts/db-safe-run.test.ts package.json README.md docs/environments.md docs/security.md micro-specs/00-foundation/03-remote-db-safe-run.md',
    );
    expect(
      Object.keys(scripts).filter((name) => /db:(reset|seed-only|full-reset|wipe)/.test(name)),
    ).toEqual([]);
  });

  it('keeps every fixed local delegate present on disk @contract', () => {
    expect(existsSync(path.join(projectRoot, 'scripts/db/safe-run.ts'))).toBe(true);
    expect(existsSync(path.join(projectRoot, 'scripts/db/check-drift.ts'))).toBe(true);
  });

  it.each(['README.md', 'docs/environments.md'])(
    'documents only guarded remote workflows in %s',
    (relativePath) => {
      const whenDocumentationIsRead = readFileSync(path.join(projectRoot, relativePath), 'utf8');

      expect(whenDocumentationIsRead).toContain('DB_TARGET_ENV=staging|production');
      expect(whenDocumentationIsRead).toContain('pnpm db:status');
      expect(whenDocumentationIsRead).toContain('pnpm db:migrate');
      expect(whenDocumentationIsRead).toContain('--dry-run');
      expect(whenDocumentationIsRead).not.toMatch(/pnpm db:(reset|seed-only|full-reset|wipe)/);
    },
  );

  it('documents the linked staging-first drift workflow without obsolete inputs @contract', () => {
    const whenSecurityGuidanceIsRead = readFileSync(
      path.join(projectRoot, 'docs/security.md'),
      'utf8',
    );

    expect(whenSecurityGuidanceIsRead).toContain('DB_TARGET_ENV=staging pnpm db:check-drift');
    expect(whenSecurityGuidanceIsRead).toContain('supabase db diff --linked --schema public');
    expect(whenSecurityGuidanceIsRead).not.toContain('DRIFT_CHECK_DB_URL');
    expect(whenSecurityGuidanceIsRead).not.toContain('supabase/schema.sql');
    expect(whenSecurityGuidanceIsRead).not.toContain('supabase db dump');
  });
});

describe('remote schema drift checker', () => {
  it('passes when the linked public schema matches local migrations @contract', () => {
    const whenSchemasMatch = runDriftCli();

    expect(whenSchemasMatch.status).toBe(0);
    expect(whenSchemasMatch.calls).toEqual(['supabase db diff --linked --schema public']);
  });

  it('fails and emits the SQL when drift exists @contract', () => {
    const driftSql = 'alter table public.bookings add column drifted boolean;';

    const whenDriftExists = runDriftCli({ SAFE_RUN_TEST_DRIFT_OUTPUT: driftSql });

    expect(whenDriftExists.status).toBe(1);
    expect(whenDriftExists.output).toContain(driftSql);
  });

  it('propagates the exact Supabase CLI failure @contract', () => {
    const whenSupabaseFails = runDriftCli({ SAFE_RUN_TEST_COMMAND_EXIT: '19' });

    expect(whenSupabaseFails.status).toBe(19);
  });
});
