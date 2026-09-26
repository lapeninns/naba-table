import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { RESTAURANT_ROLE_OPTIONS } from '@/lib/owner/auth/roles';
import { captureServerException } from '@/lib/posthog/server';
import { ensureProfileRow } from '@/lib/profile/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';
import {
  assertInvitableRole,
  createRestaurantInvite,
  listRestaurantInvites,
  resolveInviteExpiry,
} from '@/server/team/invitations';
import { getErrorCode, serializeInvite } from '@/server/team/invite-response';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const STATUS_FILTER_OPTIONS = ['pending', 'accepted', 'revoked', 'expired', 'all'] as const;
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number];

const listSchema = z.object({
  restaurantId: z.string().uuid(),
  status: z.enum(STATUS_FILTER_OPTIONS).optional(),
});

const createSchema = z.object({
  restaurantId: z.string().uuid(),
  email: z.string().trim().email(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const MEMBERSHIP_DENIED_CODES = new Set(['MEMBERSHIP_NOT_FOUND', 'MEMBERSHIP_ROLE_DENIED']);

export async function GET(request: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  const parsed = listSchema.safeParse({
    restaurantId: request.nextUrl.searchParams.get('restaurantId'),
    status: request.nextUrl.searchParams.get('status') ?? undefined,
  });

  if (!parsed.success) {
    return validationError(parsed.error, 'Invalid invitation filters.');
  }

  const { restaurantId, status: statusFilter } = parsed.data;
  const status: StatusFilter = statusFilter ?? 'pending';

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
    const invites = await listRestaurantInvites({
      restaurantId,
      authClient: supabase,
      status,
    });
    return NextResponse.json({
      invites: invites.map(serializeInvite),
    });
  } catch (error) {
    if (MEMBERSHIP_DENIED_CODES.has(getErrorCode(error) ?? '')) {
      return forbidden('TEAM_INVITES_FORBIDDEN', 'Only owners and managers can see invitations.');
    }

    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-team-invitations' },
    });
    return internalError(
      error,
      { route: 'ops.team.invitations.list', restaurantId },
      'Invitations couldn’t be loaded. Try again.',
    );
  }
}

export async function POST(request: NextRequest) {
  return withCsrfProtectedMutation(request, () => postTeamInvitation(request));
}

async function postTeamInvitation(request: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body must be valid JSON.');
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { restaurantId, email, role, expiresAt: requestedExpiry } = parsed.data;
  const aggregateRateLimitResponse = await requireApiRateLimit({
    request,
    scope: 'ops.team_invitations.create.aggregate',
    tenantId: restaurantId,
    userId: user.id,
    limit: 20,
    windowMs: 10 * 60 * 1000,
    message: 'Too many invitation attempts',
  });
  if (aggregateRateLimitResponse) {
    return aggregateRateLimitResponse;
  }

  const recipientRateLimitResponse = await requireApiRateLimit({
    request,
    scope: 'ops.team_invitations.create',
    tenantId: restaurantId,
    userId: user.id,
    parts: [email.toLowerCase()],
    limit: 8,
    windowMs: 10 * 60 * 1000,
    message: 'Too many invitation attempts',
  });
  if (recipientRateLimitResponse) {
    return recipientRateLimitResponse;
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
    await assertInvitableRole({
      actorUserId: user.id,
      restaurantId,
      invitedRole: role,
    });
    const expiresAt = resolveInviteExpiry(requestedExpiry);

    await ensureProfileRow(supabase, user);

    const { invite, emailSent } = await createRestaurantInvite({
      restaurantId,
      email,
      role,
      invitedBy: user.id,
      expiresAt,
      authClient: supabase,
    });

    // The invite exists either way. When the email didn't go out, say so: the admin can resend.
    return NextResponse.json({ invite: serializeInvite(invite), emailSent }, { status: 201 });
  } catch (error) {
    const code = getErrorCode(error);
    if (code && MEMBERSHIP_DENIED_CODES.has(code)) {
      return forbidden('TEAM_INVITES_FORBIDDEN', 'Only owners and managers can invite people.');
    }
    if (code === 'INVITE_ALREADY_EXISTS') {
      return conflict(
        'INVITE_ALREADY_PENDING',
        'This person already has an invitation waiting. Resend it from the list instead.',
      );
    }
    if (code === 'INVALID_INVITE_ROLE') {
      return apiError(422, 'INVALID_INVITE_ROLE', 'This role can’t be invited.');
    }
    if (code === 'INVITE_ROLE_FORBIDDEN') {
      return forbidden('INVITE_ROLE_FORBIDDEN', 'Your role can’t invite someone to this role.');
    }

    return internalError(
      error,
      { route: 'ops.team.invitations.create', restaurantId },
      'The invitation couldn’t be created. Try again.',
    );
  }
}
