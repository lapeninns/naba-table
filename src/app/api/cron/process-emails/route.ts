import { NextResponse } from 'next/server';

import { apiError, internalError, validationError } from '@/lib/api/errors';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { recordObservabilityEvent } from '@/server/observability';
import { reconcileDeliveryAnomalies } from '@/server/observability/delivery-reconciler';
import {
  EMAIL_JOB_TYPE_VALUES,
  type EmailJobType,
  triggerEmailQueueDrain,
} from '@/server/queue/email';
import { processEmailJobs, processEmailJobsRequestSchema } from '@/server/queue/email-processing';
import { drainMobileReviewIntents } from '@/server/queue/mobile-review-intents';
import { isEmailQueueEnabled } from '@/server/runtime-policy';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

const ROUTE = '/api/cron/process-emails';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'process-emails';
const MAX_EMAIL_DRAIN_JOBS = 100;
const MAX_EMAIL_POST_JOBS = 25;
const ALLOWED_TYPES: ReadonlySet<EmailJobType> = new Set(EMAIL_JOB_TYPE_VALUES);
const MAX_REPORTED_INVALID_TYPES = 10;
const MAX_REPORTED_TYPE_LENGTH = 64;

function parseTypeFilter(typesParam: string | null): {
  types: Set<EmailJobType> | null;
  invalidTypes?: string[];
} {
  if (!typesParam) {
    return { types: null };
  }

  const rawTypes = typesParam
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (rawTypes.length === 0) {
    return { types: null };
  }

  const invalidTypes = rawTypes.filter((value) => !ALLOWED_TYPES.has(value as EmailJobType));
  if (invalidTypes.length > 0) {
    return {
      types: null,
      invalidTypes: invalidTypes
        .slice(0, MAX_REPORTED_INVALID_TYPES)
        .map((value) => value.slice(0, MAX_REPORTED_TYPE_LENGTH)),
    };
  }

  return { types: new Set(rawTypes as EmailJobType[]) };
}

function clampLimit(value: number | null, max: number): number | null {
  if (!Number.isFinite(value) || !value || value <= 0) return null;
  return Math.min(Math.floor(value), max);
}

