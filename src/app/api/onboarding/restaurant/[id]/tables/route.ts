import { NextResponse } from 'next/server';
import { z } from 'zod';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { insertTable } from '@/server/ops/tables';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const tableSchema = z.object({
  tableNumber: z.string().trim().min(1),
  capacity: z.number().int().min(1),
  minPartySize: z.number().int().min(1).nullable().optional(),
  maxPartySize: z.number().int().min(1).nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  category: z.enum(['dining', 'bar', 'lounge', 'patio', 'private']).optional(),
  seatingType: z.enum(['standard', 'booth', 'high_top', 'sofa']).optional(),
  mobility: z.enum(['fixed', 'movable']).optional(),
  status: z.enum(['available', 'out_of_service', 'reserved']).optional(),
});

const requestSchema = z.object({
  tables: z.array(tableSchema),
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tables = parsed.data.tables.map((table) => ({
    ...table,
    zoneId: table.zoneId ?? null,
  }));
  if (tables.some((table) => !table.zoneId)) {
    return NextResponse.json(
      { message: 'Each onboarding table must reference a zone' },
      { status: 400 },
    );
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
        console.error('[onboarding][tables][POST] Zone ownership lookup failed', zoneError);
        return NextResponse.json({ message: 'Unable to verify table zones' }, { status: 500 });
      }

      const validZoneIds = new Set(
        (zones ?? []).filter((zone) => zone.restaurant_id === restaurantId).map((zone) => zone.id),
      );
      if (validZoneIds.size !== zoneIds.length) {
        return NextResponse.json(
          { message: 'One or more zones do not belong to this restaurant' },
          { status: 400 },
        );
      }
    }

    const created = await Promise.all(
      tables.map((table) =>
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
    return NextResponse.json({ tables: created }, { status: 201 });
  } catch (creationError) {
    console.error('[onboarding][tables][POST]', creationError);
    const message =
      creationError instanceof Error ? creationError.message : 'Unable to create tables';
    return NextResponse.json({ message }, { status: 500 });
  }
}
