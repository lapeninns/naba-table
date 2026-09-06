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
import { parse as parseYaml } from 'yaml';

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
    [
      '#!/bin/sh',
      'printf "pnpm %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"',
      'if [ -n "$SAFE_RUN_TEST_ENV_LOG" ]; then',
      '  printf "SUPABASE_DB_URL=%s\\nSUPABASE_SERVICE_ROLE_KEY=%s\\nDB_BACKUP_ROLE_URL=%s\\nDB_ISOLATED_WORKDIR=%s\\nDB_DRIFT_SCOPE=%s\\n" "${SUPABASE_DB_URL:-<unset>}" "${SUPABASE_SERVICE_ROLE_KEY:-<unset>}" "${DB_BACKUP_ROLE_URL:-<unset>}" "${DB_ISOLATED_WORKDIR:-<unset>}" "${DB_DRIFT_SCOPE:-<unset>}" >> "$SAFE_RUN_TEST_ENV_LOG"',
      'fi',
      'exit "${SAFE_RUN_TEST_COMMAND_EXIT:-0}"',
      '',
    ].join('\n'),
  );
  writeExecutable(
    path.join(binDirectory, 'supabase'),
    [
      '#!/bin/sh',
      'printf "supabase %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"',
      'case "$*" in *"migration list"*) printf "%s" "$SAFE_RUN_TEST_LEDGER_OUTPUT" ;; esac',
      'exit "${SAFE_RUN_TEST_COMMAND_EXIT:-0}"',
      '',
    ].join('\n'),
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

const STAGING_REF = 'ndxmivcrehsacuerwxtm';
const PRODUCTION_REF = 'vrdiqfudmwydclqpydee';
const SCRATCH_REF = 'scratchrefabcdefghij';
const STAGING_DB_URL = `postgresql://postgres.${STAGING_REF}:deploy-secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`;
const PRODUCTION_DB_URL = `postgresql://postgres:deploy-secret@db.${PRODUCTION_REF}.supabase.co:5432/postgres`;
const BACKUP_URL = `postgresql://nabatable_backup:backup-secret@db.${STAGING_REF}.supabase.co:5432/postgres`;
const LEDGER_TABLE = [
  '',
  '        LOCAL      │     REMOTE     │     TIME (UTC)      ',
  '  ─────────────────┼────────────────┼─────────────────────',
  '    20260101000000 │ 20260101000000 │ 2026-01-01 00:00:00 ',
  '    20260102000000 │                │                     ',
  '',
].join('\n');

/** A private Supabase workdir with two migrations linked to the given project ref. */
function createLinkedWorkdir(projectRef: string): {
  readonly root: string;
  readonly baselinePath: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), 'nabatable-db-workdir-'));
  temporaryDirectories.push(root);
  mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });
  mkdirSync(path.join(root, 'supabase', '.temp'), { recursive: true });
  writeFileSync(path.join(root, 'supabase', '.temp', 'project-ref'), `${projectRef}\n`);
  writeFileSync(
    path.join(root, 'supabase', 'migrations', '20260101000000_first.sql'),
    'select 1;\n',
  );
  writeFileSync(
    path.join(root, 'supabase', 'migrations', '20260102000000_second.sql'),
    'select 2;\n',
  );
  return { root, baselinePath: path.join(root, 'migration-checksums.json') };
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
  it.each([['--help'], ['help'], ['-h']])(
    'prints side-effect-free operator guidance when help is requested via %s @contract',
    (helpArgument) => {
      const whenHelpRuns = runCli([helpArgument]);

      expect(whenHelpRuns.status).toBe(0);
      expect(whenHelpRuns.output).toContain('DB_TARGET_ENV=staging|production');
      expect(whenHelpRuns.output).toContain('CONFIRM_PRODUCTION=true');
      expect(whenHelpRuns.output).not.toContain('Unsupported database workflow');
      expect(whenHelpRuns.calls).toEqual([]);
    },
  );

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
    ['status', 'supabase migration list --workdir <workdir>'],
    ['pull', 'supabase db pull --workdir <workdir>'],
    ['check-drift', 'pnpm exec tsx scripts/db/check-drift.ts'],
  ])(
    'guards the environment in-process before delegated read workflow %s',
    (workflow, delegatedCall) => {
      const { root } = createLinkedWorkdir(PRODUCTION_REF);

      const whenReadWorkflowRuns = runCli([workflow], {
        DB_TARGET_ENV: 'production',
        SUPABASE_WORKDIR: root,
      });

      expect(whenReadWorkflowRuns.status).toBe(0);
      expect(whenReadWorkflowRuns.calls).toEqual([delegatedCall.replace('<workdir>', root)]);
    },
  );

  it.each(['migrate', 'push'])(
    'guards the environment in-process before staging migration alias %s',
    (workflow) => {
      const { root } = createLinkedWorkdir(STAGING_REF);

      const whenMigrationRuns = runCli([workflow], {
        DB_TARGET_ENV: 'staging',
        SUPABASE_WORKDIR: root,
      });

      expect(whenMigrationRuns.status).toBe(0);
      expect(whenMigrationRuns.calls).toEqual([`supabase db push --workdir ${root}`]);
    },
  );

  it('allows a confirmed production migration @contract', () => {
    const { root } = createLinkedWorkdir(PRODUCTION_REF);

    const whenProductionIsConfirmed = runCli(['push'], {
      CONFIRM_PRODUCTION: 'true',
      DB_TARGET_ENV: 'production',
      SUPABASE_WORKDIR: root,
    });

    expect(whenProductionIsConfirmed.status).toBe(0);
    expect(whenProductionIsConfirmed.calls).toEqual([`supabase db push --workdir ${root}`]);
  });

  it('propagates the delegated workflow exit code @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenWorkflowFails = runCli(['status'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SAFE_RUN_TEST_COMMAND_EXIT: '23',
    });

    expect(whenWorkflowFails.status).toBe(23);
    expect(whenWorkflowFails.calls).toEqual([`supabase migration list --workdir ${root}`]);
  });
});

