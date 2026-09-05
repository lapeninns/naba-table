import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  BACKUP_BUCKET_ENV,
  BACKUP_ROLE_URL_ENV,
  RESTORE_VERIFY_BACKUP_ID_ENV,
  RESTORE_VERIFY_PROJECT_REF_ENV,
  scrubDelegateEnv,
  validateBackupBucket,
  validateBackupIdentity,
  validateRestoreBackupId,
  validateRestoreVerifyTarget,
} from './migrations/backup-guard';
import {
  MIGRATION_CHECKSUMS_RELATIVE_PATH,
  MIGRATIONS_RELATIVE_PATH,
  compareCensus,
  computeMigrationCensus,
  createEmptyBaseline,
  isImmutabilitySatisfied,
  parseChecksumBaseline,
  recordUnrecorded,
  renderChecksumBaseline,
  renderImmutabilityReport,
  type ChecksumBaseline,
} from './migrations/checksums';
import { describeDbEnvironmentGuard, validateDbEnvironment } from './migrations/env-guard';
import { SQL_REGRESSION_FILES, SYNTHETIC_FIXTURES_RELATIVE_PATH } from './migrations/fixtures';
import {
  compareLedger,
  migrationVersionFromFileName,
  parseMigrationList,
} from './migrations/ledger';
import { findRefusedArgument, renderRefusal } from './migrations/refusals';
import {
  apiUrlFromEnv,
  databaseUrlFromEnv,
  expectedProjectRef,
  readLinkedProjectRef,
  validateRemoteTarget,
} from './migrations/targets';
import { ISOLATED_WORKDIR_ENV, createIsolatedSupabaseWorkdir } from './migrations/workdir';

const HELP = `Nabatable remote database safe runner

Usage: pnpm db:<workflow> [--include-all] [--dry-run]
       pnpm exec tsx scripts/db/safe-run.ts help|--help|-h

Workflows: status, migrate, push, pull, check-drift, prepare-staging-legacy-drink-menu, remove-staging-test-phone,
           link, plan-remote, sql-regression, check-migration-immutability, backup, restore-verify
Target: DB_TARGET_ENV=staging|production
Link: link runs supabase link --project-ref <expected ref for DB_TARGET_ENV> and refuses afterwards unless the
      link state names that ref; production requires CONFIRM_PRODUCTION=true
Environment: DB-scoped guard only (no web-app env, no pnpm validate:env); placeholder credentials are refused,
             connection/API URLs and the linked project must name the DB_TARGET_ENV project
Production migration apply: CONFIRM_PRODUCTION=true and a checkout linked to the production project
Historical replay: --include-all requires migrate or push
Production historical replay: CONFIRM_PRODUCTION_INCLUDE_ALL=20260811160000
Legacy drink-menu preparation: staging-only
Legacy test-phone cleanup: staging-only; requires TEST_PHONE_E164
Remote plan: plan-remote runs supabase db push --dry-run against the validated linked target
SQL regression: sql-regression is staging-only and requires SUPABASE_DB_URL for staging
Immutability: check-migration-immutability [--record --reviewed] compares supabase/migrations with config/db/migration-checksums.json
Backup: backup requires DB_BACKUP_ROLE_URL (dedicated read-only backup role) and DB_BACKUP_BUCKET
Restore verification: restore-verify restores RESTORE_VERIFY_BACKUP_ID from the DB_TARGET_ENV source into
                      RESTORE_VERIFY_PROJECT_REF, which must never be the staging or production project
Refused everywhere: migration repair, db reset, historical replay flags, destructive resets
`;

