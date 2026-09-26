import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, internalError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { syncRestaurantOperatingHoursWithGoogleBusinessProfile } from '@/server/google-business-profile/service';
import {
  authorizeAvailabilityAdmin,
  resolveAvailabilityRouteRestaurantId,
} from '@/server/restaurants/availabilityRouteAuth';
import { operatingHoursPayloadSchema } from '@/server/restaurants/availabilitySchemas';
import {
  getOperatingHours,
  updateOperatingHours,
  type UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops.restaurants.hours';

const syncSelectionSchema = z
  .object({
    weeklyDays: z.array(z.number().int().min(0).max(6)).optional(),
    overrideDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  })
  .optional();

const syncSchema = z.object({
  direction: z.enum(['pull_from_gbp', 'push_to_gbp']).optional(),
  selection: syncSelectionSchema,
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

  captureServerException(error, { properties: { source: 'ops', kind: 'restaurant-hours' } });

  // Validation in the domain layer throws plain Errors before any write; database failures are
  // also plain Errors. Neither message is echoed. A write that failed validation is a 400, and
  // everything else a 500, both with fixed copy.
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
    const snapshot = await getOperatingHours(restaurantId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleFailure(error, 'GET', restaurantId);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  return withCsrfProtectedMutation(req, () => putOperatingHours(req, restaurantId));
}

async function putOperatingHours(req: NextRequest, restaurantId: string) {
  // Authorise before reading the body: an unauthorised caller learns nothing about validation.
  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  const json = await readJson(req);
  if (!json.ok) {
    return invalidJson();
  }
  const parsed = operatingHoursPayloadSchema.safeParse(json.value);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const payload: UpdateOperatingHoursPayload = parsed.data;

  try {
    const snapshot = await updateOperatingHours(restaurantId, payload);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleFailure(error, 'PUT', restaurantId);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  return withCsrfProtectedMutation(req, () => postOperatingHours(req, restaurantId));
}

async function postOperatingHours(req: NextRequest, restaurantId: string) {
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

    const snapshot = await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
      restaurantId,
      direction: payload.direction,
      selection: payload.selection,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleFailure(error, 'POST', restaurantId);
  }
}
