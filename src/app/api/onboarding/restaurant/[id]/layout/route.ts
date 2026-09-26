import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, conflict, notFound, validationError } from '@/lib/api/errors';
import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { onboardingInternalError } from '@/server/onboarding/errors';
import {
  MAX_ONBOARDING_LAYOUT_TABLES,
  MAX_ONBOARDING_LAYOUT_ZONES,
  OnboardingLayoutInvalidError,
  OnboardingLayoutLockedError,
  OnboardingLayoutRestaurantNotFoundError,
  replaceOnboardingLayout,
} from '@/server/onboarding/layout';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const ROUTE = 'onboarding.restaurant.layout';

const zoneSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required').max(80),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

const tableSchema = z
  .object({
    tableNumber: z.string().trim().min(1, 'Table number is required').max(50),
    capacity: z.number().int().min(1, 'Capacity must be at least 1').max(20),
    minPartySize: z.number().int().min(1).max(20).nullable().optional(),
    maxPartySize: z.number().int().min(1).max(20).nullable().optional(),
    zoneName: z.string().trim().min(1).max(80).nullable().optional(),
    category: z.enum(['dining', 'bar', 'lounge', 'patio', 'private']).optional(),
    seatingType: z.enum(['standard', 'booth', 'high_top', 'sofa']).optional(),
    mobility: z.enum(['fixed', 'movable']).optional(),
  })
  .superRefine((table, context) => {
    if (
      table.minPartySize != null &&
      table.maxPartySize != null &&
      table.maxPartySize < table.minPartySize
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxPartySize'],
        message: 'Max party size must be at least the min party size',
      });
    }
  });

const requestSchema = z
  .object({
    zones: z.array(zoneSchema).min(1, 'Add at least one zone').max(MAX_ONBOARDING_LAYOUT_ZONES),
    tables: z.array(tableSchema).min(1, 'Add at least one table').max(MAX_ONBOARDING_LAYOUT_TABLES),
  })
  .superRefine((value, context) => {
    const zoneKeys = new Set<string>();
    value.zones.forEach((zone, index) => {
      const key = zone.name.toLowerCase();
      if (zoneKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['zones', index, 'name'],
          message: 'Zone names must be unique',
        });
      }
      zoneKeys.add(key);
    });

    const tableNumbers = new Set<string>();
    value.tables.forEach((table, index) => {
      if (tableNumbers.has(table.tableNumber)) {
        context.addIssue({
          code: 'custom',
          path: ['tables', index, 'tableNumber'],
          message: 'Table numbers must be unique',
        });
      }
      tableNumbers.add(table.tableNumber);
      if (table.zoneName && !zoneKeys.has(table.zoneName.toLowerCase())) {
        context.addIssue({
          code: 'custom',
          path: ['tables', index, 'zoneName'],
          message: 'Choose one of the zones above',
        });
      }
    });
  });

/**
 * Replaces the onboarding restaurant's zones and tables in one transaction
 * (`onboarding_replace_layout`). Idempotent: re-sending the same layout returns the same
 * rows. Refused with 409 ONBOARDING_LAYOUT_LOCKED once the restaurant has bookings.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
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
    scope: 'onboarding:layout',
    tenantId: restaurantId,
    userId: authorization.user.id,
    limit: 20,
    windowMs: 60_000,
    message: 'Too many table layout updates. Wait a moment and try again.',
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

  try {
    const layout = await replaceOnboardingLayout(
      getServiceSupabaseClient(),
      restaurantId,
      parsed.data,
    );
    return NextResponse.json({ data: layout });
  } catch (error) {
    if (error instanceof OnboardingLayoutLockedError) {
      return conflict(
        'ONBOARDING_LAYOUT_LOCKED',
        'This restaurant already has bookings, so its tables can only be changed from Tables in the dashboard.',
      );
    }
    if (error instanceof OnboardingLayoutInvalidError) {
      return apiError(400, 'ONBOARDING_LAYOUT_INVALID', 'Check the zone names and table numbers.');
    }
    if (error instanceof OnboardingLayoutRestaurantNotFoundError) {
      return notFound('RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }
    return onboardingInternalError(error, {
      route: ROUTE,
      restaurantId,
      userId: authorization.user.id,
    });
  }
}
