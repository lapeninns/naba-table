import { NextResponse } from 'next/server';
import { z } from 'zod';

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
} from '@/server/emails/email-delivery-log';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliverySummaryResponse,
} from '@/types/emailDelivery';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  range: z.enum(OPS_EMAIL_DELIVERY_RANGE_VALUES).default('7d'),
  recipientEmail: z.string().trim().min(1).optional(),
  messageId: z.string().trim().min(1).optional(),
  bookingRef: z.string().trim().min(1).optional(),
  templateType: z.string().trim().min(1).optional(),
  emailType: z.string().trim().min(1).optional(),
});

function parseStatuses(
  raw: string | null,
): { ok: true; statuses: EmailDeliveryStatus[] } | { ok: false } {
  if (!raw) return { ok: true, statuses: [] };
  const parts = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const allowed = new Set<string>(EMAIL_DELIVERY_STATUS_VALUES);
  for (const value of parts) {
    if (!allowed.has(value)) return { ok: false };
  }
  return { ok: true, statuses: parts as EmailDeliveryStatus[] };
}

function jsonError(
  status: number,
  code: Extract<OpsEmailDeliverySummaryResponse, { ok: false }>['code'],
  error: string,
) {
  return NextResponse.json(
    { ok: false, code, error, message: error } satisfies OpsEmailDeliverySummaryResponse & {
      message: string;
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(entries);
  if (!parsedQuery.success) {
    return jsonError(400, 'INTERNAL', 'Invalid query');
  }

  const statuses = parseStatuses(request.nextUrl.searchParams.get('status'));
  if (!statuses.ok) {
    return jsonError(400, 'INTERNAL', 'Invalid status filter');
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
      return jsonError(403, 'FORBIDDEN', 'No restaurant access');
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId,
    });

    const summary = await getEmailDeliveryAttemptsSummary({
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

    return NextResponse.json(
      {
        ok: true,
        restaurantId,
        range: parsedQuery.data.range,
        summary,
      } satisfies Extract<OpsEmailDeliverySummaryResponse, { ok: true }>,
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      if (error.code === 'UNAUTHENTICATED') {
        return jsonError(401, 'UNAUTHENTICATED', error.message);
      }
      if (error.code === 'FORBIDDEN') {
        return jsonError(403, 'FORBIDDEN', error.message);
      }
      return jsonError(error.status, 'INTERNAL', error.message);
    }

    if (error instanceof EmailDeliveryLogUnavailableError) {
      return jsonError(503, 'DELIVERY_LOG_UNAVAILABLE', 'Delivery tracking is temporarily unavailable');
    }

    captureServerException(error, {
      properties: { source: 'ops', kind: 'email-delivery-summary' },
    });
    return jsonError(500, 'INTERNAL', 'Internal error');
  }
}
