import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const uploadEnabled = process.env.POSTHOG_SOURCEMAP_UPLOAD === 'true';

if (!uploadEnabled) {
  console.log('PostHog source-map upload skipped: POSTHOG_SOURCEMAP_UPLOAD is not true.');
  process.exit(0);
}

const requiredEnv = [
  'POSTHOG_CLI_API_KEY',
  'POSTHOG_CLI_PROJECT_ID',
  'NEXT_PUBLIC_POSTHOG_HOST',
] as const;
const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim());

if (missingEnv.length > 0) {
  console.error(`PostHog source-map upload requires: ${missingEnv.join(', ')}.`);
  process.exit(1);
}

const releaseVersion =
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim();

if (!releaseVersion) {
  console.error(
    'PostHog source-map upload requires VERCEL_GIT_COMMIT_SHA or NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.',
  );
  process.exit(1);
}

const chunksDirectory = path.join(process.cwd(), '.next', 'static', 'chunks');

if (!fs.existsSync(chunksDirectory)) {
  console.error(
    'PostHog source-map upload requires .next/static/chunks. Run pnpm run build first.',
  );
  process.exit(1);
}

const cliArgs = [
  'exec',
  'posthog-cli',
  '--host',
  process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
  'sourcemap',
  'process',
  '--directory',
  chunksDirectory,
  '--release-name',
  'nabatable-web',
  '--release-version',
  releaseVersion,
];

const result = spawnSync('pnpm', cliArgs, {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
