import { apiError, INTERNAL_ERROR_MESSAGE } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

const ROUTE = 'ops.restaurants.email-templates';

/**
 * 500 for the template routes. Logs only the error class (never the message, which can carry
 * database or provider text) and returns the fixed C1 body.
 */
export function templateRouteFailure(
  error: unknown,
  ctx: { operation: string; restaurantId?: string; stage?: string },
  message: string = INTERNAL_ERROR_MESSAGE,
) {
  logger.error('ops.restaurants.email-templates.failed', {
    route: ROUTE,
    ...ctx,
    errorName: error instanceof Error ? error.name : typeof error,
  });
  return apiError(500, 'INTERNAL_ERROR', message);
}

export function unknownTemplateKey() {
  return apiError(400, 'UNKNOWN_TEMPLATE_KEY', 'Unknown email template.');
}
