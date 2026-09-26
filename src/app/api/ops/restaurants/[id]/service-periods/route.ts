import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, internalError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { syncRestaurantServicePeriodsWithGoogleBusinessProfile } from '@/server/google-business-profile/service';
import { getOccasionCatalog } from '@/server/occasions/catalog';
import {
  authorizeAvailabilityAdmin,
  resolveAvailabilityRouteRestaurantId,
} from '@/server/restaurants/availabilityRouteAuth';
import { servicePeriodsPayloadSchema } from '@/server/restaurants/availabilitySchemas';
import {
  getServicePeriods,
  updateServicePeriods,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops.restaurants.service-periods';

const syncSchema = z.object({
  direction: z.enum(['pull_from_gbp', 'push_to_gbp']).optional(),
  selection: z
    .object({
      dayOfWeeks: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
  password: z.string().trim().min(1, 'Enter your password to confirm this GBP action.'),
});

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

function missingRestaurantId() {
  return apiError(400, 'RESTAURANT_ID_REQUIRED', 'Missing restaurant id.');
}

async function readJson(req: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await req.json() };
  } catch {
    return { ok: false };
  }
}

function invalidJson() {
  return apiError(400, 'INVALID_JSON', 'The request body must be JSON.');
}

function handleFailure(error: unknown, method: string, restaurantId: string) {
  if (error instanceof PasswordConfirmationError) {
    return apiError(error.status, error.code, error.message);
  }

  captureServerException(error, {
    properties: { source: 'ops', kind: 'restaurant-service-periods' },
  });

  // Domain validation throws plain Errors before any write; their text is never echoed.
  if (method !== 'GET' && error instanceof Error && error.name === 'Error') {
    return apiError(400, 'SETTINGS_REQUEST_FAILED', 'Unable to process these settings.');
  }
  return internalError(error, { route: ROUTE, method, restaurantId });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  try {
    const periods = await getServicePeriods(restaurantId);
    return NextResponse.json({ restaurantId, periods });
  } catch (error) {
    return handleFailure(error, 'GET', restaurantId);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  return withCsrfProtectedMutation(req, () => putServicePeriods(req, restaurantId));
}

async function putServicePeriods(req: NextRequest, restaurantId: string) {
  // Authorise first: the body is not parsed, and the occasion catalog is not read, for a caller
  // who may not change this restaurant.
  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  const json = await readJson(req);
  if (!json.ok) {
    return invalidJson();
  }
  const parsed = servicePeriodsPayloadSchema.safeParse(json.value);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const sanitizedPayload: UpdateServicePeriod[] = parsed.data.map((entry) => ({
    ...entry,
    bookingOption: entry.bookingOption.trim().toLowerCase(),
  }));

  try {
    const catalog = await getOccasionCatalog();
    const validKeys = new Set(
      catalog.definitions.map((definition) => definition.key.toLowerCase()),
    );
    const invalidIndex = sanitizedPayload.findIndex((entry) => !validKeys.has(entry.bookingOption));
    if (invalidIndex >= 0) {
      return apiError(400, 'UNKNOWN_BOOKING_TYPE', 'A meal time uses an unknown booking type.', {
        fields: { [`${invalidIndex}.bookingOption`]: ['Unknown booking type'] },
      });
    }

    const periods = await updateServicePeriods(restaurantId, sanitizedPayload);
    return NextResponse.json({ restaurantId, periods });
  } catch (error) {
    return handleFailure(error, 'PUT', restaurantId);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  return withCsrfProtectedMutation(req, () => postServicePeriods(req, restaurantId));
}

async function postServicePeriods(req: NextRequest, restaurantId: string) {
  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  const json = await readJson(req);
  if (!json.ok) {
    return invalidJson();
  }
  const parsed = syncSchema.safeParse(json.value);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const payload = parsed.data;

  if (payload.direction === 'push_to_gbp') {
    return apiError(
      410,
      'GBP_LEGACY_GOOGLE_WRITE_RETIRED',
      'Legacy Google Business Profile writes are retired.',
    );
  }

  try {
    await verifyUserPasswordConfirmation({
      email: actor.userEmail,
      password: payload.password,
    });

    const periods = await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
      restaurantId,
      direction: payload.direction,
      selection: payload.selection,
    });
    return NextResponse.json({ restaurantId, periods });
  } catch (error) {
    return handleFailure(error, 'POST', restaurantId);
  }
}
