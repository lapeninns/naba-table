import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, conflict, internalError, validationError } from '@/lib/api/errors';
import { RESTAURANT_EDITABLE_LINK_TYPES } from '@/lib/ops/restaurant-link-types';
import { captureServerException } from '@/lib/posthog/server';
import {
  BusinessContextStaleWriteError,
  BusinessContextValidationError,
  getRestaurantBusinessContext,
  updateRestaurantBusinessContext,
} from '@/server/restaurants/businessContext';

import { ensureRestaurantAdminAccess, resolveRestaurantId } from '../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

const nullableTextSchema = z.string().trim().nullable().optional();
const moreHoursTypeSchema = z.object({
  hoursTypeId: nullableTextSchema,
  displayName: nullableTextSchema,
  localizedDisplayName: nullableTextSchema,
});
const valueMetadataSchema = z.object({
  value: z.union([z.boolean(), z.string(), z.null()]).optional().default(null),
  displayName: nullableTextSchema,
});
const persistedIdSchema = z.string().trim().uuid('Persisted row id must be a UUID').optional();
const serviceAreaTypeSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['place', 'region', 'postal_code', 'other']),
);
const attributeValueTypeSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'bool') return 'boolean';
    if (normalized === 'string') return 'text';
    if (normalized === 'url') return 'uri';
    if (normalized === 'multi_enum' || normalized === 'repeated_enum') return 'multienum';
    return normalized;
  },
  z.enum(['boolean', 'text', 'uri', 'enum', 'multienum']),
);
const linkTypeSchema = z.enum(RESTAURANT_EDITABLE_LINK_TYPES);

const ROUTE = 'ops.restaurants.business-context';

const updateBusinessContextSchema = z
  .object({
    /**
     * Revision the editor's draft is based on (from the GET snapshot). When present, a save that
     * lands after another write is refused with 409 STALE_WRITE instead of overwriting it.
     */
    expectedRevision: z.number().int().nonnegative().optional(),
    businessDetails: z
      .object({
        openingDate: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Opening date must use YYYY-MM-DD format')
          .nullable()
          .optional(),
        businessStatus: z
          .enum(['open', 'closed_permanently', 'closed_temporarily'])
          .nullable()
          .optional(),
        isServiceAreaBusiness: z.boolean().optional().default(false),
      })
      .optional(),
    links: z
      .array(
        z.object({
          id: persistedIdSchema,
          linkType: linkTypeSchema,
          linkStatus: z.enum(['current', 'previous']).nullable().optional().default('current'),
          label: nullableTextSchema,
          url: z.string().trim().url('Link URL must be valid'),
          isPrimary: z.boolean().optional().default(false),
        }),
      )
      .optional(),
    categories: z
      .array(
        z.object({
          id: persistedIdSchema,
          displayName: z.string().trim().min(1),
          categoryCode: nullableTextSchema,
          moreHoursTypes: z.array(moreHoursTypeSchema).optional().default([]),
          isPrimary: z.boolean().optional().default(false),
        }),
      )
      .optional(),
    serviceAreas: z
      .array(
        z.object({
          id: persistedIdSchema,
          displayName: z.string().trim().min(1),
          areaType: serviceAreaTypeSchema.optional().default('region'),
          regionCode: nullableTextSchema,
          googlePlaceId: nullableTextSchema,
          googlePlaceResourceName: nullableTextSchema,
          placeData: z.record(z.string(), z.unknown()).nullable().optional(),
        }),
      )
      .optional(),
    attributes: z
      .array(
        z.object({
          id: persistedIdSchema,
          attributeGroup: nullableTextSchema,
          attributeKey: z.string().trim().min(1),
          attributeName: nullableTextSchema,
          attributeId: nullableTextSchema,
          displayName: nullableTextSchema,
          displayText: nullableTextSchema,
          displayTextStandalone: nullableTextSchema,
          displayTextNegative: nullableTextSchema,
          valueType: attributeValueTypeSchema,
          boolValue: z.boolean().nullable().optional(),
          textValue: nullableTextSchema,
          uriValue: nullableTextSchema,
          uriValues: z.array(z.string().trim()).optional().default([]),
          enumValues: z.array(z.string().trim()).optional().default([]),
          unsetEnumValues: z.array(z.string().trim()).optional().default([]),
          rawValue: z.record(z.string(), z.unknown()).nullable().optional(),
          rawEnumValues: z.record(z.string(), z.unknown()).nullable().optional(),
          displayValue: z.record(z.string(), z.unknown()).nullable().optional(),
          valueMetadata: z.array(valueMetadataSchema).optional().default([]),
        }),
      )
      .optional(),
    serviceItems: z
      .array(
        z.object({
          id: persistedIdSchema,
          itemKey: z.string().trim().min(1),
          itemType: nullableTextSchema,
          displayName: nullableTextSchema,
          description: nullableTextSchema,
          payload: z.record(z.string(), z.unknown()).nullable().optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (value) =>
      value.businessDetails !== undefined ||
      value.links !== undefined ||
      value.categories !== undefined ||
      value.serviceAreas !== undefined ||
      value.attributes !== undefined ||
      value.serviceItems !== undefined,
    {
      message: 'At least one business-context family must be provided.',
    },
  );

function missingRestaurantId() {
  return apiError(400, 'MISSING_RESTAURANT_ID', 'Missing restaurant id.');
}

function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Postgres classes for values the database rejected: invalid text representation, dates, checks. */
const INVALID_VALUE_CODES = new Set(['22P02', '22007', '22008', '23514', '22001']);

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'restaurant-business-context');
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const snapshot = await getRestaurantBusinessContext(restaurantId);
    return NextResponse.json(snapshot);
  } catch (error) {
    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-restaurant-business-context' },
    });
    return internalError(
      error,
      { route: ROUTE, method: 'GET', restaurantId },
      'Unable to load restaurant business context.',
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const auth = await ensureRestaurantAdminAccess(
    restaurantId,
    'restaurant-business-context',
    request,
  );
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = updateBusinessContextSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { expectedRevision, ...input } = parsed.data;
  try {
    const snapshot = await updateRestaurantBusinessContext(
      restaurantId,
      input as Parameters<typeof updateRestaurantBusinessContext>[1],
      undefined,
      {
        changeOrigin: 'owner',
        changedByUserId: auth.userId,
        changedVia: 'ops_business_context_api',
        changeReason: 'Owner/admin business-context update from ops settings.',
      },
      { expectedRevision: expectedRevision ?? null },
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof BusinessContextValidationError) {
      // Domain messages are fixed copy written for staff (no database or guest text).
      return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { [error.field]: [error.message] },
      });
    }
    if (error instanceof BusinessContextStaleWriteError) {
      return conflict(
        'STALE_WRITE',
        'These details changed since you loaded them. Reload to see the latest, then reapply your edits.',
        { details: { currentRevision: error.currentRevision } },
      );
    }
    const dbCode = databaseErrorCode(error);
    if (dbCode === '23505') {
      return conflict(
        'BUSINESS_CONTEXT_CONFLICT',
        'These details clash with a saved entry. Reload and try again.',
      );
    }
    if (dbCode && INVALID_VALUE_CODES.has(dbCode)) {
      return apiError(
        400,
        'VALIDATION_FAILED',
        'Some details were not accepted. Check them and try again.',
      );
    }
    return internalError(
      error,
      { route: ROUTE, method: 'PUT', restaurantId },
      'Unable to update restaurant business context.',
    );
  }
}

export const runtime = 'nodejs';
