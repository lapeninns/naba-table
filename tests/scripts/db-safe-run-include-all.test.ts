import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function runCli(args: readonly string[], overrides: Readonly<Record<string, string>>): CliResult {
  const directory = mkdtempSync(path.join(tmpdir(), 'nabatable-db-include-all-'));
  const binDirectory = path.join(directory, 'bin');
  const logPath = path.join(directory, 'calls.log');
  temporaryDirectories.push(directory);
  mkdirSync(binDirectory);
  writeFileSync(logPath, '');

  for (const command of ['pnpm', 'supabase']) {
    const executablePath = path.join(binDirectory, command);
    writeFileSync(
      executablePath,
      `#!/bin/sh\nprintf "${command} %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"\nexit 0\n`,
    );
    chmodSync(executablePath, 0o755);
  }

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

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('remote database safe runner historical replay', () => {
  it.each(['migrate', 'push'])(
    'delegates include-all only after validation for staging migration alias %s @contract',
    (workflow) => {
      // Given: an explicitly targeted staging migration with historical replay approved.
      const environment = { DB_TARGET_ENV: 'staging' };

      // When: the operator invokes the governed include-all path.
      const whenReplayRuns = runCli([workflow, '--include-all'], environment);

      // Then: validation precedes the exact Supabase historical replay command.
      expect(whenReplayRuns.status).toBe(0);
      expect(whenReplayRuns.calls).toEqual(['pnpm validate:env', 'supabase db push --include-all']);
    },
  );

  it('renders include-all in a side-effect-free staging dry-run @contract', () => {
    // Given: an approved staging replay request that is still dry-run only.
    const environment = { DB_TARGET_ENV: 'staging' };

    // When: the operator requests the governed plan.
    const whenDryRunRuns = runCli(['migrate', '--include-all', '--dry-run'], environment);

    // Then: the exact delegated command is visible and no child process runs.
    expect(whenDryRunRuns.status).toBe(0);
    expect(whenDryRunRuns.output).toContain('supabase db push --include-all');
    expect(whenDryRunRuns.calls).toEqual([]);
  });

  it('refuses production include-all without the exact historical migration confirmation @contract', () => {
    // Given: a production target with only the ordinary confirmation flag present.
    const environment = { CONFIRM_PRODUCTION: 'true', DB_TARGET_ENV: 'production' };

    // When: historical replay is requested.
    const whenProductionReplayRuns = runCli(['migrate', '--include-all'], environment);

    // Then: the runner stops before validation or Supabase execution.
    expect(whenProductionReplayRuns.status).toBe(2);
    expect(whenProductionReplayRuns.output).toContain(
      'CONFIRM_PRODUCTION_INCLUDE_ALL=20260811160000 is required',
    );
    expect(whenProductionReplayRuns.calls).toEqual([]);
  });

  it('delegates production include-all only with both exact confirmations @contract', () => {
    // Given: the reviewed missing historical migration and production apply are both confirmed.
    const environment = {
      CONFIRM_PRODUCTION: 'true',
      CONFIRM_PRODUCTION_INCLUDE_ALL: '20260811160000',
      DB_TARGET_ENV: 'production',
    };

    // When: the governed historical replay is requested.
    const whenProductionReplayRuns = runCli(['push', '--include-all'], environment);

    // Then: validation precedes the exact Supabase command.
    expect(whenProductionReplayRuns.status).toBe(0);
    expect(whenProductionReplayRuns.calls).toEqual([
      'pnpm validate:env',
      'supabase db push --include-all',
    ]);
  });

  it('keeps production include-all dry-runs side-effect free without confirmation @contract', () => {
    // Given: production is targeted without mutation confirmations.
    const environment = { DB_TARGET_ENV: 'production' };

    // When: the operator renders the historical replay plan.
    const whenDryRunRuns = runCli(['push', '--include-all', '--dry-run'], environment);

    // Then: the command is visible but no child process executes.
    expect(whenDryRunRuns.status).toBe(0);
    expect(whenDryRunRuns.output).toContain('supabase db push --include-all');
    expect(whenDryRunRuns.calls).toEqual([]);
  });

  it('refuses include-all for a read-only workflow @contract', () => {
    // Given: a valid staging target using a read-only workflow.
    const environment = { DB_TARGET_ENV: 'staging' };

    // When: historical replay is attached to that workflow.
    const whenReadReplayRuns = runCli(['status', '--include-all'], environment);

    // Then: the runner stops at the argument boundary.
    expect(whenReadReplayRuns.status).toBe(2);
    expect(whenReadReplayRuns.output).toContain('--include-all requires migrate or push');
    expect(whenReadReplayRuns.calls).toEqual([]);
  });

  it('validates then delegates the two fixed staging legacy preparation steps @contract', () => {
    // Given: staging is explicitly targeted for the approved legacy drink-menu preparation.
    const environment = { DB_TARGET_ENV: 'staging' };

    // When: the governed preparation workflow runs.
    const whenPreparationRuns = runCli(['prepare-staging-legacy-drink-menu'], environment);

    // Then: validation precedes the canonical backfill and archive/retirement transaction.
    expect(whenPreparationRuns.status).toBe(0);
    expect(whenPreparationRuns.calls).toEqual([
      'pnpm validate:env',
      'supabase db query --linked --file supabase/migrations/20260507223000_backfill_canonical_menu_hierarchy.sql',
      'supabase db query --linked --file scripts/db/prepare-staging-legacy-drink-menu.sql',
    ]);
  });

  it('refuses legacy preparation for production before children even when confirmed @contract', () => {
    // Given: production is targeted with the ordinary mutation confirmation present.
    const environment = { CONFIRM_PRODUCTION: 'true', DB_TARGET_ENV: 'production' };

    // When: the staging-only preparation workflow is requested.
    const whenProductionPreparationRuns = runCli(
      ['prepare-staging-legacy-drink-menu'],
      environment,
    );

    // Then: no validation or database child is allowed to execute.
    expect(whenProductionPreparationRuns.status).toBe(2);
    expect(whenProductionPreparationRuns.output).toContain(
      'Legacy drink-menu preparation is staging-only',
    );
    expect(whenProductionPreparationRuns.calls).toEqual([]);
  });

  it('renders both legacy preparation steps without side effects in dry-run mode @contract', () => {
    // Given: an approved staging preparation request that is still dry-run only.
    const environment = { DB_TARGET_ENV: 'staging' };

    // When: the operator requests the governed plan.
    const whenDryRunRuns = runCli(['prepare-staging-legacy-drink-menu', '--dry-run'], environment);

    // Then: both fixed commands are visible and no child process runs.
    expect(whenDryRunRuns.status).toBe(0);
    expect(whenDryRunRuns.output).toContain(
      'supabase db query --linked --file supabase/migrations/20260507223000_backfill_canonical_menu_hierarchy.sql',
    );
    expect(whenDryRunRuns.output).toContain(
      'supabase db query --linked --file scripts/db/prepare-staging-legacy-drink-menu.sql',
    );
    expect(whenDryRunRuns.calls).toEqual([]);
  });

  it('validates then delegates runtime-parametrized test-phone cleanup for staging @contract', () => {
    const environment = {
      DB_TARGET_ENV: 'staging',
      TEST_PHONE_E164: '+447700900999',
    };

    const whenCleanupRuns = runCli(['remove-staging-test-phone'], environment);

    expect(whenCleanupRuns.status).toBe(0);
    expect(whenCleanupRuns.calls).toEqual([
      'pnpm validate:env',
      'pnpm exec tsx scripts/db/remove-staging-test-phone.ts',
    ]);
  });

  it('refuses test-phone cleanup for production before any child runs @contract', () => {
    const environment = {
      CONFIRM_PRODUCTION: 'true',
      DB_TARGET_ENV: 'production',
      TEST_PHONE_E164: '+447700900999',
    };

    const whenCleanupRuns = runCli(['remove-staging-test-phone'], environment);

    expect(whenCleanupRuns.status).toBe(2);
    expect(whenCleanupRuns.output).toContain('Legacy test-phone cleanup is staging-only');
    expect(whenCleanupRuns.calls).toEqual([]);
  });

  it('refuses test-phone cleanup without a runtime E.164 target @contract', () => {
    const environment = { DB_TARGET_ENV: 'staging' };

    const whenCleanupRuns = runCli(['remove-staging-test-phone'], environment);

    expect(whenCleanupRuns.status).toBe(2);
    expect(whenCleanupRuns.output).toContain('TEST_PHONE_E164 must be valid E.164');
    expect(whenCleanupRuns.calls).toEqual([]);
  });

  it('targets an explicitly linked absolute Supabase workdir for production migration @contract', () => {
    const environment = {
      CONFIRM_PRODUCTION: 'true',
      DB_TARGET_ENV: 'production',
      SUPABASE_WORKDIR: '/tmp/nabatable-production',
    };

    const whenMigrationRuns = runCli(['migrate'], environment);

    expect(whenMigrationRuns.status).toBe(0);
    expect(whenMigrationRuns.calls).toEqual([
      'pnpm validate:env',
      'supabase db push --workdir /tmp/nabatable-production',
    ]);
  });

  it('refuses a relative Supabase workdir before any child runs @contract', () => {
    const environment = {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: '../different-project',
    };

    const whenMigrationRuns = runCli(['migrate'], environment);

    expect(whenMigrationRuns.status).toBe(2);
    expect(whenMigrationRuns.output).toContain('SUPABASE_WORKDIR must be an absolute path');
    expect(whenMigrationRuns.calls).toEqual([]);
  });
});
