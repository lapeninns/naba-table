import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createZone } from '@/server/ops/zones';
import { validateCsrfToken } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const zoneSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const requestSchema = z.object({
  zones: z.array(zoneSchema),
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
      parsed.data.zones.map((zone, index) =>
        createZone(client, {
          restaurantId,
          name: zone.name,
          sortOrder: zone.sortOrder ?? index,
          active: zone.active ?? true,
        }),
      ),
    );
    return NextResponse.json({ zones: created }, { status: 201 });
  } catch (creationError) {
    console.error('[onboarding][zones][POST]', creationError);
    const message = creationError instanceof Error ? creationError.message : 'Unable to create zones';
    return NextResponse.json({ message }, { status: 500 });
  }
}
