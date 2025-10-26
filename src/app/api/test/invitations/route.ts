import { NextResponse } from 'next/server';
import { z } from 'zod';

import { RESTAURANT_ROLE_OPTIONS } from '@/lib/owner/auth/roles';
import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getDefaultRestaurantId, getServiceSupabaseClient } from '@/server/supabase';
import { generateInviteToken, hashInviteToken } from '@/server/team/invitations';

import type { NextRequest} from 'next/server';

export const dynamic = 'force-dynamic';

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS).default('manager'),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']).default('pending'),
  expiresInDays: z.number().int().default(7), // Allow negative values for testing expired invites
  restaurantId: z.string().uuid().optional(),
  invitedBy: z.string().uuid().optional(),
});

const deleteInviteSchema = z.object({
  email: z.string().email().optional(),
  token: z.string().optional(),
});

/**
 * POST /api/test/invitations
 * Creates a test invitation for e2e testing
 */
export async function POST(req: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const body = await req.json();
  const parsed = createInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, role, status, expiresInDays, restaurantId: reqRestaurantId, invitedBy } = parsed.data;
  const service = getServiceSupabaseClient();

  const normalizedEmail = email.toLowerCase();
  
  // Get or fetch restaurant ID  
  let restaurantId = reqRestaurantId;
  if (!restaurantId) {
    // Get any restaurant from the database for testing
    const { data: restaurant, error: fetchError } = await service
      .from('restaurants')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (fetchError || !restaurant) {
      return NextResponse.json({ error: 'No restaurant found in database' }, { status: 500 });
    }
    restaurantId = restaurant.id;
  }

  // Delete any existing invites for this email + restaurant to avoid conflicts
  await service
    .from('restaurant_invites')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('email_normalized', normalizedEmail);

  const { token, hash } = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const inviteData = {
    restaurant_id: restaurantId,
    email: normalizedEmail,
    role,
    token_hash: hash,
    status,
    expires_at: expiresAt.toISOString(),
    invited_by: invitedBy ?? null,
  };

  const { data: invite, error } = await service
    .from('restaurant_invites')
    .insert(inviteData)
    .select('id, email, role, status, expires_at, restaurant_id')
    .single();

  if (error) {
    console.error('[test/invitations][POST] failed to create invite', error);
    return NextResponse.json({ error: 'Failed to create test invitation', details: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expires_at,
      restaurantId: invite.restaurant_id,
    },
    token,
    inviteUrl: `/invite/${token}`,
  });
}

/**
 * DELETE /api/test/invitations
 * Deletes test invitations by email or token
 */
export async function DELETE(req: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const body = await req.json();
  const parsed = deleteInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, token } = parsed.data;

  if (!email && !token) {
    return NextResponse.json({ error: 'Either email or token must be provided' }, { status: 400 });
  }

  const service = getServiceSupabaseClient();

  if (token) {
    const hash = hashInviteToken(token);
    const { error } = await service.from('restaurant_invites').delete().eq('token_hash', hash);

    if (error) {
      console.error('[test/invitations][DELETE] failed to delete by token', error);
      return NextResponse.json({ error: 'Failed to delete invitation', details: error.message }, { status: 500 });
    }
  } else if (email) {
    const normalizedEmail = email.toLowerCase();
    const { error } = await service.from('restaurant_invites').delete().eq('email_normalized', normalizedEmail);

    if (error) {
      console.error('[test/invitations][DELETE] failed to delete by email', error);
      return NextResponse.json({ error: 'Failed to delete invitation', details: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
