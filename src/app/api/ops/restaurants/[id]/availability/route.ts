import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, conflict, internalError, notFound, validationError } from '@/lib/api/errors';
import {
  AvailabilityCommandError,
  getAvailabilitySnapshot,
  saveRestaurantAvailability,
} from '@/server/restaurants/availabilityCommand';
import {
  authorizeAvailabilityAdmin,
  resolveAvailabilityRouteRestaurantId,
} from '@/server/restaurants/availabilityRouteAuth';
import {
  operatingHoursPayloadSchema,
  servicePeriodsPayloadSchema,
  turnBandsPayloadSchema,
} from '@/server/restaurants/availabilitySchemas';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import { updateRestaurantSchema } from '../../schema';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops.restaurants.availability';

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

/** The booking-rule fields of the restaurant PATCH, with the same limits. */
const rulesSchema = updateRestaurantSchema
  .pick({
    bookingPolicy: true,
    reservationIntervalMinutes: true,
    reservationDefaultDurationMinutes: true,
    reservationLastSeatingBufferMinutes: true,
    reservationLifecycleGraceMinutes: true,
  })
  .strict();

const revisionSchema = z.string().regex(/^[0-9a-f]{32}$/, 'Revision must come from this page.');

/**
 * PUT body. Each part present replaces that resource; absent parts are untouched. Parts are
 * validated with the same schemas as the single-resource routes.
 */
const commandSchema = z
  .object({
    hours: operatingHoursPayloadSchema.optional(),
    servicePeriods: servicePeriodsPayloadSchema.optional(),
    turnBands: turnBandsPayloadSchema.optional(),
    rules: rulesSchema.optional(),
    expectedRevision: revisionSchema.optional(),
    /** Per-section revisions; only the sections this save writes are checked. */
    expectedRevisions: z
      .object({
        hours: revisionSchema.optional(),
        servicePeriods: revisionSchema.optional(),
        turnBands: revisionSchema.optional(),
        rules: revisionSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.hours !== undefined ||
      value.servicePeriods !== undefined ||
      value.turnBands !== undefined ||
      (value.rules !== undefined && Object.keys(value.rules).length > 0),
    { message: 'Send at least one of hours, servicePeriods, turnBands or rules.' },
  );

function commandErrorResponse(error: AvailabilityCommandError) {
  const details = error.part ? { part: error.part } : undefined;
  switch (error.status) {
    case 409:
      return conflict(error.code, error.message);
    case 404:
      return notFound(error.code, error.message);
    default:
      return apiError(400, error.code, error.message, { details });
  }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'RESTAURANT_ID_REQUIRED', 'Missing restaurant id.');
  }

  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  try {
    // Rows and revision from one read: the page builds its draft from exactly the state the
    // revision describes, so a save made from it is refused (STALE_WRITE) once anything changed.
    const snapshot = await getAvailabilitySnapshot(restaurantId);
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof AvailabilityCommandError) {
      return commandErrorResponse(error);
    }
    return internalError(error, { route: ROUTE, method: 'GET', restaurantId });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => putAvailability(req, params));
}

async function putAvailability(req: NextRequest, params: RouteParams['params']) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'RESTAURANT_ID_REQUIRED', 'Missing restaurant id.');
  }

  // Authorise before reading the body: an unauthorised caller learns nothing about validation.
  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body must be JSON.');
  }

  const parsed = commandSchema.safeParse(json);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const snapshot = await saveRestaurantAvailability(restaurantId, parsed.data);
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof AvailabilityCommandError) {
      return commandErrorResponse(error);
    }
    return internalError(error, { route: ROUTE, method: 'PUT', restaurantId });
  }
}
