import { NextResponse } from 'next/server';
import { z } from 'zod';

import { insertTable } from '@/server/ops/tables';
import { validateCsrfToken } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

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
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const { id: restaurantId } = await context.params;
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ message: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const client = getServiceSupabaseClient();
    const created = await Promise.all(
      parsed.data.tables.map((table, index) =>
        insertTable(client, {
          restaurant_id: restaurantId,
          table_number: table.tableNumber,
          capacity: table.capacity,
          min_party_size: table.minPartySize ?? null,
          max_party_size: table.maxPartySize ?? null,
          zone_id: table.zoneId ?? null,
          category: table.category ?? 'dining',
          seating_type: table.seatingType ?? 'standard',
          mobility: table.mobility ?? 'fixed',
          status: table.status ?? 'available',
          sort_order: index,
        }),
      ),
    );
    return NextResponse.json({ tables: created }, { status: 201 });
  } catch (creationError) {
    console.error('[onboarding][tables][POST]', creationError);
    const message = creationError instanceof Error ? creationError.message : 'Unable to create tables';
    return NextResponse.json({ message }, { status: 500 });
  }
}
