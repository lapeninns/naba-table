import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getDefaultRestaurantId, getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { User } from '@supabase/supabase-js';
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

async function findUserByEmail(email: string): Promise<User | null> {
  const service = getServiceSupabaseClient();
  const normalized = email.toLowerCase();
  const { data, error } = await service.auth.admin.listUsers();
  if (error) {
    console.warn('[test/playwright-session] listUsers error', error);
    return null;
  }

  return data?.users?.find((candidate) => candidate.email?.toLowerCase() === normalized) ?? null;
}

async function ensureAuthUser(
  email: string,
  password: string,
  metadata?: Record<string, unknown>,
): Promise<User | null> {
  const service = getServiceSupabaseClient();
  const normalizedEmail = email.toLowerCase();

  const toMetadata = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
  let user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const created = await service.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: toMetadata ?? {},
    });

    if (created.error || !created.data.user) {
      const duplicate = created.error?.message?.toLowerCase().includes('already been registered');
      if (!duplicate) {
        console.error('[test/playwright-session] createUser failed', created.error);
        return null;
      }
      user = await findUserByEmail(normalizedEmail);
    } else {
      user = created.data.user;
    }
  }

  if (!user) {
    return null;
  }

  const updates: Record<string, unknown> = {
    password,
    email_confirm: true,
  };

  if (toMetadata) {
    updates.user_metadata = {
      ...(user.user_metadata ?? {}),
      ...toMetadata,
    };
  }

  const updated = await service.auth.admin.updateUserById(user.id, updates);
  if (updated.error || !updated.data.user) {
    console.error('[test/playwright-session] updateUser failed', updated.error);
    return null;
  }

  return updated.data.user;
}

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

  const user = await ensureAuthUser(normalizedEmail, password, metadata);
  if (!user) {
    return NextResponse.json({ error: 'Failed to provision auth user' }, { status: 500 });
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
