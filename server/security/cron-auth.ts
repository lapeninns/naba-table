import { NextResponse } from 'next/server';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { recordSecurityEvent } from '@/server/security/events';
import { consumeRateLimit } from '@/server/security/rate-limit';

import type { NextRequest } from 'next/server';

const DEFAULT_RATE_LIMIT = 20;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

type CronRequest = Request | NextRequest;

export type CronAuthSuccess = {
  ok: true;
  jobName: string;
  runId: string;
};

export type CronAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type CronAuthResult = CronAuthSuccess | CronAuthFailure;

const activeJobs = new Set<string>();

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(sha256(left), sha256(right));
}

function parseSecretList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((secret) => secret.trim())
    .filter((secret) => secret.length > 0);
}

export function getCronAuthSecrets(): string[] {
  const secrets = [
    ...parseSecretList(process.env.CRON_SECRETS),
    ...parseSecretList(process.env.CRON_SECRET),
    ...parseSecretList(process.env.CRON_SECRET_PREVIOUS),
  ];
  return Array.from(new Set(secrets));
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() || null;
}

function hasValidCronToken(token: string | null, secrets: ReadonlyArray<string>): boolean {
  if (!token) return false;
  return secrets.some((secret) => constantTimeEqual(token, secret));
}

function cronJson(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function logCronAuthFailure(
  jobName: string,
  reason: 'missing_secret' | 'unauthorized' | 'rate_limited' | 'rate_limit_unavailable',
  request: CronRequest,
): void {
  console.warn('[cron][auth] request rejected', {
    jobName,
    reason,
    method: request.method,
    hasAuthHeader: Boolean(request.headers.get('authorization')),
  });
  void recordSecurityEvent({
    eventType: reason === 'rate_limited' ? 'rate_limit_exceeded' : 'cron_auth_failure',
    source: 'server.security.cron-auth',
    severity:
      reason === 'missing_secret' || reason === 'rate_limit_unavailable' ? 'error' : 'warning',
    context: {
      jobName,
      reason,
      method: request.method,
      hasAuthHeader: Boolean(request.headers.get('authorization')),
    },
  });
}

export async function requireCronAuth(
  request: CronRequest,
  jobName: string,
): Promise<CronAuthResult> {
  const secrets = getCronAuthSecrets();
  if (secrets.length === 0) {
    logCronAuthFailure(jobName, 'missing_secret', request);
    return {
      ok: false,
      response: cronJson('Cron authentication is not configured.', 503),
    };
  }

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!hasValidCronToken(token, secrets)) {
    logCronAuthFailure(jobName, 'unauthorized', request);
    return {
      ok: false,
      response: cronJson('Unauthorized', 401),
    };
  }

  try {
    const rateLimit = await consumeRateLimit({
      identifier: `cron:${jobName}`,
      limit: DEFAULT_RATE_LIMIT,
      windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      logCronAuthFailure(jobName, 'rate_limited', request);
      return {
        ok: false,
        response: cronJson('Too many cron requests.', 429),
      };
    }
  } catch (error) {
    console.error('[cron][auth] rate limit unavailable', {
      jobName,
      message: error instanceof Error ? error.message : String(error),
    });
    logCronAuthFailure(jobName, 'rate_limit_unavailable', request);
    return {
      ok: false,
      response: cronJson('Cron rate limit is unavailable.', 503),
    };
  }

  return {
    ok: true,
    jobName,
    runId: randomUUID(),
  };
}

export async function runWithCronExecutionLock(
  auth: CronAuthSuccess,
  work: () => Promise<NextResponse>,
): Promise<NextResponse> {
  if (activeJobs.has(auth.jobName)) {
    console.warn('[cron][lock] request rejected', {
      jobName: auth.jobName,
      runId: auth.runId,
      reason: 'already_running',
    });
    return cronJson('Cron job is already running.', 409);
  }

  activeJobs.add(auth.jobName);
  console.info('[cron][lock] acquired', {
    jobName: auth.jobName,
    runId: auth.runId,
  });

  try {
    return await work();
  } finally {
    activeJobs.delete(auth.jobName);
    console.info('[cron][lock] released', {
      jobName: auth.jobName,
      runId: auth.runId,
    });
  }
}

export async function requireCronAuthAndRun(
  request: CronRequest,
  jobName: string,
  work: (auth: CronAuthSuccess) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await requireCronAuth(request, jobName);
  if (!auth.ok) {
    return auth.response;
  }

  return runWithCronExecutionLock(auth, () => work(auth));
}