describe('DB-scoped environment guard', () => {
  it('never spawns pnpm validate:env and needs no web-app environment @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    // Only DB_TARGET_ENV plus the CLI credentials a hosted runner carries; no NEXT_PUBLIC_* keys.
    const whenHostedLikeEnvRuns = runCli(['status'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SUPABASE_ACCESS_TOKEN: 'sbp_test_access_token_not_real',
      SUPABASE_DB_PASSWORD: 'deploy-secret',
    });

    expect(whenHostedLikeEnvRuns.status).toBe(0);
    expect(whenHostedLikeEnvRuns.calls).toEqual([`supabase migration list --workdir ${root}`]);
    expect(whenHostedLikeEnvRuns.calls.some((call) => call.includes('validate:env'))).toBe(false);
    expect(whenHostedLikeEnvRuns.output).toContain(
      `validate: supabase/.temp/project-ref names ${STAGING_REF} (staging)`,
    );
    expect(whenHostedLikeEnvRuns.output).not.toContain('deploy-secret');
    expect(whenHostedLikeEnvRuns.output).not.toContain('sbp_test');
  });

  it('describes the guard instead of pnpm validate:env in dry-run output @contract', () => {
    const whenDryRunRuns = runCli(['migrate', '--dry-run'], { DB_TARGET_ENV: 'staging' });

    expect(whenDryRunRuns.status).toBe(0);
    expect(whenDryRunRuns.output).toContain('validate: db-scoped environment guard');
    expect(whenDryRunRuns.output).toContain('supabase/.temp/project-ref names the target');
    expect(whenDryRunRuns.output).not.toContain('validate: pnpm validate:env');
    expect(whenDryRunRuns.calls).toEqual([]);
  });

  it.each([
    ['SUPABASE_ACCESS_TOKEN', 'REPLACE_ME_SUPABASE_ACCESS_TOKEN'],
    ['SUPABASE_DB_PASSWORD', '<staging-db-password>'],
    ['SUPABASE_DB_URL', 'REPLACE_ME_STAGING_DB_URL'],
  ])('refuses the unconfigured placeholder %s before any child @contract', (key, value) => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenPlaceholderIsPresent = runCli(['status'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      [key]: value,
    });

    expect(whenPlaceholderIsPresent.status).toBe(2);
    expect(whenPlaceholderIsPresent.output).toContain(`${key} is an unconfigured placeholder`);
    expect(whenPlaceholderIsPresent.calls).toEqual([]);
  });

  it.each([
    ['SUPABASE_DB_URL', PRODUCTION_DB_URL],
    ['DATABASE_URL', PRODUCTION_DB_URL],
    ['SUPABASE_URL', `https://${PRODUCTION_REF}.supabase.co`],
    ['NEXT_PUBLIC_SUPABASE_URL', `https://${PRODUCTION_REF}.supabase.co`],
  ])('refuses %s bound to another project than the target @contract', (key, value) => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenUrlIsWrong = runCli(['status'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      [key]: value,
    });

    expect(whenUrlIsWrong.status).toBe(2);
    expect(whenUrlIsWrong.output).toContain(`${key} does not address staging (${STAGING_REF})`);
    expect(whenUrlIsWrong.output).not.toContain('deploy-secret');
    expect(whenUrlIsWrong.calls).toEqual([]);
  });

  it.each(['status', 'migrate', 'pull', 'check-drift'])(
    'refuses %s against production when the linked project is staging @contract',
    (workflow) => {
      const { root } = createLinkedWorkdir(STAGING_REF);

      const whenLinkIsWrong = runCli([workflow], {
        CONFIRM_PRODUCTION: 'true',
        DB_TARGET_ENV: 'production',
        SUPABASE_WORKDIR: root,
      });

      expect(whenLinkIsWrong.status).toBe(2);
      expect(whenLinkIsWrong.output).toContain(
        `Linked Supabase project ref does not match production: expected ${PRODUCTION_REF}, linked ${STAGING_REF}`,
      );
      expect(whenLinkIsWrong.calls).toEqual([]);
    },
  );

  it('refuses a linked-project workflow when no project is linked @contract', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'nabatable-db-unlinked-'));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });

    const whenUnlinked = runCli(['status'], { DB_TARGET_ENV: 'staging', SUPABASE_WORKDIR: root });

    expect(whenUnlinked.status).toBe(2);
    expect(whenUnlinked.output).toContain('No linked Supabase project');
    expect(whenUnlinked.calls).toEqual([]);
  });

  it('allows read-only production work without APP_ENV and without ALLOW_PROD_DB_WIPE @contract', () => {
    const { root } = createLinkedWorkdir(PRODUCTION_REF);

    const whenReadOnlyProductionRuns = runCli(['status'], {
      APP_ENV: 'development',
      DB_TARGET_ENV: 'production',
      SUPABASE_WORKDIR: root,
    });

    expect(whenReadOnlyProductionRuns.status).toBe(0);
    expect(whenReadOnlyProductionRuns.output).toContain(
      'production writes require CONFIRM_PRODUCTION=true',
    );
    expect(whenReadOnlyProductionRuns.calls).toEqual([`supabase migration list --workdir ${root}`]);
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
      'prettier --check scripts/db/safe-run.ts scripts/db/check-drift.ts tests/scripts/db-safe-run.test.ts package.json README.md docs/environments.md docs/security.md',
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

describe('database promotion safety workflows', () => {
  it('renders the remote plan with target guards and the isolated workdir without children @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenPlanIsRendered = runCli(['plan-remote', '--dry-run'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SUPABASE_DB_URL: STAGING_DB_URL,
      SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    });

    expect(whenPlanIsRendered.status).toBe(0);
    expect(whenPlanIsRendered.output).toContain('target=staging access=remote-plan');
    expect(whenPlanIsRendered.output).toContain(
      `guard: linked project ref ${STAGING_REF} matches staging`,
    );
    expect(whenPlanIsRendered.output).toContain(
      `guard: database connection targets ${STAGING_REF} as role postgres`,
    );
    expect(whenPlanIsRendered.output).toContain(
      'workflow: bash scripts/supabase/check_migration_versions_unique.sh',
    );
    expect(whenPlanIsRendered.output).toContain(
      'workflow: supabase migration list --linked --workdir <isolated-workdir>',
    );
    expect(whenPlanIsRendered.output).toContain(
      'workflow: supabase db push --dry-run --linked --workdir <isolated-workdir>',
    );
    expect(whenPlanIsRendered.output).not.toContain('deploy-secret');
    expect(whenPlanIsRendered.calls).toEqual([]);
  });

  it('refuses a remote plan when the linked project is not the named target @contract', () => {
    const { root } = createLinkedWorkdir(PRODUCTION_REF);

    const whenLinkIsWrong = runCli(['plan-remote'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
    });

    expect(whenLinkIsWrong.status).toBe(2);
    expect(whenLinkIsWrong.output).toContain(
      `Linked Supabase project ref does not match staging: expected ${STAGING_REF}, linked ${PRODUCTION_REF}`,
    );
    expect(whenLinkIsWrong.calls).toEqual([]);
  });

  it.each([
    ['host', PRODUCTION_DB_URL, 'Database connection does not match staging'],
    [
      'pooler user',
      `postgresql://postgres.${PRODUCTION_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
      'Database connection does not match staging',
    ],
    [
      'non-Supabase host',
      `postgresql://postgres.${STAGING_REF}:pw@attacker.example:5432/postgres`,
      'Unable to determine Supabase project ref',
    ],
  ])(
    'refuses a remote plan whose database %s does not match the target @contract',
    (_, url, message) => {
      const { root } = createLinkedWorkdir(STAGING_REF);

      const whenConnectionIsWrong = runCli(['plan-remote'], {
        DB_TARGET_ENV: 'staging',
        SUPABASE_WORKDIR: root,
        SUPABASE_DB_URL: url,
      });

      expect(whenConnectionIsWrong.status).toBe(2);
      expect(whenConnectionIsWrong.output).toContain(message);
      expect(whenConnectionIsWrong.output).not.toContain('pw@');
      expect(whenConnectionIsWrong.calls).toEqual([]);
    },
  );

  it('refuses an API URL that names a different project @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenApiIsWrong = runCli(['plan-remote'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
    });

    expect(whenApiIsWrong.status).toBe(2);
    expect(whenApiIsWrong.output).toContain('Supabase API URL does not match staging');
    expect(whenApiIsWrong.calls).toEqual([]);
  });

  it.each([
    [['plan-remote', 'repair'], 'Refused argument "repair"'],
    [['status', 'reset'], 'Refused argument "reset"'],
    [['push', '--db-url=postgresql://x:y@z/db'], 'Refused argument "--db-url"'],
    [['migrate', '--version', '20260101000000'], 'Refused argument "--version"'],
    [['plan-remote', '--include-all'], '--include-all requires migrate or push'],
  ])('refuses %j before validation or any child @contract', (args, message) => {
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenRefused = runCli(args, { DB_TARGET_ENV: 'staging', SUPABASE_WORKDIR: root });

    expect(whenRefused.status).toBe(2);
    expect(whenRefused.output).toContain(message);
    expect(whenRefused.calls).toEqual([]);
  });

  it('records a reviewed checksum baseline, then fails when a recorded migration changes @contract', () => {
    const { root, baselinePath } = createLinkedWorkdir(STAGING_REF);
    const environment = { SUPABASE_WORKDIR: root, DB_MIGRATION_CHECKSUMS_PATH: baselinePath };

    const whenBaselineIsMissing = runCli(['check-migration-immutability'], environment);
    expect(whenBaselineIsMissing.status).toBe(1);
    expect(whenBaselineIsMissing.output).toContain('Migration checksum baseline missing');

    const whenRecordLacksReview = runCli(['check-migration-immutability', '--record'], environment);
    expect(whenRecordLacksReview.status).toBe(2);
    expect(whenRecordLacksReview.output).toContain(
      '--record and --reviewed must be given together',
    );

    const whenRecorded = runCli(
      ['check-migration-immutability', '--record', '--reviewed'],
      environment,
    );
    expect(whenRecorded.status).toBe(0);
    expect(whenRecorded.output).toContain('recorded 2 reviewed migration file(s)');
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
      files: Record<string, { reviewed: boolean }>;
    };
    expect(Object.keys(baseline.files)).toEqual([
      '20260101000000_first.sql',
      '20260102000000_second.sql',
    ]);

    writeFileSync(
      path.join(root, 'supabase', 'migrations', '20260103000000_third.sql'),
      'select 3;\n',
    );
    const whenNewFileAppears = runCli(['check-migration-immutability'], environment);
    expect(whenNewFileAppears.status).toBe(0);
    expect(whenNewFileAppears.output).toContain('unrecorded migration 20260103000000_third.sql');
    expect(whenNewFileAppears.output).toContain('unrecorded files are allowed');

    writeFileSync(
      path.join(root, 'supabase', 'migrations', '20260101000000_first.sql'),
      'select 1; -- edited after apply\n',
    );
    const whenAppliedFileChanges = runCli(['check-migration-immutability'], environment);
    expect(whenAppliedFileChanges.status).toBe(1);
    expect(whenAppliedFileChanges.output).toContain(
      'CHANGED recorded migration 20260101000000_first.sql',
    );
    expect(whenAppliedFileChanges.output).toContain('applied migrations are immutable');
    expect(whenAppliedFileChanges.calls).toEqual([]);

    const whenRecordingChanged = runCli(
      ['check-migration-immutability', '--record', '--reviewed'],
      environment,
    );
    expect(whenRecordingChanged.status).toBe(1);
    expect(
      Object.keys((JSON.parse(readFileSync(baselinePath, 'utf8')) as typeof baseline).files),
    ).toEqual(['20260101000000_first.sql', '20260102000000_second.sql']);
  });

  it('runs the real remote dry-run inside an isolated workdir after ledger reconciliation @contract', () => {
    const { root, baselinePath } = createLinkedWorkdir(STAGING_REF);
    const environment = {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      DB_MIGRATION_CHECKSUMS_PATH: baselinePath,
    };
    expect(
      runCli(['check-migration-immutability', '--record', '--reviewed'], environment).status,
    ).toBe(0);

    const whenPlanRuns = runCli(['plan-remote'], {
      ...environment,
      SAFE_RUN_TEST_LEDGER_OUTPUT: LEDGER_TABLE,
    });

    expect(whenPlanRuns.status).toBe(0);
    expect(whenPlanRuns.output).toContain('immutability: verified=2');
    expect(whenPlanRuns.output).toContain('ledger: applied=1 pending=1 remote-only=0');
    expect(whenPlanRuns.calls).toHaveLength(2);
    expect(whenPlanRuns.calls.some((call) => call.includes('validate:env'))).toBe(false);
    const isolated = whenPlanRuns.calls[0].match(
      /^supabase migration list --linked --workdir (\S+nabatable-db-run-\S+)$/,
    );
    expect(isolated).not.toBeNull();
    const isolatedWorkdir = isolated?.[1] ?? '';
    expect(isolatedWorkdir.startsWith(root)).toBe(false);
    expect(whenPlanRuns.calls[1]).toBe(
      `supabase db push --dry-run --linked --workdir ${isolatedWorkdir}`,
    );
    expect(whenPlanRuns.output).toContain(`isolate: ${isolatedWorkdir}`);
    expect(existsSync(isolatedWorkdir)).toBe(false);
  });

  it('stops the remote plan when the remote ledger holds versions with no local file @contract', () => {
    const { root, baselinePath } = createLinkedWorkdir(STAGING_REF);
    const environment = {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      DB_MIGRATION_CHECKSUMS_PATH: baselinePath,
    };
    expect(
      runCli(['check-migration-immutability', '--record', '--reviewed'], environment).status,
    ).toBe(0);

    const whenLedgerHasRemoteOnly = runCli(['plan-remote'], {
      ...environment,
      SAFE_RUN_TEST_LEDGER_OUTPUT: `${LEDGER_TABLE}                   │ 20260104000000 │ 2026-01-04 00:00:00 \n`,
    });

    expect(whenLedgerHasRemoteOnly.status).toBe(1);
    expect(whenLedgerHasRemoteOnly.output).toContain('migration repair is refused');
    expect(whenLedgerHasRemoteOnly.calls).toHaveLength(1);
    expect(whenLedgerHasRemoteOnly.calls.some((call) => call.includes('db push'))).toBe(false);
  });

  it('stops the remote plan when a recorded migration changed @contract', () => {
    const { root, baselinePath } = createLinkedWorkdir(STAGING_REF);
    const environment = {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      DB_MIGRATION_CHECKSUMS_PATH: baselinePath,
    };
    expect(
      runCli(['check-migration-immutability', '--record', '--reviewed'], environment).status,
    ).toBe(0);
    writeFileSync(
      path.join(root, 'supabase', 'migrations', '20260101000000_first.sql'),
      'select 9;\n',
    );

    const whenPlanRuns = runCli(['plan-remote'], {
      ...environment,
      SAFE_RUN_TEST_LEDGER_OUTPUT: LEDGER_TABLE,
    });

    expect(whenPlanRuns.status).toBe(1);
    expect(whenPlanRuns.output).toContain('CHANGED recorded migration 20260101000000_first.sql');
    expect(whenPlanRuns.calls).toEqual([]);
  });

  it('refuses SQL regression against production and without a validated staging connection @contract', () => {
    const { root } = createLinkedWorkdir(PRODUCTION_REF);

    const whenProductionIsTargeted = runCli(['sql-regression'], {
      DB_TARGET_ENV: 'production',
      CONFIRM_PRODUCTION: 'true',
      SUPABASE_WORKDIR: root,
      SUPABASE_DB_URL: PRODUCTION_DB_URL,
    });
    expect(whenProductionIsTargeted.status).toBe(2);
    expect(whenProductionIsTargeted.output).toContain('SQL regression is staging-only');
    expect(whenProductionIsTargeted.calls).toEqual([]);

    const staging = createLinkedWorkdir(STAGING_REF);
    const whenConnectionIsMissing = runCli(['sql-regression'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: staging.root,
    });
    expect(whenConnectionIsMissing.status).toBe(2);
    expect(whenConnectionIsMissing.output).toContain(
      'SUPABASE_DB_URL (or DATABASE_URL) for staging is required',
    );
    expect(whenConnectionIsMissing.calls).toEqual([]);
  });

  it('renders and delegates the staging SQL regression pack with fixtures inside the isolated workdir @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);
    const environment = {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SUPABASE_DB_URL: STAGING_DB_URL,
    };
    const delegate =
      'pnpm exec tsx scripts/db/migrations/sql-regression.ts --fixtures tests/db/fixtures/synthetic-fixtures.sql tests/db/terminal-booking-table-release.sql tests/db/manual-table-unassignment.sql tests/db/atomic-table-hold-enforcement.sql supabase/tests/mobile_sms_attempt_finalization.sql supabase/tests/whatsapp_review_notification_ledger.sql';

    const whenRendered = runCli(['sql-regression', '--dry-run'], environment);
    expect(whenRendered.status).toBe(0);
    expect(whenRendered.output).toContain('target=staging access=staging-regression');
    expect(whenRendered.output).toContain(`workflow: ${delegate}`);
    expect(whenRendered.output).not.toContain('deploy-secret');
    expect(whenRendered.calls).toEqual([]);

    const envLog = path.join(root, 'env.log');
    const whenDelegated = runCli(['sql-regression'], {
      ...environment,
      SAFE_RUN_TEST_ENV_LOG: envLog,
    });
    expect(whenDelegated.status).toBe(0);
    expect(whenDelegated.calls).toEqual([delegate]);
    const delegateEnv = readFileSync(envLog, 'utf8');
    expect(delegateEnv).toMatch(/DB_ISOLATED_WORKDIR=\S+nabatable-db-run-/);
  });

  it('propagates the isolated workdir and extended scope to the drift checker @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);
    const envLog = path.join(root, 'env.log');

    const whenDriftRuns = runCli(['check-drift'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SAFE_RUN_TEST_ENV_LOG: envLog,
    });

    expect(whenDriftRuns.status).toBe(0);
    expect(whenDriftRuns.calls).toEqual(['pnpm exec tsx scripts/db/check-drift.ts']);
    const delegateEnv = readFileSync(envLog, 'utf8');
    expect(delegateEnv).toMatch(/DB_ISOLATED_WORKDIR=\S+nabatable-db-run-/);
    expect(delegateEnv).toContain('DB_DRIFT_SCOPE=extended');
    const isolated = delegateEnv.match(/DB_ISOLATED_WORKDIR=(\S+)/)?.[1] ?? '';
    expect(existsSync(isolated)).toBe(false);
  });

  it.each([
    [{}, 'DB_BACKUP_ROLE_URL (dedicated read-only backup identity) is required'],
    [
      { DB_BACKUP_ROLE_URL: `postgresql://service_role:pw@db.${STAGING_REF}.supabase.co/postgres` },
      'uses the service_role role',
    ],
    [
      {
        DB_BACKUP_ROLE_URL: `postgresql://postgres.${STAGING_REF}:pw@aws-0.pooler.supabase.com/postgres`,
      },
      'uses the postgres role',
    ],
    [
      { DB_BACKUP_ROLE_URL: STAGING_DB_URL, SUPABASE_DB_URL: STAGING_DB_URL },
      'uses the postgres role',
    ],
    [
      {
        DB_BACKUP_ROLE_URL: BACKUP_URL,
        SUPABASE_DB_URL: `postgresql://postgres:backup-secret@db.${STAGING_REF}.supabase.co/postgres`,
      },
      'must not share credentials with the deploy connection',
    ],
    [
      { DB_BACKUP_ROLE_URL: BACKUP_URL.replace(STAGING_REF, PRODUCTION_REF) },
      `targets project ${PRODUCTION_REF} but staging is ${STAGING_REF}`,
    ],
    [
      { DB_BACKUP_ROLE_URL: BACKUP_URL },
      'DB_BACKUP_BUCKET (object storage bucket for encrypted backups) is required',
    ],
  ])('refuses backup identity %j before any child @contract', (overrides, message) => {
    const whenBackupIsRefused = runCli(['backup'], { DB_TARGET_ENV: 'staging', ...overrides });

    expect(whenBackupIsRefused.status).toBe(2);
    expect(whenBackupIsRefused.output).toContain(message);
    expect(whenBackupIsRefused.output).not.toContain('backup-secret');
    expect(whenBackupIsRefused.output).not.toContain('deploy-secret');
    expect(whenBackupIsRefused.calls).toEqual([]);
  });

  it('delegates backup only under the dedicated identity with deploy credentials scrubbed @contract', () => {
    const { root } = createLinkedWorkdir(STAGING_REF);
    const envLog = path.join(root, 'env.log');
    const environment = {
      DB_TARGET_ENV: 'staging',
      DB_BACKUP_ROLE_URL: BACKUP_URL,
      DB_BACKUP_BUCKET: 'nabatable-backups-test',
      SUPABASE_DB_URL: STAGING_DB_URL,
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    };
    const delegate =
      'pnpm exec tsx scripts/db/backup/run.ts --target staging --identity-env DB_BACKUP_ROLE_URL --bucket nabatable-backups-test';

    const whenRendered = runCli(['backup', '--dry-run'], environment);
    expect(whenRendered.status).toBe(0);
    expect(whenRendered.output).toContain('target=staging access=backup');
    expect(whenRendered.output).toContain(
      `guard: DB_BACKUP_ROLE_URL uses dedicated backup role nabatable_backup on ${STAGING_REF} (staging)`,
    );
    expect(whenRendered.output).toContain(`workflow: ${delegate}`);
    expect(whenRendered.output).not.toContain('backup-secret');
    expect(whenRendered.calls).toEqual([]);

    const whenDelegated = runCli(['backup'], { ...environment, SAFE_RUN_TEST_ENV_LOG: envLog });
    expect(whenDelegated.status).toBe(0);
    expect(whenDelegated.calls).toEqual([delegate]);
    const delegateEnv = readFileSync(envLog, 'utf8').split('\n');
    expect(delegateEnv).toContain('SUPABASE_DB_URL=<unset>');
    expect(delegateEnv).toContain('SUPABASE_SERVICE_ROLE_KEY=<unset>');
    expect(delegateEnv).toContain(`DB_BACKUP_ROLE_URL=${BACKUP_URL}`);
  });

  it.each([
    [
      { RESTORE_VERIFY_PROJECT_REF: PRODUCTION_REF },
      `names the production project (${PRODUCTION_REF})`,
    ],
    [{ RESTORE_VERIFY_PROJECT_REF: STAGING_REF }, `names the staging project (${STAGING_REF})`],
    [{ RESTORE_VERIFY_PROJECT_REF: 'not-a-ref' }, 'must be a 20-character Supabase project ref'],
    [{}, 'RESTORE_VERIFY_PROJECT_REF is required'],
    [
      { RESTORE_VERIFY_PROJECT_REF: SCRATCH_REF },
      'RESTORE_VERIFY_BACKUP_ID (backup identifier to restore) is required',
    ],
    [
      {
        RESTORE_VERIFY_PROJECT_REF: SCRATCH_REF,
        RESTORE_VERIFY_BACKUP_ID: 'prod-20260904',
        RESTORE_VERIFY_DB_URL: `postgresql://postgres:pw@db.${PRODUCTION_REF}.supabase.co/postgres`,
      },
      `RESTORE_VERIFY_DB_URL does not address ${SCRATCH_REF}`,
    ],
  ])('refuses restore verification %j before any child @contract', (overrides, message) => {
    const whenRestoreIsRefused = runCli(['restore-verify'], {
      DB_TARGET_ENV: 'production',
      ...overrides,
    });

    expect(whenRestoreIsRefused.status).toBe(2);
    expect(whenRestoreIsRefused.output).toContain(message);
    expect(whenRestoreIsRefused.calls).toEqual([]);
  });

  it('delegates restore verification for a scratch project only @contract', () => {
    const environment = {
      DB_TARGET_ENV: 'production',
      RESTORE_VERIFY_PROJECT_REF: SCRATCH_REF,
      RESTORE_VERIFY_BACKUP_ID: 'prod-20260904T0100Z',
      RESTORE_VERIFY_DB_URL: `postgresql://postgres:scratch-secret@db.${SCRATCH_REF}.supabase.co/postgres`,
    };
    const delegate = `pnpm exec tsx scripts/db/restore/verify.ts --backup-id prod-20260904T0100Z --project-ref ${SCRATCH_REF} --source production`;

    const whenRendered = runCli(['restore-verify', '--dry-run'], environment);
    expect(whenRendered.status).toBe(0);
    expect(whenRendered.output).toContain(
      `guard: RESTORE_VERIFY_PROJECT_REF=${SCRATCH_REF} is neither staging (${STAGING_REF}) nor production (${PRODUCTION_REF})`,
    );
    expect(whenRendered.output).toContain(`workflow: ${delegate}`);
    expect(whenRendered.output).not.toContain('scratch-secret');
    expect(whenRendered.calls).toEqual([]);

    const whenDelegated = runCli(['restore-verify'], environment);
    expect(whenDelegated.status).toBe(0);
    expect(whenDelegated.calls).toEqual([delegate]);
  });

  it('documents the promotion safety workflows and the reviewed census @contract', () => {
    const migrationsDoc = readFileSync(
      path.join(projectRoot, 'docs/DATABASE_MIGRATIONS.md'),
      'utf8',
    );
    const census = readFileSync(path.join(projectRoot, 'config/db/census.md'), 'utf8');

    for (const command of [
      'pnpm db:plan-remote',
      'pnpm db:sql-regression',
      'pnpm db:check-migration-immutability',
      'pnpm db:backup',
      'pnpm db:restore-verify',
    ]) {
      expect(migrationsDoc).toContain(command);
    }
    expect(migrationsDoc).toContain('Transactional rollback does not undo external messages');
    expect(census).toContain('NOT assumed');
    expect(census).toMatch(/Reviewed baseline date\s*\|\s*\d{4}-\d{2}-\d{2}/);
  });
});

