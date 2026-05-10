import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type Step = {
  name: string;
  command: string;
  args: string[];
  optional?: boolean;
};

type StepResult = {
  name: string;
  exitCode: number | null;
  ok: boolean;
  optional: boolean;
};

type VerifyReport = {
  ok: boolean;
  checkedAt: string;
  mode: 'pulled-env' | 'no-persist-env';
  steps: StepResult[];
  blockers: string[];
};

type Args = {
  noPersistEnv: boolean;
};

export const stagingVerifyStepsWithPulledEnv: Step[] = [
  {
    name: 'pull branch-effective Vercel Preview env',
    command: 'pnpm',
    args: ['run', 'sms:delivery:pull:staging-vercel-branch'],
  },
  {
    name: 'strict branch staging readiness',
    command: 'pnpm',
    args: ['run', 'sms:delivery:readiness:staging-vercel:branch-strict'],
  },
  {
    name: 'Preview deployment freshness',
    command: 'pnpm',
    args: ['run', 'sms:delivery:deployment:preview'],
  },
  {
    name: 'protected Preview webhook route/config',
    command: 'pnpm',
    args: ['run', 'sms:delivery:webhook:preview'],
  },
];

export const stagingVerifyStepsNoPersistEnv: Step[] = [
  {
    name: 'Vercel Preview SMS env metadata',
    command: 'pnpm',
    args: ['run', 'sms:delivery:env:preview:metadata'],
  },
  {
    name: 'Preview deployment freshness',
    command: 'pnpm',
    args: ['run', 'sms:delivery:deployment:preview'],
  },
  {
    name: 'protected Preview webhook route/config',
    command: 'pnpm',
    args: ['run', 'sms:delivery:webhook:preview'],
  },
];

function parseArgs(argv: string[]): Args {
  return {
    noPersistEnv: argv.includes('--no-persist-env'),
  };
}

function runStep(step: Step): StepResult {
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });

  const exitCode = typeof result.status === 'number' ? result.status : null;
  return {
    name: step.name,
    exitCode,
    ok: exitCode === 0,
    optional: step.optional === true,
  };
}

export function buildStagingVerifyReport(
  results: StepResult[],
  mode: VerifyReport['mode'] = 'pulled-env',
): VerifyReport {
  const blockers = results
    .filter((result) => !result.ok && !result.optional)
    .map((result) => `${result.name} failed with exit code ${result.exitCode ?? 'unknown'}.`);

  return {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    mode,
    steps: results,
    blockers,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const steps = args.noPersistEnv
    ? stagingVerifyStepsNoPersistEnv
    : stagingVerifyStepsWithPulledEnv;
  const mode = args.noPersistEnv ? 'no-persist-env' : 'pulled-env';
  const results: StepResult[] = [];

  for (const step of steps) {
    const result = runStep(step);
    results.push(result);
    if (!result.ok && step.optional !== true) {
      break;
    }
  }

  const report = buildStagingVerifyReport(results, mode);

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
