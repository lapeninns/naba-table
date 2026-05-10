import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { redactSmsRecipientPhone } from '@/lib/sms/phone-redaction';
import { sendTwilioSmsMessage } from '@/lib/twilio/sms';

const projectRoot = process.cwd();
const DEFAULT_BODY = 'Nabatable staging SMS delivery smoke test.';
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

type Args = {
  target: 'staging';
  send: boolean;
  to: string | null;
  body: string;
  callbackBaseUrl: string | null;
  skipPulledEnvFiles: boolean;
  skipLocalEnvFiles: boolean;
  requirePreviewAudit: boolean;
};

type EnvCheck = {
  key: string;
  present: boolean;
};

type SmokeReport = {
  ok: boolean;
  dryRun: boolean;
  target: 'staging';
  checkedAt: string;
  recipientPhone: string | null;
  bodyLength: number;
  callbackUrl: string | null;
  env: EnvCheck[];
  blockers: string[];
  result: {
    messageSid: string | null;
    status: string | null;
  } | null;
};

export function parseStagingSmokeArgs(argv: string[]): Args {
  const args: Args = {
    target: 'staging',
    send: false,
    to: null,
    body: DEFAULT_BODY,
    callbackBaseUrl: null,
    skipPulledEnvFiles: false,
    skipLocalEnvFiles: false,
    requirePreviewAudit: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? '';
    if (raw === '--send') {
      args.send = true;
      continue;
    }
    if (raw === '--skip-pulled-env-files') {
      args.skipPulledEnvFiles = true;
      continue;
    }
    if (raw === '--skip-local-env-files') {
      args.skipLocalEnvFiles = true;
      continue;
    }
    if (raw === '--require-preview-audit') {
      args.requirePreviewAudit = true;
      continue;
    }

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

    const target = takeValue('--target');
    if (target) {
      if (target !== 'staging') {
        throw new Error('Only --target staging is supported for SMS delivery smoke tests.');
      }
      args.target = 'staging';
      continue;
    }

    const to = takeValue('--to');
    if (to) {
      args.to = to.trim();
      continue;
    }

    const body = takeValue('--body');
    if (body) {
      args.body = body;
      continue;
    }

    const callbackBaseUrl = takeValue('--callback-base-url');
    if (callbackBaseUrl) {
      args.callbackBaseUrl = callbackBaseUrl.trim();
    }
  }

  return args;
}

function loadEnvFile(relativePath: string, override: boolean) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    loadEnv({ path: absolutePath, override, quiet: true });
  }
}

function loadStagingEnv(options: { skipPulledEnvFiles: boolean; skipLocalEnvFiles: boolean }) {
  if (!options.skipLocalEnvFiles) {
    loadEnvFile('.env.local', false);
  }
  if (!options.skipPulledEnvFiles) {
    loadEnvFile('.env.vercel.preview', true);
  }
  if (!options.skipLocalEnvFiles) {
    loadEnvFile('.env.sms-delivery-readiness.local', true);
  }
}

function hasTemplatePlaceholder(value: string): boolean {
  return /\$\{[^}]+\}/.test(value);
}

export function resolveStagingSmokeUrlTemplate(value: string | null): string | null {
  if (!value) return null;
  if (!value.includes('${VERCEL_URL}')) return value;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl || hasTemplatePlaceholder(vercelUrl)) return value;

  return value.replaceAll('${VERCEL_URL}', vercelUrl);
}

export function isConcreteHttpUrl(value: string | null): boolean {
  if (!value || hasTemplatePlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildStagingSmokeCallbackUrl(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  return new URL('/api/webhook/twilio/sms-status', baseUrl).toString();
}

function envPresent(keys: readonly string[]): EnvCheck[] {
  return keys.map((key) => ({
    key,
    present: Boolean(process.env[key]?.trim()),
  }));
}

export function shouldRunPreviewAuditBeforeSmokeSend(input: {
  send: boolean;
  requirePreviewAudit: boolean;
  blockers: readonly string[];
}): boolean {
  return input.send && input.requirePreviewAudit && input.blockers.length === 0;
}

function runPreviewAudit() {
  const result = spawnSync('pnpm', ['run', 'sms:delivery:audit:staging-vercel-preview'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  if (exitCode !== 0) {
    throw new Error(`Preview audit failed with exit code ${exitCode}; refusing live SMS smoke.`);
  }
}

function runPreviewDeploymentCheck() {
  const result = spawnSync('pnpm', ['run', 'sms:delivery:deployment:preview'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  if (exitCode !== 0) {
    throw new Error(
      `Preview deployment freshness check failed with exit code ${exitCode}; refusing live SMS smoke.`,
    );
  }
}

async function main() {
  const args = parseStagingSmokeArgs(process.argv.slice(2));
  loadStagingEnv({
    skipPulledEnvFiles: args.skipPulledEnvFiles,
    skipLocalEnvFiles: args.skipLocalEnvFiles,
  });

  const requiredEnv = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_API_KEY_SID',
    'TWILIO_API_KEY_SECRET',
    'TWILIO_MESSAGING_SERVICE_SID',
  ] as const;
  const env = envPresent(requiredEnv);
  const missingEnv = env.filter((check) => !check.present).map((check) => check.key);
  const rawCallbackBaseUrl =
    args.callbackBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    null;
  const callbackBaseUrl = resolveStagingSmokeUrlTemplate(rawCallbackBaseUrl);
  const callbackUrl = isConcreteHttpUrl(callbackBaseUrl)
    ? buildStagingSmokeCallbackUrl(callbackBaseUrl)
    : null;

  const blockers: string[] = [];
  if (!args.to) {
    blockers.push('--to must be provided with a staging test recipient in E.164 format.');
  } else if (!E164_PATTERN.test(args.to)) {
    blockers.push('--to must be a valid E.164 phone number, for example +447700900000.');
  }
  if (args.body.trim().length === 0) {
    blockers.push('--body must not be empty.');
  }
  if (!callbackUrl) {
    blockers.push(
      '--callback-base-url or NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL must be a concrete http(s) URL.',
    );
  }
  for (const key of missingEnv) {
    blockers.push(`staging env missing: ${key}`);
  }

  let result: SmokeReport['result'] = null;
  if (args.send) {
    if (blockers.length > 0) {
      throw new Error(`Refusing to send staging SMS smoke test: ${blockers.join('; ')}`);
    }
    if (
      shouldRunPreviewAuditBeforeSmokeSend({
        send: args.send,
        requirePreviewAudit: args.requirePreviewAudit,
        blockers,
      })
    ) {
      runPreviewAudit();
      runPreviewDeploymentCheck();
    }

    result = await sendTwilioSmsMessage({
      accountSid: process.env.TWILIO_ACCOUNT_SID as string,
      apiKeySid: process.env.TWILIO_API_KEY_SID as string,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET as string,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID as string,
      statusCallback: callbackUrl ?? undefined,
      shortenUrls: process.env.TWILIO_SHORTEN_URLS === 'true',
      to: args.to as string,
      body: args.body,
    });
  }

  const report: SmokeReport = {
    ok: blockers.length === 0 && (!args.send || Boolean(result?.messageSid)),
    dryRun: !args.send,
    target: args.target,
    checkedAt: new Date().toISOString(),
    recipientPhone: args.to ? redactSmsRecipientPhone(args.to) : null,
    bodyLength: args.body.length,
    callbackUrl,
    env,
    blockers,
    result,
  };

  console.log(JSON.stringify(report, null, 2));
  if (blockers.length > 0 || (args.send && !result?.messageSid)) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      '[sms-delivery-staging-smoke] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
