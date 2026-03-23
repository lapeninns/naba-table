import { NextResponse } from 'next/server';

import { isEmailQueueEnabled } from '@/server/feature-flags';
import { recordObservabilityEvent } from '@/server/observability';
import {
  type EmailJobType,
  isEmailQueueGatewayConfigured,
  triggerEmailQueueDrain,
} from '@/server/queue/email';
import {
  processEmailJobs,
  processEmailJobsRequestSchema,
} from '@/server/queue/email-processing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;
const REVIEW_ONLY_TYPES: ReadonlySet<EmailJobType> = new Set(['review_request']);

function parseTypeFilter(typesParam: string | null): { types: Set<EmailJobType> | null; error?: string } {
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

  const invalidTypes = rawTypes.filter((value) => !REVIEW_ONLY_TYPES.has(value as EmailJobType));
  if (invalidTypes.length > 0) {
    return {
      types: null,
      error: `Unsupported email types: ${invalidTypes.join(', ')}. Only review_request is allowed.`,
    };
  }

  return { types: new Set(rawTypes as EmailJobType[]) };
}

function authorizeRequest(request: Request): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (CRON_SECRET && !hasValidBearerToken) {
    console.warn('[cron][process-emails] Unauthorized request', {
      hasAuthHeader: Boolean(authHeader),
      hasCronSecret: Boolean(CRON_SECRET),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!CRON_SECRET) {
    console.warn('[cron][process-emails] CRON_SECRET not set - endpoint is unprotected');
  }

  return null;
}

export async function GET(request: Request) {
  const authFailure = authorizeRequest(request);
  if (authFailure) {
    return authFailure;
  }

  const url = new URL(request.url);
  const { types: allowedTypes, error: typesError } = parseTypeFilter(url.searchParams.get('types'));
  const maxJobsParam = url.searchParams.get('maxJobs');
  const maxJobs =
    typeof maxJobsParam === 'string' && maxJobsParam.trim().length > 0
      ? Number.parseInt(maxJobsParam, 10)
      : null;
  if (typesError) {
    return NextResponse.json({ error: typesError }, { status: 400 });
  }

  if (!isEmailQueueEnabled()) {
    return NextResponse.json({
      success: true,
      message: 'Email queue is disabled',
      processed: 0,
      filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
    });
  }

  if (!isEmailQueueGatewayConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Cloudflare email queue gateway is not configured. Set CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL and CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN.',
      },
      { status: 503 },
    );
  }

  try {
    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'drain.triggered',
      severity: 'info',
      context: {
        filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
      },
    });

    const result = await triggerEmailQueueDrain({
      types: allowedTypes,
      maxJobs: Number.isFinite(maxJobs) && maxJobs && maxJobs > 0 ? maxJobs : null,
    });

    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'drain.completed',
      severity: (result.stats?.failed ?? 0) > 0 ? 'warning' : 'info',
      context: {
        processed: result.processed ?? 0,
        sent: result.stats?.sent ?? 0,
        skipped: result.stats?.skipped ?? 0,
        failed: result.stats?.failed ?? 0,
        filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[cron][process-emails] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authFailure = authorizeRequest(request);
  if (authFailure) {
    return authFailure;
  }

  try {
    const raw = (await request.json()) as unknown;
    const parsed = processEmailJobsRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((issue) => issue.message).join('; '),
        },
        { status: 400 },
      );
    }

    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'batch.start',
      severity: 'info',
      context: {
        jobs: parsed.data.jobs.length,
      },
    });

    const result = await processEmailJobs(parsed.data.jobs);

    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'batch.complete',
      severity: result.stats.failed > 0 ? 'warning' : 'info',
      context: {
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
    console.error('[cron][process-emails] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
