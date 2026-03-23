import 'tsconfig-paths/register';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const envPath = process.env.ENV_PATH
  ? path.resolve(projectRoot, process.env.ENV_PATH)
  : path.join(projectRoot, '.env.vercel-production');

if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath, override: false });
}

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';

const MAX_JOBS = Number.parseInt(process.env.MAX_JOBS ?? '50', 10);

async function main(): Promise<void> {
  if (SUPPRESS_EMAILS) {
    console.log('[drain-review] SUPPRESS_EMAILS enabled; aborting.');
    return;
  }

  if (!Number.isFinite(MAX_JOBS) || MAX_JOBS <= 0) {
    throw new Error('MAX_JOBS must be a positive integer.');
  }

  const appOrigin = (process.env.CRON_ORIGIN ?? 'https://app.nabatable.com').replace(/\/+$/, '');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('CRON_SECRET is required to trigger /api/cron/process-emails.');
  }

  const url = new URL(`${appOrigin}/api/cron/process-emails`);
  url.searchParams.set('types', 'review_request');
  url.searchParams.set('maxJobs', String(MAX_JOBS));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        processed?: number;
        stats?: { sent?: number; skipped?: number; failed?: number };
        error?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Drain failed with status ${response.status}`);
  }

  console.log('[drain-review] summary', {
    processed: payload?.processed ?? 0,
    sent: payload?.stats?.sent ?? 0,
    skipped: payload?.stats?.skipped ?? 0,
    failed: payload?.stats?.failed ?? 0,
  });
}

main()
  .catch((error) => {
    console.error('[drain-review] fatal', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