type HostedWorkflowStep = {
  readonly name?: string;
  readonly run?: string;
  readonly env?: Readonly<Record<string, unknown>>;
};
type HostedWorkflowJob = {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly steps: readonly HostedWorkflowStep[];
};
type HostedWorkflowFile = { readonly jobs: Readonly<Record<string, HostedWorkflowJob>> };
type HostedDbStep = {
  readonly job: string;
  readonly workflow: string;
  readonly target: 'staging' | 'production';
  /** The exact key set the workflow step exports, with secrets/expressions replaced by fakes. */
  readonly env: Readonly<Record<string, string>>;
};

/** Obviously fake stand-ins for `${{ secrets.* }}` / `${{ vars.* }}` expressions, keyed by variable name. */
function fakeHostedValue(key: string, target: 'staging' | 'production'): string {
  const projectRef = target === 'staging' ? STAGING_REF : PRODUCTION_REF;
  switch (key) {
    case 'SUPABASE_ACCESS_TOKEN':
      return 'sbp_test_access_token_not_real';
    case 'SUPABASE_DB_PASSWORD':
      return 'deploy-secret';
    case 'SUPABASE_DB_URL':
      return target === 'staging' ? STAGING_DB_URL : PRODUCTION_DB_URL;
    case 'DB_BACKUP_ROLE_URL':
      return BACKUP_URL.replace(STAGING_REF, projectRef);
    case 'DB_BACKUP_BUCKET':
      return 'nabatable-backups-test';
    default:
      return `test-${key.toLowerCase()}`;
  }
}