/** Bare `help` and `-h` are accepted alongside `--help` so operators never hit a refusal asking for guidance. */
const HELP_ARGUMENTS: ReadonlySet<string> = new Set(['help', '--help', '-h']);
const ISOLATED_WORKDIR_PLACEHOLDER = '<isolated-workdir>';
const TARGET_PLACEHOLDER = '<target>';
const RESTORE_PROJECT_REF_PLACEHOLDER = '<restore-project-ref>';
const RESTORE_BACKUP_ID_PLACEHOLDER = '<restore-backup-id>';
const BACKUP_BUCKET_PLACEHOLDER = '<backup-bucket>';
const PROJECT_REF_PLACEHOLDER = '<project-ref>';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const WORKFLOW_PLANS = {
  status: {
    access: 'read-only',
    steps: [{ command: 'supabase', args: ['migration', 'list'] }],
  },
  migrate: {
    access: 'migration',
    steps: [{ command: 'supabase', args: ['db', 'push'] }],
  },
  push: {
    access: 'migration',
    steps: [{ command: 'supabase', args: ['db', 'push'] }],
  },
  pull: {
    access: 'read-only',
    steps: [{ command: 'supabase', args: ['db', 'pull'] }],
  },
  'check-drift': {
    access: 'read-only',
    steps: [{ command: 'pnpm', args: ['exec', 'tsx', 'scripts/db/check-drift.ts'] }],
  },
  'prepare-staging-legacy-drink-menu': {
    access: 'staging-preparation',
    steps: [
      {
        command: 'supabase',
        args: [
          'db',
          'query',
          '--linked',
          '--file',
          'supabase/migrations/20260507223000_backfill_canonical_menu_hierarchy.sql',
        ],
      },
      {
        command: 'supabase',
        args: [
          'db',
          'query',
          '--linked',
          '--file',
          'scripts/db/prepare-staging-legacy-drink-menu.sql',
        ],
      },
    ],
  },
  'remove-staging-test-phone': {
    access: 'staging-cleanup',
    steps: [
      {
        command: 'pnpm',
        args: ['exec', 'tsx', 'scripts/db/remove-staging-test-phone.ts'],
      },
    ],
  },
  link: {
    access: 'link',
    steps: [{ command: 'supabase', args: ['link', '--project-ref', PROJECT_REF_PLACEHOLDER] }],
  },
  'plan-remote': {
    access: 'remote-plan',
    steps: [
      { command: 'bash', args: ['scripts/supabase/check_migration_versions_unique.sh'] },
      { command: 'supabase', args: ['migration', 'list', '--linked'], capture: 'ledger' },
      { command: 'supabase', args: ['db', 'push', '--dry-run', '--linked'] },
    ],
  },
  'sql-regression': {
    access: 'staging-regression',
    steps: [
      {
        command: 'pnpm',
        args: [
          'exec',
          'tsx',
          'scripts/db/migrations/sql-regression.ts',
          '--fixtures',
          SYNTHETIC_FIXTURES_RELATIVE_PATH,
          ...SQL_REGRESSION_FILES,
        ],
      },
    ],
  },
  'check-migration-immutability': {
    access: 'local-integrity',
    steps: [],
  },
  backup: {
    access: 'backup',
    steps: [
      {
        command: 'pnpm',
        args: [
          'exec',
          'tsx',
          'scripts/db/backup/run.ts',
          '--target',
          TARGET_PLACEHOLDER,
          '--identity-env',
          BACKUP_ROLE_URL_ENV,
          '--bucket',
          BACKUP_BUCKET_PLACEHOLDER,
        ],
      },
    ],
  },
  'restore-verify': {
    access: 'restore-verify',
    steps: [
      {
        command: 'pnpm',
        args: [
          'exec',
          'tsx',
          'scripts/db/restore/verify.ts',
          '--backup-id',
          RESTORE_BACKUP_ID_PLACEHOLDER,
          '--project-ref',
          RESTORE_PROJECT_REF_PLACEHOLDER,
          '--source',
          TARGET_PLACEHOLDER,
        ],
      },
    ],
  },
} as const;

type Workflow = keyof typeof WORKFLOW_PLANS;
type Access = (typeof WORKFLOW_PLANS)[Workflow]['access'];
type Target = 'staging' | 'production';
type ChildPlan = {
  readonly command: string;
  readonly args: readonly string[];
  readonly capture?: 'ledger';
};
type WorkflowRequest = {
  readonly kind: 'workflow';
  readonly workflow: Workflow;
  readonly target: Target;
  readonly dryRun: boolean;
  readonly includeAll: boolean;
  readonly record: boolean;
  readonly supabaseWorkdir?: string;
  /** Human-readable guard statements proven during parsing (printed in dry-run). */
  readonly guards: readonly string[];
  /** Whether the run executes inside a fresh isolated Supabase workdir. */
  readonly isolate: boolean;
  readonly childEnv: NodeJS.ProcessEnv;
  readonly restoreProjectRef?: string;
  readonly restoreBackupId?: string;
  readonly backupBucket?: string;
};
type ParsedRequest =
  | { readonly kind: 'help' }
  | WorkflowRequest
  | { readonly kind: 'refusal'; readonly message: string };

