import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const getRestaurantEmailTemplateVenueMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock('@/server/team/access', async () => {
  const actual = await vi.importActual<typeof TeamAccessModule>('@/server/team/access');
  return {
    MembershipAccessError: actual.MembershipAccessError,
    requireMembershipForRestaurant: requireMembershipForRestaurantMock,
    requireAdminMembership: requireAdminMembershipMock,
  };
});

vi.mock('@/server/restaurants/emailTemplates', () => ({
  getRestaurantEmailTemplateVenue: getRestaurantEmailTemplateVenueMock,
}));

import { MembershipAccessError } from '@/server/team/access';
import {
  ensureTemplateReadAccess,
  ensureTemplateWriteAccess,
} from '@/src/app/api/ops/restaurants/[id]/email-templates/_shared';

import type * as TeamAccessModule from '@/server/team/access';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

async function bodyOf(result: unknown) {
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  return { status: response.status, body: await response.json() };
}

describe('email template access helpers', () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipForRestaurantMock.mockReset().mockResolvedValue({ role: 'owner' });
    requireAdminMembershipMock.mockReset().mockResolvedValue({ role: 'owner' });
    getRestaurantEmailTemplateVenueMock.mockReset().mockResolvedValue({ id: RESTAURANT_ID });
  });

  it('returns 401 UNAUTHENTICATED without a session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const { status, body } = await bodyOf(await ensureTemplateReadAccess(RESTAURANT_ID));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('returns 403 FORBIDDEN for a non-member', async () => {
    requireMembershipForRestaurantMock.mockRejectedValue(
      new MembershipAccessError({
        status: 403,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Membership not found',
      }),
    );

    const { status, body } = await bodyOf(await ensureTemplateReadAccess(RESTAURANT_ID));

    expect(status).toBe(403);
    expect(body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('reports a venue load failure as a 500, not as forbidden', async () => {
    getRestaurantEmailTemplateVenueMock.mockRejectedValue(
      new Error('column restaurants.email_templates does not exist'),
    );

    const { status, body } = await bodyOf(await ensureTemplateReadAccess(RESTAURANT_ID));

    expect(status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('email_templates');
  });

  it('returns 403 ADMIN_ROLE_REQUIRED for a member without an admin role', async () => {
    requireAdminMembershipMock.mockRejectedValue(
      new MembershipAccessError({
        status: 403,
        code: 'MEMBERSHIP_ROLE_DENIED',
        message: 'Insufficient permissions for restaurant',
      }),
    );

    const { status, body } = await bodyOf(await ensureTemplateWriteAccess(RESTAURANT_ID));

    expect(status).toBe(403);
    expect(body).toMatchObject({ code: 'ADMIN_ROLE_REQUIRED' });
  });

  it('returns the venue for an admin', async () => {
    await expect(ensureTemplateWriteAccess(RESTAURANT_ID)).resolves.toEqual({ id: RESTAURANT_ID });
  });
});