/** Every `pnpm db:<workflow>` step in a hosted workflow with the env it would actually receive. */
function hostedDbSteps(relativePath: string): readonly HostedDbStep[] {
  const file = parseYaml(
    readFileSync(path.join(projectRoot, relativePath), 'utf8'),
  ) as HostedWorkflowFile;
  const steps: HostedDbStep[] = [];
  for (const [job, definition] of Object.entries(file.jobs)) {
    for (const step of definition.steps) {
      const workflow = step.run?.match(/pnpm db:([a-z-]+)/)?.[1];
      if (!workflow) {
        continue;
      }
      const raw: Record<string, unknown> = { ...(definition.env ?? {}), ...(step.env ?? {}) };
      const target = raw.DB_TARGET_ENV;
      if (target !== 'staging' && target !== 'production') {
        throw new Error(`${relativePath} job ${job} runs db:${workflow} without DB_TARGET_ENV`);
      }
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        const literal = String(value);
        env[key] = literal.includes('${{') ? fakeHostedValue(key, target) : literal;
      }
      steps.push({ job, workflow, target, env });
    }
  }
  return steps;
}

describe('hosted workflow environment contract', () => {
  const deploySteps = hostedDbSteps('.github/workflows/deploy.yml');
  const backupSteps = hostedDbSteps('.github/workflows/backup.yml');
  const hostedSteps = [...deploySteps, ...backupSteps];

  it('covers every db:* step declared by deploy.yml and backup.yml @contract', () => {
    const deployStepIds = deploySteps.map((step) => `${step.job}:${step.workflow}:${step.target}`);
    expect(deployStepIds).toEqual(
      expect.arrayContaining([
        'staging:plan-remote:staging',
        'staging:migrate:staging',
        'staging:sql-regression:staging',
        'production:migrate:production',
      ]),
    );
    expect(backupSteps.map((step) => `${step.job}:${step.workflow}:${step.target}`)).toEqual([
      'backup:backup:production',
    ]);
    // Every hosted db:* step must be a workflow the safe runner knows; help lists them all.
    const help = runCli(['--help']).output;
    for (const step of hostedSteps) {
      expect(help).toMatch(new RegExp(`(^|[\\s,])${step.workflow}(?=[\\s,]|$)`, 'm'));
      expect(Object.keys(step.env)).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(Object.keys(step.env)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(Object.keys(step.env)).not.toContain('ALLOW_PROD_DB_WIPE');
    }
  });

  it.each(hostedSteps.map((step) => [`${step.job}:${step.workflow}`, step] as const))(
    'runs %s with exactly the hosted step env once the checkout is linked to its target @contract',
    (_, step) => {
      const { root, baselinePath } = createLinkedWorkdir(
        step.target === 'staging' ? STAGING_REF : PRODUCTION_REF,
      );
      const scaffolding: Record<string, string> = { SUPABASE_WORKDIR: root };
      if (step.workflow === 'plan-remote') {
        scaffolding.DB_MIGRATION_CHECKSUMS_PATH = baselinePath;
        scaffolding.SAFE_RUN_TEST_LEDGER_OUTPUT = LEDGER_TABLE;
        expect(
          runCli(['check-migration-immutability', '--record', '--reviewed'], scaffolding).status,
        ).toBe(0);
      }

      const whenHostedStepRuns = runCli([step.workflow], { ...step.env, ...scaffolding });

      expect(whenHostedStepRuns.status).toBe(0);
      expect(whenHostedStepRuns.output).not.toContain('validate:env');
      expect(whenHostedStepRuns.calls.length).toBeGreaterThan(0);
      expect(whenHostedStepRuns.calls.some((call) => call.includes('validate:env'))).toBe(false);
      for (const secret of ['deploy-secret', 'backup-secret', 'sbp_test']) {
        expect(whenHostedStepRuns.output).not.toContain(secret);
      }
    },
  );

  it('refuses the production migration step while the checkout is still linked to staging @contract', () => {
    const productionMigrate = deploySteps.find(
      (step) => step.job === 'production' && step.workflow === 'migrate',
    );
    expect(productionMigrate).toBeDefined();
    const { root } = createLinkedWorkdir(STAGING_REF);

    const whenLinkedToStaging = runCli(['migrate'], {
      ...(productionMigrate?.env ?? {}),
      SUPABASE_WORKDIR: root,
    });

    expect(whenLinkedToStaging.status).toBe(2);
    expect(whenLinkedToStaging.output).toContain(
      `Linked Supabase project ref does not match production: expected ${PRODUCTION_REF}, linked ${STAGING_REF}`,
    );
    expect(whenLinkedToStaging.calls).toEqual([]);
  });
});
