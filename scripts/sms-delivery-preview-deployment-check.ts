import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_BRANCH = 'codex/Menu';
const DEFAULT_REMOTE = 'origin';
const DEFAULT_PROJECT = 'nabatable';
const DEFAULT_ALIAS = 'https://nabatable-git-codex-menu-lapen-inns-projects.vercel.app';

type Args = {
  branch: string;
  remote: string;
  project: string;
  alias: string;
};

type VercelDeployment = {
  url?: unknown;
  state?: unknown;
  createdAt?: unknown;
  meta?: {
    githubCommitSha?: unknown;
    githubCommitRef?: unknown;
    branchAlias?: unknown;
  };
};

type VercelListPayload = {
  deployments?: VercelDeployment[];
};

type DeploymentSummary = {
  url: string;
  state: string;
  createdAt: number | null;
  branchAlias: string | null;
};

type DeploymentCheckReport = {
  ok: boolean;
  checkedAt: string;
  branch: string;
  remote: string;
  remoteRef: string;
  expectedCommitSha: string;
  expectedAlias: string;
  readyDeploymentsForCommit: DeploymentSummary[];
  deploymentsForCommit: DeploymentSummary[];
  blockers: string[];
};

export function parsePreviewDeploymentCheckArgs(argv: string[]): Args {
  const args: Args = {
    branch: process.env.SMS_DELIVERY_VERCEL_GIT_BRANCH?.trim() || DEFAULT_BRANCH,
    remote: process.env.SMS_DELIVERY_GIT_REMOTE?.trim() || DEFAULT_REMOTE,
    project: process.env.SMS_DELIVERY_VERCEL_PROJECT?.trim() || DEFAULT_PROJECT,
    alias: process.env.SMS_DELIVERY_PREVIEW_DEPLOYMENT_URL?.trim() || DEFAULT_ALIAS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? '';
    const takeValue = (flag: string): string | null => {
      if (raw === flag) {
        const next = argv[index + 1];
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
      args.branch = branch.trim();
      continue;
    }

    const remote = takeValue('--remote');
    if (remote) {
      args.remote = remote.trim();
      continue;
    }

    const project = takeValue('--project');
    if (project) {
      args.project = project.trim();
      continue;
    }

    const alias = takeValue('--alias');
    if (alias) {
      args.alias = alias.trim();
    }
  }

  return args;
}

function runText(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed: ${detail}`);
  }

  return result.stdout.trim();
}

function normalizeAliasHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

function parseVercelListJson(raw: string): VercelListPayload {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('Vercel deployment list did not return JSON output.');
  }
  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as VercelListPayload;
}

function summarizeDeployment(deployment: VercelDeployment): DeploymentSummary {
  return {
    url: typeof deployment.url === 'string' ? deployment.url : '',
    state: typeof deployment.state === 'string' ? deployment.state : 'unknown',
    createdAt: typeof deployment.createdAt === 'number' ? deployment.createdAt : null,
    branchAlias:
      typeof deployment.meta?.branchAlias === 'string' ? deployment.meta.branchAlias : null,
  };
}

export function buildPreviewDeploymentCheckReport(input: {
  branch: string;
  remote: string;
  remoteRef: string;
  expectedCommitSha: string;
  alias: string;
  deployments: VercelDeployment[];
}): DeploymentCheckReport {
  const expectedAlias = normalizeAliasHost(input.alias);
  const deploymentsForCommit = input.deployments.map(summarizeDeployment);
  const readyDeploymentsForCommit = deploymentsForCommit.filter(
    (deployment) => deployment.state === 'READY',
  );
  const readyDeploymentHasBranchAlias = readyDeploymentsForCommit.some(
    (deployment) => deployment.branchAlias === expectedAlias,
  );

  const blockers = [
    deploymentsForCommit.length === 0
      ? `No Vercel Preview deployment found for ${input.remoteRef} at ${input.expectedCommitSha}.`
      : null,
    deploymentsForCommit.length > 0 && readyDeploymentsForCommit.length === 0
      ? `No READY Vercel Preview deployment found for ${input.remoteRef} at ${input.expectedCommitSha}.`
      : null,
    readyDeploymentsForCommit.length > 0 && !readyDeploymentHasBranchAlias
      ? `No READY deployment for ${input.expectedCommitSha} owns branch alias ${expectedAlias}.`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    branch: input.branch,
    remote: input.remote,
    remoteRef: input.remoteRef,
    expectedCommitSha: input.expectedCommitSha,
    expectedAlias,
    readyDeploymentsForCommit,
    deploymentsForCommit,
    blockers,
  };
}

function main() {
  const args = parsePreviewDeploymentCheckArgs(process.argv.slice(2));
  const remoteRef = `${args.remote}/${args.branch}`;
  const expectedCommitSha = runText('git', ['rev-parse', '--verify', remoteRef]);
  const rawDeployments = runText('npx', [
    'vercel',
    'ls',
    args.project,
    '--environment=preview',
    '--meta',
    `githubCommitSha=${expectedCommitSha}`,
    '--format',
    'json',
  ]);
  const payload = parseVercelListJson(rawDeployments);
  const report = buildPreviewDeploymentCheckReport({
    branch: args.branch,
    remote: args.remote,
    remoteRef,
    expectedCommitSha,
    alias: args.alias,
    deployments: payload.deployments ?? [],
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(
      '[sms-delivery-preview-deployment-check] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