const PRODUCTION_INCLUDE_ALL_CONFIRMATION = '20260811160000';
const ISOLATED_ACCESS: readonly Access[] = ['remote-plan', 'staging-regression'];
/** Workflows whose children act on the linked Supabase project; the link state must name the target. */
const LINKED_ACCESS: readonly Access[] = [
  'read-only',
  'migration',
  'staging-preparation',
  'remote-plan',
  'staging-regression',
];
const DELEGATE_PATHS: Readonly<Partial<Record<Access, string>>> = {
  backup: 'scripts/db/backup/run.ts',
  'restore-verify': 'scripts/db/restore/verify.ts',
};

function isWorkflow(value: string): value is Workflow {
  return Object.hasOwn(WORKFLOW_PLANS, value);
}

function allowedOptions(access: Access): readonly string[] {
  if (access === 'local-integrity') {
    return ['--dry-run', '--record', '--reviewed'];
  }
  return access === 'link' ? ['--dry-run'] : ['--dry-run', '--include-all'];
}

function refusal(message: string): ParsedRequest {
  return { kind: 'refusal', message };
}

function parseRequest(args: readonly string[], env: NodeJS.ProcessEnv): ParsedRequest {
  if (args.length === 1 && HELP_ARGUMENTS.has(args[0] ?? '')) {
    return { kind: 'help' };
  }

  const refused = findRefusedArgument(args);
  if (refused) {
    return refusal(renderRefusal(refused));
  }

  const workflow = args[0];
  const options = args.slice(1);
  if (!workflow || !isWorkflow(workflow)) {
    return refusal('Unsupported database workflow or argument.');
  }
  const access: Access = WORKFLOW_PLANS[workflow].access;
  const permitted = allowedOptions(access);
  const optionsAreSupported =
    new Set(options).size === options.length &&
    options.every((option) => permitted.includes(option));
  if (!optionsAreSupported) {
    return refusal('Unsupported database workflow or argument.');
  }
  const dryRun = options.includes('--dry-run');
  const includeAll = options.includes('--include-all');
  const record = options.includes('--record');
  const reviewed = options.includes('--reviewed');

  const rawTarget = env.DB_TARGET_ENV;
  const targetOptional = access === 'local-integrity';
  if (rawTarget !== 'staging' && rawTarget !== 'production' && !(targetOptional && !rawTarget)) {
    return refusal('DB_TARGET_ENV must be exactly staging or production.');
  }
  const target: Target = rawTarget === 'production' ? 'production' : 'staging';

  const supabaseWorkdir = env.SUPABASE_WORKDIR?.trim() || undefined;
  if (supabaseWorkdir && !path.isAbsolute(supabaseWorkdir)) {
    return refusal('SUPABASE_WORKDIR must be an absolute path.');
  }

  if (includeAll && access !== 'migration') {
    return refusal('--include-all requires migrate or push.');
  }
  if (
    includeAll &&
    target === 'production' &&
    !dryRun &&
    env.CONFIRM_PRODUCTION_INCLUDE_ALL !== PRODUCTION_INCLUDE_ALL_CONFIRMATION
  ) {
    return refusal(
      `CONFIRM_PRODUCTION_INCLUDE_ALL=${PRODUCTION_INCLUDE_ALL_CONFIRMATION} is required for production historical replay.`,
    );
  }
  if (access === 'staging-preparation' && target !== 'staging') {
    return refusal('Legacy drink-menu preparation is staging-only.');
  }
  if (access === 'staging-cleanup' && target !== 'staging') {
    return refusal('Legacy test-phone cleanup is staging-only.');
  }
  if (access === 'staging-cleanup' && !/^\+[1-9]\d{6,14}$/.test(env.TEST_PHONE_E164 ?? '')) {
    return refusal('TEST_PHONE_E164 must be valid E.164 for legacy test-phone cleanup.');
  }
  if (
    target === 'production' &&
    access === 'migration' &&
    !dryRun &&
    env.CONFIRM_PRODUCTION !== 'true'
  ) {
    return refusal('CONFIRM_PRODUCTION=true is required for a production migration apply.');
  }
  if (
    target === 'production' &&
    access === 'link' &&
    !dryRun &&
    env.CONFIRM_PRODUCTION !== 'true'
  ) {
    return refusal('CONFIRM_PRODUCTION=true is required to link the production project.');
  }
  if (record !== reviewed) {
    return refusal(
      '--record and --reviewed must be given together for migration checksum recording.',
    );
  }

  const base: WorkflowRequest = {
    kind: 'workflow',
    workflow,
    target,
    dryRun,
    includeAll,
    record,
    supabaseWorkdir,
    guards: [],
    isolate: ISOLATED_ACCESS.includes(access),
    childEnv: env,
  };

  switch (access) {
    case 'link': {
      const expected = expectedProjectRef(target);
      return {
        ...base,
        guards: [
          `supabase link targets ${expected} (${target}); the resulting link state must name it`,
        ],
      };
    }
    case 'remote-plan':
    case 'staging-regression': {
      if (access === 'staging-regression' && target !== 'staging') {
        return refusal('SQL regression is staging-only; production targets are refused.');
      }
      const validation = validateRemoteTarget({
        target,
        linkedProjectRef: readLinkedProjectRef(supabaseWorkdir ?? REPO_ROOT),
        databaseUrl: databaseUrlFromEnv(env),
        apiUrl: apiUrlFromEnv(env),
        requireDatabaseUrl: access === 'staging-regression',
      });
      if (!validation.ok) {
        return refusal(validation.message);
      }
      const guards = [
        `linked project ref ${validation.projectRef} matches ${target}`,
        ...(validation.databaseRole
          ? [
              `database connection targets ${validation.projectRef} as role ${validation.databaseRole}`,
            ]
          : []),
        'migration versions unique; recorded migrations immutable; remote ledger reconciled',
      ];
      return { ...base, guards };
    }
    case 'backup': {
      const identity = validateBackupIdentity(env, target);
      if (!identity.ok) {
        return refusal(identity.message);
      }
      const bucket = validateBackupBucket(env);
      if (!bucket.ok) {
        return refusal(bucket.message);
      }
      return {
        ...base,
        childEnv: scrubDelegateEnv(env),
        backupBucket: bucket.value,
        guards: [
          `${BACKUP_ROLE_URL_ENV} uses dedicated backup role ${identity.role ?? 'unknown'} on ${identity.projectRef} (${target})`,
          `${BACKUP_BUCKET_ENV}=${bucket.value} receives the encrypted artifacts`,
          'service-role and deploy credentials are scrubbed from the delegate environment',
        ],
      };
    }
    case 'restore-verify': {
      const scratch = validateRestoreVerifyTarget(env);
      if (!scratch.ok) {
        return refusal(scratch.message);
      }
      const backupId = validateRestoreBackupId(env);
      if (!backupId.ok) {
        return refusal(backupId.message);
      }
      return {
        ...base,
        childEnv: scrubDelegateEnv(env),
        restoreProjectRef: scratch.projectRef,
        restoreBackupId: backupId.value,
        guards: [
          `${RESTORE_VERIFY_PROJECT_REF_ENV}=${scratch.projectRef} is neither staging (${expectedProjectRef('staging')}) nor production (${expectedProjectRef('production')})`,
          `${RESTORE_VERIFY_BACKUP_ID_ENV}=${backupId.value} is restored from the ${target} backup set into the scratch project only`,
          'service-role and deploy credentials are scrubbed from the delegate environment',
        ],
      };
    }
    default:
      return base;
  }
}

