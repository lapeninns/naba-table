import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, forbidden, unauthenticated, validationError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/strategies/simulate';

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

const payloadSchema = z.object({
  restaurantId: z.string().uuid(),
  strategies: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        weights: z.object({
          scarcity: z.number().min(0).max(1000).optional(),
          demandMultiplier: z.number().min(0).max(10).nullable().optional(),
          futureConflictPenalty: z.number().min(0).max(100000).nullable().optional(),
        }),
      }),
    )
    .min(1)
    .max(4),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    logger.warn('[ops/strategies/simulate][POST] auth lookup failed', {
      route: ROUTE,
      status: mapped.status,
    });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  const parsedPayload = payloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error);
  }

  const { restaurantId, strategies, notes } = parsedPayload.data;

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
  } catch (accessError) {
    logger.warn('[ops/strategies/simulate][POST] membership check failed', {
      route: ROUTE,
      errorName: errorName(accessError),
    });
    return forbidden();
  }

  const timestamp = new Date().toISOString();

  return NextResponse.json(
    {
      status: 'queued',
      restaurantId,
      receivedAt: timestamp,
      strategies: strategies.map((strategy) => ({
        key: strategy.key,
        label: strategy.label,
        weights: strategy.weights,
      })),
      notes: notes ?? null,
      message:
        'Simulation job scheduling is not yet implemented. This endpoint returns a placeholder response while the pipeline is defined.',
    },
    { status: 202 },
  );
}

export function GET() {
  return apiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', { headers: { Allow: 'POST' } });
}
