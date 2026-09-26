import { NextResponse } from 'next/server';

import { updateRestaurantSchema } from '@/app/api/ops/restaurants/schema';
import { apiError, conflict, validationError } from '@/lib/api/errors';
import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { onboardingInternalError } from '@/server/onboarding/errors';
import { OnboardingSlugTakenError, updateOnboardingProfile } from '@/server/onboarding/profile';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const ROUTE = 'onboarding.restaurant.profile';
const SLUG_TAKEN_MESSAGE = 'That web address is taken. Try a different slug.';
const TIMEZONE_MESSAGE = 'Choose a valid timezone.';

// The profile fields the onboarding wizard edits, with the same rules as the ops update.
const requestSchema = updateRestaurantSchema
  .pick({
    name: true,
    slug: true,
    timezone: true,
    contactEmail: true,
    contactPhone: true,
    bookingPolicy: true,
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.values(value).every((field) => field === undefined)) {
      context.addIssue({ code: 'custom', path: [], message: 'Nothing to update.' });
    }
  });

/**
 * Onboarding profile update, used when the owner goes Back to the profile step after the
 * restaurant exists (the create route refuses a second restaurant). The wizard sends only
 * the fields that changed. Validation, a clashing slug and an invalid timezone come back as
 * C1 4xx bodies with field paths so the form can show them.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const authorization = await withRestaurantAuthorization(req, restaurantId, {
    csrf: true,
    roles: RESTAURANT_ADMIN_ROLES,
  });
  if (!authorization.ok) {
    return authorization.response;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'onboarding:profile',
    tenantId: restaurantId,
    userId: authorization.user.id,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many profile updates. Please try again in a moment.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const patch = parsed.data;
  if (patch.timezone !== undefined) {
    try {
      patch.timezone = assertValidTimezone(patch.timezone);
    } catch {
      return apiError(400, 'VALIDATION_FAILED', TIMEZONE_MESSAGE, {
        fields: { timezone: [TIMEZONE_MESSAGE] },
      });
    }
  }

  try {
    const restaurant = await updateOnboardingProfile(
      restaurantId,
      patch,
      getServiceSupabaseClient(),
    );
    return NextResponse.json({ restaurant });
  } catch (updateError) {
    if (updateError instanceof OnboardingSlugTakenError) {
      return conflict('SLUG_TAKEN', SLUG_TAKEN_MESSAGE, {
        fields: { slug: [SLUG_TAKEN_MESSAGE] },
      });
    }
    return onboardingInternalError(
      updateError,
      { route: ROUTE, restaurantId, userId: authorization.user.id },
      "We couldn't save your restaurant profile. Try again.",
    );
  }
}
