import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { buildGitHubDispatchRequest, parseErrorInsight } from '@/lib/observability/error-insight';
import { resolveRequestCorrelationId } from '@/lib/observability/request-correlation';
import { captureServerEvent } from '@/lib/posthog/server';
import { stripUrlQueryAndHash } from '@/lib/security/url-redaction';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

import {
  computeServerClientErrorFingerprint,
  GENERIC_SCRIPT_ERROR_PATTERN,
  MAX_CLIENT_ERROR_BODY_BYTES,
  parseClientErrorPayload,
  registerAnalyticsFingerprint,
  shouldCaptureClientErrorAnalytics,
  SUPABASE_USER_ID_PATTERN,
  type ClientErrorPayload,
} from './report-handling';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/u;

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function dispatchClientErrorInsight(
  request: NextRequest,
  clientError: ClientErrorPayload,
): Promise<void> {
  const token = process.env.ERROR_INSIGHT_GITHUB_TOKEN?.trim() ?? '';
  if (!token) return;

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const traceId =
    request.headers.get('traceparent')?.toLowerCase().match(TRACEPARENT_PATTERN)?.[1] ?? requestId;
  const insight = parseErrorInsight({
    service: 'nabatable-web',
    event: 'web.client.failed',
    fields: {
      traceId,
      requestId,
      deploySha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
      method: 'POST',
      path: stripUrlQueryAndHash(clientError.path ?? '/unknown'),
    },
  });
  if (!insight) return;

  const dispatch = buildGitHubDispatchRequest(insight, {
    token,
    repository: process.env.ERROR_INSIGHT_GITHUB_REPOSITORY ?? 'lapeninns/nabatable',
  });
  const response = await fetch(dispatch.url, dispatch.init);
  if (!response.ok) throw new Error(`GitHub dispatch returned ${response.status}.`);
}

export async function POST(req: NextRequest) {
  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'client-error',
    limit: 30,
    windowMs: 60_000,
    message: 'Too many client error reports',
  });
  if (rateLimit) {
    return rateLimit;
  }

  const contentLength = parseContentLength(req.headers.get('content-length'));
  if (contentLength !== null && contentLength > MAX_CLIENT_ERROR_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_CLIENT_ERROR_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let payload: unknown = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      logger.warn('client error report rejected', {
        error,
        reason: 'invalid_json',
      });
      return NextResponse.json({ error: 'Invalid client error report' }, { status: 400 });
    }

    const clientError = parseClientErrorPayload(payload);
    if (!clientError) {
      logger.warn('client error report rejected', {
        reason: 'invalid_payload',
      });
      return NextResponse.json({ error: 'Invalid client error report' }, { status: 400 });
    }

    const correlationId = resolveRequestCorrelationId(req.headers);
    const fingerprint = computeServerClientErrorFingerprint({
      type: clientError.type,
      message: clientError.message ?? '',
      stack: clientError.stack,
      path: clientError.path ?? 'unknown',
    });
    const isGenericScriptError =
      GENERIC_SCRIPT_ERROR_PATTERN.test((clientError.message ?? '').trim()) && !clientError.stack;

    if (isGenericScriptError) {
      // Cross-origin "Script error." with no stack has no actionable context;
      // keep a warn-level trace but never an analytics event.
      logger.warn('client error report (generic script error)', {
        path: clientError.path,
        fingerprint,
        correlationId,
      });
    } else {
      logger.error('client error report', { ...clientError, fingerprint, correlationId });

      // Analytics only after the server accepted and validated the report, so
      // client_error_reported can never disagree with the Logs record.
      if (shouldCaptureClientErrorAnalytics(req.headers)) {
        const dedupe = registerAnalyticsFingerprint(fingerprint, Date.now());
        if (dedupe.count === 1) {
          const distinctId =
            clientError.userId && SUPABASE_USER_ID_PATTERN.test(clientError.userId)
              ? clientError.userId
              : undefined;
          captureServerEvent(
            'client_error_reported',
            {
              type: clientError.type,
              path: stripUrlQueryAndHash(clientError.path ?? 'unknown'),
              fingerprint,
            },
            { distinctId, correlationId },
          );
        }
      }
    }

    await dispatchClientErrorInsight(req, clientError).catch((error) => {
      logger.warn('client error insight dispatch failed', { error });
    });
  } catch (error) {
    logger.error('client error report failed', { error });
  }

  await flushPosthogLogsAfterResponse();
  return NextResponse.json({ ok: true }, { status: 200 });
}
