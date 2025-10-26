import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getDefaultRestaurantId, getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest} from 'next/server';

export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).default('Playwright!123'),
  profile: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      image: z.string().optional(),
      role: z.enum(['owner', 'manager', 'host', 'server']).optional(),
      restaurantId: z.string().uuid().optional(),
    })
    .default({}),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, profile, metadata } = parsed.data;
  const service = getServiceSupabaseClient();

  const normalizedEmail = email.toLowerCase();

  // List users and filter by email since getUserByEmail doesn't exist
  const { data: usersData } = await service.auth.admin.listUsers();
  const existingUser = usersData?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail);
  let user = existingUser ?? null;

  if (!user) {
    const created = await service.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: metadata ?? {},
    });

    if (created.error || !created.data.user) {
      return NextResponse.json({ error: created.error?.message ?? 'Failed to create auth user' }, { status: 500 });
    }

    user = created.data.user;
  } else {
    const updates: Record<string, unknown> = {};
    if (metadata && Object.keys(metadata).length > 0) {
      updates.user_metadata = {
        ...(user.user_metadata ?? {}),
        ...metadata,
      };
    }

    updates.password = password;
    updates.email_confirm = true;

    const updated = await service.auth.admin.updateUserById(user.id, updates);
    if (updated.error || !updated.data.user) {
      return NextResponse.json({ error: updated.error?.message ?? 'Failed to update auth user' }, { status: 500 });
    }
    user = updated.data.user;
  }

  const restaurantId = profile.restaurantId ?? (await getDefaultRestaurantId());

  const profilePayload = {
    id: user.id,
    email: normalizedEmail,
    name: profile.name ?? 'QA Manager',
    phone: profile.phone ?? '07123 456789',
    image: profile.image ?? null,
    has_access: true,
    updated_at: new Date().toISOString(),
  };

  const upsertProfile = await service
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('id, name, email, phone')
    .single();

  if (upsertProfile.error) {
    return NextResponse.json({ error: upsertProfile.error.message }, { status: 500 });
  }

  await service
    .from('restaurant_memberships')
    .upsert(
      {
        user_id: user.id,
        restaurant_id: restaurantId,
        role: profile.role ?? 'manager',
      },
      { onConflict: 'user_id,restaurant_id' },
    );

  const supabase = await getRouteHandlerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    profile: upsertProfile.data,
    restaurantMembership: {
      restaurantId,
      role: profile.role ?? 'manager',
    },
    clientRequestId: randomUUID(),
  });
}