function substitute(plan: ChildPlan, request: WorkflowRequest): ChildPlan {
  return {
    ...plan,
    args: plan.args.map((arg) => {
      if (arg === TARGET_PLACEHOLDER) {
        return request.target;
      }
      if (arg === RESTORE_PROJECT_REF_PLACEHOLDER) {
        return request.restoreProjectRef ?? arg;
      }
      if (arg === RESTORE_BACKUP_ID_PLACEHOLDER) {
        return request.restoreBackupId ?? arg;
      }
      if (arg === BACKUP_BUCKET_PLACEHOLDER) {
        return request.backupBucket ?? arg;
      }
      if (arg === PROJECT_REF_PLACEHOLDER) {
        return expectedProjectRef(request.target);
      }
      return arg;
    }),
  };
}

function resolvePlans(request: WorkflowRequest, isolatedWorkdir?: string): readonly ChildPlan[] {
  const plans: readonly ChildPlan[] = WORKFLOW_PLANS[request.workflow].steps;
  const substituted = plans.map((plan) => substitute(plan, request));
  const replayPlans = request.includeAll
    ? substituted.map((plan) => ({ ...plan, args: [...plan.args, '--include-all'] }))
    : substituted;
  const workdir = request.isolate
    ? (isolatedWorkdir ?? ISOLATED_WORKDIR_PLACEHOLDER)
    : request.supabaseWorkdir;
  return workdir
    ? replayPlans.map((plan) =>
        plan.command === 'supabase'
          ? { ...plan, args: [...plan.args, '--workdir', workdir] }
          : plan,
      )
    : replayPlans;
}

