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

function parseTypes(argv: string[]): string | null {
  const value = argv.find((arg) => arg.startsWith('--types='));
  if (!value) {
    return null;
  }
  return value.slice('--types='.length).trim() || null;
}

async function main(): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error('CRON_SECRET is required to trigger /api/cron/process-emails.');
  }

  const origin = (process.env.CRON_ORIGIN ?? 'https://app.nabatable.com').replace(/\/+$/, '');
  const url = new URL(`${origin}/api/cron/process-emails`);
  const types = parseTypes(process.argv.slice(2));

  if (types) {
    url.searchParams.set('types', types);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });

  const payload = await response.text();
  if (!response.ok) {
    throw new Error(payload || `Manual drain failed with status ${response.status}`);
  }

  console.log(payload);
}

main().catch((error) => {
  console.error('[queue][email-worker] fatal', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
