import { spawnSync } from 'node:child_process';
import process from 'node:process';

const HELP = `Nabatable remote database safe runner

Usage: pnpm db:<workflow> [--dry-run]

Workflows: status, migrate, push, pull, check-drift
Target: DB_TARGET_ENV=staging|production
Production migration apply: CONFIRM_PRODUCTION=true
`;

const WORKFLOW_PLANS = {
  status: { access: 'read-only', command: 'supabase', args: ['migration', 'list'] },
  migrate: { access: 'migration', command: 'supabase', args: ['db', 'push'] },
  push: { access: 'migration', command: 'supabase', args: ['db', 'push'] },
  pull: { access: 'read-only', command: 'supabase', args: ['db', 'pull'] },
  'check-drift': {
    access: 'read-only',
    command: 'pnpm',
    args: ['exec', 'tsx', 'scripts/db/check-drift.ts'],
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
  const dryRun = args.length === 2 && args[1] === '--dry-run';
  if (!workflow || !isWorkflow(workflow) || (args.length !== 1 && !dryRun)) {
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

  return { kind: 'workflow', workflow, target, dryRun };
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
      const plan = WORKFLOW_PLANS[request.workflow];
      if (request.dryRun) {
        process.stdout.write(
          `dry-run target=${request.target} access=${plan.access}\n` +
            `validate: pnpm validate:env\n` +
            `workflow: ${renderPlan(plan)}\n`,
        );
        return 0;
      }

      const validationExit = runChild({ command: 'pnpm', args: ['validate:env'] });
      return validationExit === 0 ? runChild(plan) : validationExit;
    }
  }
}

process.exitCode = run();
