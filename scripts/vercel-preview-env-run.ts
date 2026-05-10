import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();

type Args = {
  environment: 'preview';
  gitBranch: string;
  command: string[];
};

type BuildInput = Args & {
  projectRoot: string;
  tempProjectDir: string;
};

export function parseVercelPreviewEnvRunArgs(argv: string[]): Args {
  const separatorIndex = argv.indexOf('--');
  const optionArgs = separatorIndex === -1 ? argv : argv.slice(0, separatorIndex);
  const command = separatorIndex === -1 ? [] : argv.slice(separatorIndex + 1);
  const args: Args = {
    environment: 'preview',
    gitBranch:
      process.env.SMS_DELIVERY_VERCEL_GIT_BRANCH?.trim() || 'codex/sms-delivery-rollout-clean',
    command,
  };

  for (let index = 0; index < optionArgs.length; index += 1) {
    const raw = optionArgs[index] ?? '';
    const takeValue = (flag: string): string | null => {
      if (raw === flag) {
        const next = optionArgs[index + 1];
        if (next) {
          index += 1;
          return next;
        }
      }
      if (raw.startsWith(`${flag}=`)) {
        return raw.slice(flag.length + 1);
      }
      return null;
    };

    const branch = takeValue('--branch');
    if (branch) {
      args.gitBranch = branch.trim();
      continue;
    }

    const environment = takeValue('--environment');
    if (environment) {
      if (environment !== 'preview') {
        throw new Error('Only --environment preview is supported by this runner.');
      }
      args.environment = 'preview';
    }
  }

  if (args.command.length === 0) {
    throw new Error('A command must be provided after --.');
  }

  return args;
}

export function buildVercelPreviewEnvRunInvocation(input: BuildInput): {
  command: string;
  args: string[];
} {
  const childCommand =
    input.command[0] === 'pnpm'
      ? ['pnpm', '--dir', input.projectRoot, ...input.command.slice(1)]
      : input.command;

  return {
    command: 'npx',
    args: [
      'vercel',
      '--cwd',
      input.tempProjectDir,
      'env',
      'run',
      '--environment',
      input.environment,
      '--git-branch',
      input.gitBranch,
      '--',
      ...childCommand,
    ],
  };
}

function prepareTempLinkedProject(): string {
  const projectJsonPath = path.join(projectRoot, '.vercel', 'project.json');
  if (!fs.existsSync(projectJsonPath)) {
    throw new Error('.vercel/project.json is required to run Vercel Preview env commands.');
  }

  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-vercel-env-run-'));
  const tempVercelDir = path.join(tempProjectDir, '.vercel');
  fs.mkdirSync(tempVercelDir, { recursive: true });
  fs.copyFileSync(projectJsonPath, path.join(tempVercelDir, 'project.json'));
  return tempProjectDir;
}

function main() {
  const args = parseVercelPreviewEnvRunArgs(process.argv.slice(2));
  const tempProjectDir = prepareTempLinkedProject();

  try {
    const invocation = buildVercelPreviewEnvRunInvocation({
      ...args,
      projectRoot,
      tempProjectDir,
    });
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'inherit',
    });
    process.exit(typeof result.status === 'number' ? result.status : 1);
  } finally {
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(
      '[vercel-preview-env-run] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
