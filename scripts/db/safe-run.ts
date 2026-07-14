import { spawnSync } from 'node:child_process';
import process from 'node:process';

const HELP = `Nabatable remote database safe runner

Usage: pnpm db:<workflow> [--include-all] [--dry-run]

Workflows: status, migrate, push, pull, check-drift, prepare-staging-legacy-drink-menu
Target: DB_TARGET_ENV=staging|production
Production migration apply: CONFIRM_PRODUCTION=true
Historical replay: --include-all is staging-only and requires migrate or push
Legacy drink-menu preparation: staging-only
`;

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
} as const;

type Workflow = keyof typeof WORKFLOW_PLANS;
type Target = 'staging' | 'production';
type ChildPlan = {
  readonly command: string;
  readonly args: readonly string[];
};
type ParsedRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'workflow';
      readonly workflow: Workflow;
      readonly target: Target;
      readonly dryRun: boolean;
      readonly includeAll: boolean;
    }
  | { readonly kind: 'refusal'; readonly message: string };

function isWorkflow(value: string): value is Workflow {
  return Object.hasOwn(WORKFLOW_PLANS, value);
}

function parseRequest(args: readonly string[], env: NodeJS.ProcessEnv): ParsedRequest {
  if (args.length === 1 && args[0] === '--help') {
    return { kind: 'help' };
  }

  const workflow = args[0];
  const options = args.slice(1);
  const dryRun = options.includes('--dry-run');
  const includeAll = options.includes('--include-all');
  const optionsAreSupported =
    options.length <= 2 &&
    new Set(options).size === options.length &&
    options.every((option) => option === '--dry-run' || option === '--include-all');
  if (!workflow || !isWorkflow(workflow) || !optionsAreSupported) {
    return { kind: 'refusal', message: 'Unsupported database workflow or argument.' };
  }

  const target = env.DB_TARGET_ENV;
  if (target !== 'staging' && target !== 'production') {
    return {
      kind: 'refusal',
      message: 'DB_TARGET_ENV must be exactly staging or production.',
    };
  }

  const access = WORKFLOW_PLANS[workflow].access;
  if (includeAll && access !== 'migration') {
    return { kind: 'refusal', message: '--include-all requires migrate or push.' };
  }
  if (includeAll && target !== 'staging') {
    return { kind: 'refusal', message: '--include-all is staging-only.' };
  }
  if (access === 'staging-preparation' && target !== 'staging') {
    return {
      kind: 'refusal',
      message: 'Legacy drink-menu preparation is staging-only.',
    };
  }
  if (
    target === 'production' &&
    access === 'migration' &&
    !dryRun &&
    env.CONFIRM_PRODUCTION !== 'true'
  ) {
    return {
      kind: 'refusal',
      message: 'CONFIRM_PRODUCTION=true is required for a production migration apply.',
    };
  }

  return { kind: 'workflow', workflow, target, dryRun, includeAll };
}

function resolvePlans(
  request: Extract<ParsedRequest, { readonly kind: 'workflow' }>,
): readonly ChildPlan[] {
  const plans = WORKFLOW_PLANS[request.workflow].steps;
  return request.includeAll
    ? plans.map((plan) => ({ ...plan, args: [...plan.args, '--include-all'] }))
    : plans;
}

function runChild(plan: ChildPlan): number {
  const result = spawnSync(plan.command, plan.args, {
    env: process.env,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function renderPlan(plan: ChildPlan): string {
  return [plan.command, ...plan.args].join(' ');
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
      const plans = resolvePlans(request);
      if (request.dryRun) {
        const access = WORKFLOW_PLANS[request.workflow].access;
        process.stdout.write(
          `dry-run target=${request.target} access=${access}\n` +
            `validate: pnpm validate:env\n` +
            plans.map((plan) => `workflow: ${renderPlan(plan)}\n`).join(''),
        );
        return 0;
      }

      const validationExit = runChild({ command: 'pnpm', args: ['validate:env'] });
      if (validationExit !== 0) {
        return validationExit;
      }
      for (const plan of plans) {
        const exitCode = runChild(plan);
        if (exitCode !== 0) {
          return exitCode;
        }
      }
      return 0;
    }
  }
}

process.exitCode = run();
