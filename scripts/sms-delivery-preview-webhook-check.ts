import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const WEBHOOK_PATH = '/api/webhook/twilio/sms-status';
const DEFAULT_DEPLOYMENT =
  'https://nabatable-git-codex-sms-delivery-rol-2ac20d-lapen-inns-projects.vercel.app';
const PREVIEW_DEPLOYMENT_ENV = 'SMS_DELIVERY_PREVIEW_DEPLOYMENT_URL';

type Args = {
  deployment: string;
};

type ProbeResult = {
  method: 'GET' | 'POST';
  statusCode: number | null;
  matchedPath: string | null;
  bodySnippet: string | null;
  error: string | null;
};

type Report = {
  ok: boolean;
  checkedAt: string;
  deployment: string;
  webhookPath: string;
  routeReachable: boolean;
  twilioWebhookConfigured: boolean;
  probes: ProbeResult[];
  blockers: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    deployment: process.env[PREVIEW_DEPLOYMENT_ENV]?.trim() || DEFAULT_DEPLOYMENT,
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

    const deployment = takeValue('--deployment');
    if (deployment) {
      args.deployment = deployment.trim();
      continue;
    }
  }

  return args;
}

function requireConcreteHttpsUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new Error('deployment must use https.');
    }
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Invalid --deployment: ${error.message}` : 'Invalid --deployment.',
    );
  }
}

export function parsePreviewWebhookHttpResponse(
  raw: string,
  method: ProbeResult['method'],
): ProbeResult {
  const headerStart = raw.search(/HTTP\/\d(?:\.\d)?\s+\d{3}/);
  const relevant = headerStart >= 0 ? raw.slice(headerStart) : raw;
  const headerEnd = relevant.search(/\r?\n\r?\n/);
  const headerBlock = headerEnd >= 0 ? relevant.slice(0, headerEnd) : relevant;
  const body = headerEnd >= 0 ? relevant.slice(headerEnd).trim() : '';
  const statusMatch = headerBlock.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/);
  const matchedPathMatch = headerBlock.match(/^x-matched-path:\s*(.+)$/im);

  return {
    method,
    statusCode: statusMatch ? Number.parseInt(statusMatch[1] as string, 10) : null,
    matchedPath: matchedPathMatch?.[1]?.trim() ?? null,
    bodySnippet: body ? body.slice(0, 200) : null,
    error: null,
  };
}

function runProbe(params: {
  deployment: string;
  method: ProbeResult['method'];
  data?: string;
}): ProbeResult {
  const curlArgs = [
    'vercel',
    'curl',
    WEBHOOK_PATH,
    '--deployment',
    params.deployment,
    '--',
    '--silent',
    '--show-error',
    '--include',
    '--request',
    params.method,
  ];

  if (params.data !== undefined) {
    curlArgs.push('--data', params.data);
  }

  const result = spawnSync('npx', curlArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.error) {
    return {
      method: params.method,
      statusCode: null,
      matchedPath: null,
      bodySnippet: null,
      error: result.error.message,
    };
  }

  const parsed = parsePreviewWebhookHttpResponse(result.stdout ?? '', params.method);
  if (result.status !== 0 && !parsed.statusCode) {
    return {
      ...parsed,
      error:
        result.stderr?.trim() ||
        result.stdout?.trim() ||
        `vercel curl exited with status ${result.status}`,
    };
  }

  return parsed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  requireConcreteHttpsUrl(args.deployment);

  const getProbe = runProbe({ deployment: args.deployment, method: 'GET' });
  const postProbe = runProbe({ deployment: args.deployment, method: 'POST', data: '' });
  const routeReachable =
    getProbe.statusCode === 405 &&
    getProbe.matchedPath === WEBHOOK_PATH &&
    postProbe.matchedPath === WEBHOOK_PATH;
  const twilioWebhookConfigured = postProbe.statusCode === 401;

  const blockers: string[] = [];
  if (!routeReachable) {
    blockers.push('Preview webhook route is not reachable or did not match the expected path.');
  }
  if (postProbe.statusCode === 503) {
    blockers.push('Preview runtime is missing TWILIO_AUTH_TOKEN; webhook is not configured.');
  } else if (!twilioWebhookConfigured) {
    blockers.push(
      `Expected empty POST to return 401 when TWILIO_AUTH_TOKEN is configured; got ${postProbe.statusCode ?? 'unknown'}.`,
    );
  }

  const report: Report = {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    deployment: args.deployment,
    webhookPath: WEBHOOK_PATH,
    routeReachable,
    twilioWebhookConfigured,
    probes: [getProbe, postProbe],
    blockers,
  };

  console.log(JSON.stringify(report, null, 2));
  if (blockers.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
