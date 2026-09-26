import 'server-only';

import { internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';

type OnboardingErrorContext = {
  route: string;
  userId?: string | null;
  restaurantId?: string | null;
};

/**
 * C1 500 for onboarding routes: reports the exception to PostHog (as the routes did
 * before), logs it through lib/logger and returns the generic safe message.
 */
export function onboardingInternalError(
  error: unknown,
  ctx: OnboardingErrorContext,
  message?: string,
) {
  captureServerException(error, {
    distinctId: ctx.userId ?? undefined,
    groups: ctx.restaurantId ? { restaurant: ctx.restaurantId } : undefined,
    properties: {
      restaurantId: ctx.restaurantId ?? undefined,
      source: 'api',
      kind: ctx.route,
    },
  });
  return internalError(
    error,
    { route: ctx.route, restaurantId: ctx.restaurantId ?? undefined },
    message,
  );
}
