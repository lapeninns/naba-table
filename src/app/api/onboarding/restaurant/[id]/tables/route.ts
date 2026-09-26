import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, validationError } from '@/lib/api/errors';
import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { onboardingInternalError } from '@/server/onboarding/errors';
import { insertTable } from '@/server/ops/tables';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_ONBOARDING_TABLES = 50;
const MAX_ONBOARDING_TABLE_WRITE_CONCURRENCY = 10;

const tableSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(50),
    capacity: z.number().int().min(1).max(20),
    minPartySize: z.number().int().min(1).max(20).nullable().optional(),
    maxPartySize: z.number().int().min(1).max(20).nullable().optional(),
    zoneId: z.string().uuid().nullable().optional(),
    category: z.enum(['dining', 'bar', 'lounge', 'patio', 'private']).optional(),
    seatingType: z.enum(['standard', 'booth', 'high_top', 'sofa']).optional(),
    mobility: z.enum(['fixed', 'movable']).optional(),
    status: z.enum(['available', 'out_of_service', 'reserved']).optional(),
  })
  .superRefine((table, context) => {
    if (
      table.minPartySize !== null &&
      table.minPartySize !== undefined &&
      table.maxPartySize !== null &&
      table.maxPartySize !== undefined &&
      table.maxPartySize < table.minPartySize
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxPartySize'],
        message: 'maxPartySize must be >= minPartySize',
      });
    }
  });

const requestSchema = z.object({
  tables: z.array(tableSchema).max(MAX_ONBOARDING_TABLES),
});

export async function POST(req: NextRequest, context: RouteContext) {
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
    scope: 'onboarding:tables',
    tenantId: restaurantId,
    userId: authorization.user.id,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many onboarding table updates. Please try again in a moment.',
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

  const tables = parsed.data.tables.map((table) => ({
    ...table,
    zoneId: table.zoneId ?? null,
  }));
  if (tables.some((table) => !table.zoneId)) {
    return apiError(400, 'TABLE_ZONE_REQUIRED', 'Each onboarding table must reference a zone');
  }

  try {
    const client = getServiceSupabaseClient();
    const zoneIds = Array.from(
      new Set(
        tables.map((table) => table.zoneId).filter((zoneId): zoneId is string => Boolean(zoneId)),
      ),
    );

    if (zoneIds.length > 0) {
      const { data: zones, error: zoneError } = await authorization.supabase
        .from('zones')
        .select('id, restaurant_id')
        .in('id', zoneIds);

      if (zoneError) {
        return onboardingInternalError(zoneError, {
          route: 'onboarding.restaurant.tables',
          restaurantId,
          userId: authorization.user.id,
        });
      }

      const validZoneIds = new Set(
        (zones ?? []).filter((zone) => zone.restaurant_id === restaurantId).map((zone) => zone.id),
      );
      if (validZoneIds.size !== zoneIds.length) {
        return apiError(
          400,
          'TABLE_ZONE_INVALID',
          'One or more zones do not belong to this restaurant',
        );
      }
    }

    const created = [];
    for (let index = 0; index < tables.length; index += MAX_ONBOARDING_TABLE_WRITE_CONCURRENCY) {
      const chunk = tables.slice(index, index + MAX_ONBOARDING_TABLE_WRITE_CONCURRENCY);
      const chunkCreated = await Promise.all(
        chunk.map((table) =>
          insertTable(client, {
            restaurant_id: restaurantId,
            table_number: table.tableNumber,
            capacity: table.capacity,
            min_party_size: table.minPartySize || undefined,
            max_party_size: table.maxPartySize || undefined,
            zone_id: table.zoneId as string,
            category: table.category ?? 'dining',
            seating_type: table.seatingType ?? 'standard',
            mobility: table.mobility ?? 'fixed',
            status: table.status ?? 'available',
          }),
        ),
      );
      created.push(...chunkCreated);
    }
    return NextResponse.json({ tables: created }, { status: 201 });
  } catch (creationError) {
    return onboardingInternalError(creationError, {
      route: 'onboarding.restaurant.tables',
      restaurantId,
      userId: authorization.user.id,
    });
  }
}