export async function GET(request: Request) {
  await flushPosthogLogsAfterResponse();
  return requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    const url = new URL(request.url);
    const { types: allowedTypes, invalidTypes } = parseTypeFilter(url.searchParams.get('types'));
    const maxJobsParam = url.searchParams.get('maxJobs');
    const requestedMaxJobs =
      typeof maxJobsParam === 'string' && maxJobsParam.trim().length > 0
        ? Number.parseInt(maxJobsParam, 10)
        : null;
    const maxJobs = clampLimit(requestedMaxJobs, MAX_EMAIL_DRAIN_JOBS);
    if (invalidTypes) {
      return apiError(400, 'UNSUPPORTED_EMAIL_TYPES', 'Unsupported email types.', {
        details: { invalidTypes, allowedTypes: EMAIL_JOB_TYPE_VALUES },
      });
    }

    try {
      await recordObservabilityEvent({
        source: 'cron.process-emails',
        eventType: 'drain.triggered',
        severity: 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
          maxJobs: maxJobs ?? null,
        },
      });

      const emailQueueEnabled = isEmailQueueEnabled();
      const [emailOutcome, mobileOutcome] = await Promise.allSettled([
        emailQueueEnabled
          ? triggerEmailQueueDrain({
              types: allowedTypes,
              maxJobs,
            })
          : Promise.resolve({
              success: true,
              message: 'Email queue is disabled',
              processed: 0,
              stats: { sent: 0, skipped: 0, failed: 0 },
              filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
            }),
        drainMobileReviewIntents({ maxJobs: maxJobs ?? MAX_EMAIL_DRAIN_JOBS }),
      ]);
      const result =
        emailOutcome.status === 'fulfilled'
          ? emailOutcome.value
          : {
              success: false,
              processed: 0,
              stats: { sent: 0, skipped: 0, failed: 1 },
            };
      const mobileReview =
        mobileOutcome.status === 'fulfilled'
          ? mobileOutcome.value
          : { processed: 0, sent: 0, skipped: 0, failed: 1 };
      const channels = {
        email: {
          success: emailOutcome.status === 'fulfilled',
          processed: result.processed ?? 0,
          stats: result.stats,
        },
        mobileReview: {
          success: mobileOutcome.status === 'fulfilled',
          ...mobileReview,
        },
      } as const;

      await recordObservabilityEvent({
        source: 'cron.process-emails',
        eventType: 'drain.completed',
        severity:
          emailOutcome.status === 'rejected' || mobileOutcome.status === 'rejected'
            ? 'error'
            : (result.stats?.failed ?? 0) > 0 || mobileReview.failed > 0
              ? 'warning'
              : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          processed: result.processed ?? 0,
          sent: result.stats?.sent ?? 0,
          skipped: result.stats?.skipped ?? 0,
          failed: result.stats?.failed ?? 0,
          mobileReviewProcessed: mobileReview.processed,
          mobileReviewSent: mobileReview.sent,
          mobileReviewSkipped: mobileReview.skipped,
          mobileReviewFailed: mobileReview.failed,
          filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
          maxJobs: maxJobs ?? null,
        },
      });

      let reconcileReport: Awaited<ReturnType<typeof reconcileDeliveryAnomalies>> | null = null;
      try {
        reconcileReport = await reconcileDeliveryAnomalies();
      } catch (reconcileError) {
        logger.warn('[cron][process-emails] delivery reconciliation failed', {
          route: ROUTE,
          jobName: auth.jobName,
          runId: auth.runId,
          error: sanitizeLogText(
            reconcileError instanceof Error ? reconcileError.message : String(reconcileError),
          ),
        });
      }

      if (emailOutcome.status === 'rejected' || mobileOutcome.status === 'rejected') {
        if (emailOutcome.status === 'rejected') {
          captureServerException(emailOutcome.reason, {
            properties: { jobName: auth.jobName, runId: auth.runId, source: 'cron.email' },
          });
        }
        if (mobileOutcome.status === 'rejected') {
          captureServerException(mobileOutcome.reason, {
            properties: {
              jobName: auth.jobName,
              runId: auth.runId,
              source: 'cron.mobile-review',
            },
          });
        }
        return NextResponse.json(
          {
            success: false,
            channels,
            reconciliation: reconcileReport,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({ ...result, channels, reconciliation: reconcileReport });
    } catch (error) {
      captureServerException(error, {
        properties: { jobName: auth.jobName, runId: auth.runId, source: 'cron' },
      });
      return internalError(
        error,
        { route: ROUTE, method: 'GET', jobName: auth.jobName, runId: auth.runId },
        'Cron email processing failed.',
      );
    }
  });
}

export async function POST(request: Request) {
  await flushPosthogLogsAfterResponse();
  return requireCronAuthAndRun(request, `${JOB_NAME}:post`, async (auth) => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      // Malformed JSON is a caller error, not a processing failure (it used to surface as a 500).
      return apiError(400, 'INVALID_REQUEST_BODY', 'Invalid request body.');
    }

    try {
      const parsed = processEmailJobsRequestSchema.safeParse(raw);

      if (!parsed.success) {
        return validationError(parsed.error, 'Invalid email job batch.');
      }

      const jobs = parsed.data.jobs.slice(0, MAX_EMAIL_POST_JOBS);
      await recordObservabilityEvent({
        source: 'cron.process-emails',
        eventType: 'batch.start',
        severity: 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          jobs: jobs.length,
          requestedJobs: parsed.data.jobs.length,
        },
      });

      const result = await processEmailJobs(jobs);

      await recordObservabilityEvent({
        source: 'cron.process-emails',
        eventType: 'batch.complete',
        severity: result.stats.failed > 0 ? 'warning' : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          processed: result.processed,
          sent: result.stats.sent,
          skipped: result.stats.skipped,
          failed: result.stats.failed,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Processed ${result.processed} jobs`,
        processed: result.processed,
        stats: result.stats,
        results: result.results,
      });
    } catch (error) {
      captureServerException(error, {
        properties: { jobName: auth.jobName, runId: auth.runId, source: 'cron' },
      });
      return internalError(
        error,
        { route: ROUTE, method: 'POST', jobName: auth.jobName, runId: auth.runId },
        'Cron email processing failed.',
      );
    }
  });
}
