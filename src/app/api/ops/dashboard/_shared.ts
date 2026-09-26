import { apiError, internalError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';

import type { NextResponse } from 'next/server';

export async function requireDashboardAccess(restaurantId: string): Promise<void> {
  const { supabase, user } = await requireSession();
  await requireRestaurantMember({
    supabase,
    userId: user.id,
    restaurantId,
  });
}

export function buildDashboardAccessErrorResponse(scope: string, error: unknown): NextResponse {
  if (error instanceof GuardError) {
    // Guard messages are authored copy; guard details can carry provider text, so only
    // the status and code are logged.
    logger.warn(`[ops/dashboard][${scope}] access validation failed`, {
      status: error.status,
      errorKind: error.code,
    });
    const retryable = error.status === 503;
    return apiError(error.status, error.code, error.message, {
      ...(retryable ? { retryable: true, retryAfter: 30, headers: { 'Retry-After': '30' } } : {}),
    });
  }

  return internalError(
    error,
    { route: `ops/dashboard/${scope}`, phase: 'access-validation' },
    'Unable to verify access',
  );
}
