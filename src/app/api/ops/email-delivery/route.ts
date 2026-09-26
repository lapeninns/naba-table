import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from '@/server/auth/guards';
import {
  EmailDeliveryLogUnavailableError,
  getEmailDeliveryAttemptsSummary,
  listEmailDeliveryAttemptsForRestaurant,
} from '@/server/emails/email-delivery-log';
import {
  buildOpsEmailDeliveryRetryActionsFixture,
  isOpsEmailDeliveryFaultInjectionEnabled,
} from '@/server/emails/ops-email-delivery-dev-fixtures';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliveryFeedResponse,
  type OpsEmailDeliverySummaryResponse,
} from '@/types/emailDelivery';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/email-delivery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RANGE_VALUES = OPS_EMAIL_DELIVERY_RANGE_VALUES;
const STATUS_VALUES = EMAIL_DELIVERY_STATUS_VALUES;

const querySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  range: z.enum(RANGE_VALUES).default('7d'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  fixture: z.string().trim().min(1).optional(),
  simulateEmailDeliveryError: z.enum(['1']).optional(),
  recipientEmail: z.string().trim().min(1).optional(),
  messageId: z.string().trim().min(1).optional(),
  bookingRef: z.string().trim().min(1).optional(),
  templateType: z.string().trim().min(1).optional(),
  emailType: z.string().trim().min(1).optional(),
  summaryOnly: z.enum(['1']).optional(),
  stuckOnly: z.enum(['1']).optional(),
});

function jsonError(
  status: number,
  payload: Omit<Extract<OpsEmailDeliveryFeedResponse, { ok: false }>, 'ok'> & { message?: string },
) {
  return NextResponse.json(
    {
      ok: false,
      ...payload,
      message: payload.message ?? payload.error,
    } satisfies OpsEmailDeliveryFeedResponse & { message: string },
    { status },
  );
}

function parseStatuses(
  raw: string | null,
): { ok: true; statuses: EmailDeliveryStatus[] } | { ok: false } {
  if (!raw) {
    return { ok: true, statuses: [] };
  }

  const parts = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const allowed = new Set<string>(STATUS_VALUES);
  for (const value of parts) {
    if (!allowed.has(value)) {
      return { ok: false };
    }
  }

  return { ok: true, statuses: parts as EmailDeliveryStatus[] };
}

function emptySummary() {
  return {
    total: 0,
    sent: 0,
    delivered: 0,
    deliveryDelayed: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
    deliveredRate: 0,
    failureRate: 0,
    uniqueRecipients: 0,
    uniqueBookings: 0,
    p50DeliverySeconds: null,
    p95DeliverySeconds: null,
    topFailedTemplates: [],
    topFailedEmailTypes: [],
    stuckInFlight: 0,
  };
}

export async function GET(request: NextRequest) {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(entries);
  if (!parsedQuery.success) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid query' });
  }

  const rawStatus = request.nextUrl.searchParams.get('status');
  const statuses = parseStatuses(rawStatus);
  if (!statuses.ok) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid status filter' });
  }

  if (
    isOpsEmailDeliveryFaultInjectionEnabled() &&
    (parsedQuery.data.messageId === '__force_error__' ||
      parsedQuery.data.simulateEmailDeliveryError === '1')
  ) {
    return jsonError(418, {
      code: 'FORCED_ERROR',
      error: 'Forced delivery log error for dev/test validation.',
      message: 'Forced delivery log error for dev/test validation.',
    });
  }

  try {
    const { supabase, user } = await requireSession();

    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const fallbackRestaurantId =
      memberships.find(
        (membership) =>
          typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0,
      )?.restaurant_id ?? null;

    const restaurantId = parsedQuery.data.restaurantId ?? fallbackRestaurantId;

    if (!restaurantId) {
      return jsonError(403, { code: 'FORBIDDEN', error: 'No restaurant access' });
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId,
    });

    if (isOpsEmailDeliveryFaultInjectionEnabled() && parsedQuery.data.fixture === 'retry-actions') {
      return NextResponse.json(buildOpsEmailDeliveryRetryActionsFixture(restaurantId), {
        status: 200,
      });
    }

    const listResult = await listEmailDeliveryAttemptsForRestaurant({
      restaurantId,
      range: parsedQuery.data.range,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
      statuses: statuses.statuses.length > 0 ? statuses.statuses : undefined,
      recipientEmail: parsedQuery.data.recipientEmail,
      messageId: parsedQuery.data.messageId,
      bookingRef: parsedQuery.data.bookingRef
        ? parsedQuery.data.bookingRef.toUpperCase()
        : undefined,
      templateType: parsedQuery.data.templateType,
      emailType: parsedQuery.data.emailType,
      stuckOnly: parsedQuery.data.stuckOnly === '1',
    });

    let summary: Extract<OpsEmailDeliveryFeedResponse, { ok: true }>['summary'] = undefined;
    if (listResult.page === 1 || parsedQuery.data.summaryOnly === '1') {
      try {
        summary = await getEmailDeliveryAttemptsSummary({
          restaurantId,
          range: parsedQuery.data.range,
          statuses: statuses.statuses.length > 0 ? statuses.statuses : undefined,
          recipientEmail: parsedQuery.data.recipientEmail,
          messageId: parsedQuery.data.messageId,
          bookingRef: parsedQuery.data.bookingRef
            ? parsedQuery.data.bookingRef.toUpperCase()
            : undefined,
          templateType: parsedQuery.data.templateType,
          emailType: parsedQuery.data.emailType,
        });
      } catch (error) {
        logger.error('[ops/email-delivery] failed to compute summary', {
          route: ROUTE,
          restaurantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (parsedQuery.data.summaryOnly === '1') {
      return NextResponse.json(
        {
          ok: true,
          restaurantId,
          range: parsedQuery.data.range,
          summary: summary ?? emptySummary(),
        } satisfies Extract<OpsEmailDeliverySummaryResponse, { ok: true }>,
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        restaurantId,
        range: parsedQuery.data.range,
        pageInfo: {
          page: listResult.page,
          pageSize: listResult.pageSize,
          hasNext: listResult.hasNext,
        },
        attempts: listResult.attempts,
        ...(summary ? { summary } : {}),
      } satisfies Extract<OpsEmailDeliveryFeedResponse, { ok: true }>,
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      const mapped =
        error.code === 'UNAUTHENTICATED'
          ? { status: 401 as const, code: 'UNAUTHENTICATED' as const, error: error.message }
          : error.code === 'FORBIDDEN'
            ? { status: 403 as const, code: 'FORBIDDEN' as const, error: error.message }
            : {
                status: error.status as 401 | 403 | 500,
                code: 'INTERNAL' as const,
                error: error.message,
              };
      return jsonError(mapped.status, { code: mapped.code, error: mapped.error });
    }

    if (error instanceof EmailDeliveryLogUnavailableError) {
      return jsonError(503, {
        code: 'DELIVERY_LOG_UNAVAILABLE',
        error: 'Delivery tracking is temporarily unavailable',
      });
    }

    logger.error('[ops/email-delivery] unexpected error', {
      route: ROUTE,
      error: error instanceof Error ? error.message : String(error),
    });
    captureServerException(error, { properties: { source: 'ops', kind: 'email-delivery' } });
    return jsonError(500, { code: 'INTERNAL', error: 'Internal error' });
  }
}
