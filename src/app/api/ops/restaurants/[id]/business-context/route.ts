import { NextResponse } from 'next/server';
import { z } from 'zod';

import { RESTAURANT_EDITABLE_LINK_TYPES } from '@/lib/ops/restaurant-link-types';
import {
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

const updateBusinessContextSchema = z
  .object({
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

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'restaurant-business-context');
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const snapshot = await getRestaurantBusinessContext(restaurantId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[ops][restaurants][business-context][GET] failed', error);
    return NextResponse.json(
      { error: 'Unable to load restaurant business context' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'restaurant-business-context');
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateBusinessContextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const snapshot = await updateRestaurantBusinessContext(
      restaurantId,
      parsed.data as Parameters<typeof updateRestaurantBusinessContext>[1],
      undefined,
      {
        changeOrigin: 'owner',
        changedByUserId: auth.userId,
        changedVia: 'ops_business_context_api',
        changeReason: 'Owner/admin business-context update from ops settings.',
      },
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[ops][restaurants][business-context][PUT] failed', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to update restaurant business context',
      },
      { status: 400 },
    );
  }
}

export const runtime = 'nodejs';