function runChild(plan: ChildPlan, env: NodeJS.ProcessEnv = process.env): number {
  const result = spawnSync(plan.command, plan.args, {
    env,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function captureChild(
  plan: ChildPlan,
  env: NodeJS.ProcessEnv,
): { readonly status: number; readonly stdout: string } {
  const result = spawnSync(plan.command, plan.args, {
    env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  const stdout = result.stdout ?? '';
  if (stdout) {
    process.stdout.write(stdout);
  }
  return { status: result.status ?? 1, stdout };
}

function renderPlan(plan: ChildPlan): string {
  return [plan.command, ...plan.args].join(' ');
}

function sourceRootFor(request: WorkflowRequest): string {
  return request.supabaseWorkdir ?? REPO_ROOT;
}

function checksumBaselinePath(env: NodeJS.ProcessEnv): string {
  const override = env.DB_MIGRATION_CHECKSUMS_PATH?.trim();
  return override && path.isAbsolute(override)
    ? override
    : path.join(REPO_ROOT, MIGRATION_CHECKSUMS_RELATIVE_PATH);
}

function runImmutability(request: WorkflowRequest, env: NodeJS.ProcessEnv): number {
  const migrationsDirectory = path.join(sourceRootFor(request), MIGRATIONS_RELATIVE_PATH);
  const baselinePath = checksumBaselinePath(env);
  let census;
  try {
    census = computeMigrationCensus(migrationsDirectory);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  let baseline: ChecksumBaseline;
  if (existsSync(baselinePath)) {
    try {
      baseline = parseChecksumBaseline(readFileSync(baselinePath, 'utf8'));
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  } else if (request.record) {
    baseline = createEmptyBaseline(new Date().toISOString().slice(0, 10));
  } else {
    process.stderr.write(
      `Migration checksum baseline missing at ${MIGRATION_CHECKSUMS_RELATIVE_PATH}; review the tree and run check-migration-immutability --record --reviewed.\n`,
    );
    return 1;
  }

  const report = compareCensus(baseline, census);
  process.stdout.write(renderImmutabilityReport(report));
  if (!isImmutabilitySatisfied(report)) {
    process.stderr.write(
      'Recorded migrations changed or disappeared; applied migrations are immutable. Add a new forward migration instead.\n',
    );
    return 1;
  }
  if (request.record && report.unrecorded.length > 0) {
    const updated = recordUnrecorded(baseline, census, new Date().toISOString());
    writeFileSync(baselinePath, renderChecksumBaseline(updated), 'utf8');
    process.stdout.write(
      `immutability: recorded ${report.unrecorded.length} reviewed migration file(s) into ${path.relative(REPO_ROOT, baselinePath)}\n`,
    );
  } else if (report.unrecorded.length > 0) {
    process.stdout.write(
      'immutability: unrecorded files are allowed; record them after review with --record --reviewed\n',
    );
  }
  return 0;
}

function reconcileLedger(output: string, migrationsDirectory: string): number {
  const localVersions = Object.keys(computeMigrationCensus(migrationsDirectory))
    .map(migrationVersionFromFileName)
    .filter((version): version is string => version !== null);
  const comparison = compareLedger(parseMigrationList(output), localVersions);
  process.stdout.write(
    `ledger: applied=${comparison.applied.length} pending=${comparison.pending.length} remote-only=${comparison.remoteOnly.length}\n`,
  );
  if (!comparison.ok) {
    for (const message of comparison.messages) {
      process.stderr.write(`ledger: ${message}\n`);
    }
    return 1;
  }
  return 0;
}

function renderDryRun(request: WorkflowRequest): string {
  const access = WORKFLOW_PLANS[request.workflow].access;
  const lines = [`dry-run target=${request.target} access=${access}\n`];
  for (const guard of request.guards) {
    lines.push(`guard: ${guard}\n`);
  }
  if (access === 'local-integrity') {
    lines.push(
      `immutability: compare sha256 of ${MIGRATIONS_RELATIVE_PATH} against ${MIGRATION_CHECKSUMS_RELATIVE_PATH}${request.record ? ' and record reviewed unrecorded files' : ''}\n`,
    );
    return lines.join('');
  }
  lines.push(`validate: ${describeDbEnvironmentGuard(LINKED_ACCESS.includes(access))}\n`);
  if (access === 'remote-plan') {
    lines.push(
      `guard: migration immutability against ${MIGRATION_CHECKSUMS_RELATIVE_PATH}\n`,
      `isolate: copy supabase/ into ${ISOLATED_WORKDIR_PLACEHOLDER} (mkdtemp) for this run\n`,
    );
  }
  for (const plan of resolvePlans(request)) {
    lines.push(`workflow: ${renderPlan(plan)}\n`);
  }
  return lines.join('');
}

function executeWorkflow(request: WorkflowRequest): number {
  const access = WORKFLOW_PLANS[request.workflow].access;
  const delegate = DELEGATE_PATHS[access];
  if (delegate && !existsSync(path.join(REPO_ROOT, delegate))) {
    process.stderr.write(
      `Delegate ${delegate} is not present; refusing to run ${request.workflow}.\n`,
    );
    return 2;
  }

  const environment = validateDbEnvironment({
    env: process.env,
    target: request.target,
    linkedSourceRoot: LINKED_ACCESS.includes(access) ? sourceRootFor(request) : undefined,
  });
  if (!environment.ok) {
    process.stderr.write(`${environment.message}\n`);
    return 2;
  }
  for (const guard of environment.guards) {
    process.stdout.write(`validate: ${guard}\n`);
  }

  if (access === 'remote-plan') {
    const immutabilityExit = runImmutability(request, process.env);
    if (immutabilityExit !== 0) {
      return immutabilityExit;
    }
  }

  const isolated = request.isolate ? createIsolatedSupabaseWorkdir(sourceRootFor(request)) : null;
  try {
    const childEnv: NodeJS.ProcessEnv = { ...request.childEnv };
    if (isolated) {
      childEnv[ISOLATED_WORKDIR_ENV] = isolated.path;
      childEnv.SUPABASE_WORKDIR = isolated.path;
      process.stdout.write(`isolate: ${isolated.path} (${isolated.copied.join(', ')})\n`);
      const linked = readLinkedProjectRef(isolated.path);
      if (linked !== expectedProjectRef(request.target)) {
        process.stderr.write(
          `Isolated workdir link state (${linked ?? 'missing'}) does not match ${request.target}.\n`,
        );
        return 2;
      }
    } else if (request.workflow === 'check-drift') {
      const driftWorkdir = createIsolatedSupabaseWorkdir(sourceRootFor(request));
      childEnv[ISOLATED_WORKDIR_ENV] = driftWorkdir.path;
      childEnv.DB_DRIFT_SCOPE ??= 'extended';
      try {
        return runChild(resolvePlans(request)[0], childEnv);
      } finally {
        driftWorkdir.cleanup();
      }
    }

    for (const plan of resolvePlans(request, isolated?.path)) {
      if (plan.capture === 'ledger') {
        const captured = captureChild(plan, childEnv);
        if (captured.status !== 0) {
          return captured.status;
        }
        const ledgerExit = reconcileLedger(
          captured.stdout,
          path.join(isolated?.path ?? sourceRootFor(request), MIGRATIONS_RELATIVE_PATH),
        );
        if (ledgerExit !== 0) {
          return ledgerExit;
        }
        continue;
      }
      const exitCode = runChild(plan, childEnv);
      if (exitCode !== 0) {
        return exitCode;
      }
    }
    if (access === 'link') {
      return verifyLinkState(request);
    }
    return 0;
  } finally {
    isolated?.cleanup();
  }
}

/** After `supabase link`, the on-disk link state must name the requested target or the run fails. */
function verifyLinkState(request: WorkflowRequest): number {
  const expected = expectedProjectRef(request.target);
  const linked = readLinkedProjectRef(sourceRootFor(request));
  if (linked !== expected) {
    process.stderr.write(
      `Link state (${linked ?? 'missing'}) does not name the ${request.target} project (${expected}) after supabase link; refusing.\n`,
    );
    return 2;
  }
  process.stdout.write(`link: ${expected} (${request.target})\n`);
  return 0;
}

function run(): number {
  const request = parseRequest(process.argv.slice(2), process.env);
  switch (request.kind) {
    case 'help':
      process.stdout.write(HELP);
      return 0;
    case 'refusal':
      process.stderr.write(`${request.message}\n\n${HELP}`);
      return 2;
    case 'workflow': {
      if (request.dryRun) {
        process.stdout.write(renderDryRun(request));
        return 0;
      }
      if (WORKFLOW_PLANS[request.workflow].access === 'local-integrity') {
        return runImmutability(request, process.env);
      }
      return executeWorkflow(request);
    }
  }
}

process.exitCode = run();
