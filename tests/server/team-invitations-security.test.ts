import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import {
  acceptInviteForAuthenticatedUser,
  createRestaurantInvite,
  revokeRestaurantInvite,
  type RestaurantInvite,
} from '@/server/team/invitations';
import { DELETE as revokeInviteDELETE } from '@/src/app/api/ops/team/invitations/[id]/route';
import { POST as createInvitePOST } from '@/src/app/api/ops/team/invitations/route';
import { POST as acceptInvitePOST } from '@/src/app/api/team/invitations/[token]/accept/route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureProfileRowMock = vi.hoisted(() => vi.fn());
const sendTeamInviteEmailMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/lib/profile/server', () => ({
  ensureProfileRow: ensureProfileRowMock,
}));

vi.mock('@/server/emails/invitations', () => ({
  sendTeamInviteEmail: sendTeamInviteEmailMock,
}));

vi.mock('@/server/team/access', async () => {
  const actual = await vi.importActual('@/server/team/access');
  return {
    ...(actual as object),
    requireAdminMembership: requireAdminMembershipMock,
    requireMembershipForRestaurant: requireMembershipForRestaurantMock,
  };
});

const RESTAURANT_ID = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const INVITER_ID = '33eeab93-378a-41c0-bfaa-9e2e73b7920e';
const INVITED_USER_ID = '0b106691-80b1-4f92-91c3-d8f4a9d5fd48';
const CSRF_TOKEN = 'team-invite-csrf-token';
const REVOKED_AT = '2026-05-16T08:30:00.000Z';

function csrfHeaders(): Headers {
  return new Headers({
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  });
}

function makeInvite(overrides: Partial<RestaurantInvite> = {}): RestaurantInvite {
  return {
    id: '657902e8-8e0d-49bc-9614-67bd6d7d8cbd',
    restaurant_id: RESTAURANT_ID,
    email: 'victim@example.com',
    email_normalized: 'victim@example.com',
    role: 'host',
    token_hash: 'hashed-token',
    status: 'pending',
    expires_at: '2026-06-01T12:00:00.000Z',
    invited_by: INVITER_ID,
    accepted_at: null,
    revoked_at: null,
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    ...overrides,
  } as RestaurantInvite;
}

function buildInsertClient(invite: RestaurantInvite) {
  const single = vi.fn().mockResolvedValue({ data: invite, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn((table: string) => {
    if (table !== 'restaurant_invites') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return { insert };
  });
  return { from, insert };
}

function buildInviteAcceptClient(params: {
  inviterRole?: string;
  foundInvite?: RestaurantInvite | null;
  acceptedInvite?: RestaurantInvite | null;
  rpcError?: { code?: string; message: string } | null;
}) {
  const inviterRole = params.inviterRole ?? 'owner';
  const foundInvite = params.foundInvite ?? makeInvite();
  const acceptedInvite = params.acceptedInvite ?? makeInvite({ status: 'accepted' });
  const rpcError = params.rpcError ?? null;

  const membershipMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID, role: inviterRole }, error: null });
  const membershipEqRestaurant = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
  const membershipEqUser = vi.fn().mockReturnValue({ eq: membershipEqRestaurant });
  const membershipSelect = vi.fn().mockReturnValue({ eq: membershipEqUser });
  const rpc = vi.fn().mockResolvedValue({ data: acceptedInvite, error: rpcError });

  const inviteSingle = vi.fn().mockResolvedValue({ data: acceptedInvite, error: null });
  const inviteMaybeSingle = vi.fn().mockResolvedValue({ data: foundInvite, error: null });
  const inviteSelectByHash = vi.fn().mockReturnValue({ maybeSingle: inviteMaybeSingle });
  const inviteSelect = vi.fn().mockReturnValue({ single: inviteSingle });
  const inviteEqStatus = vi.fn().mockReturnValue({ select: inviteSelect });
  const inviteEqId = vi.fn().mockReturnValue({ eq: inviteEqStatus });
  const update = vi.fn().mockReturnValue({ eq: inviteEqId });

  const from = vi.fn((table: string) => {
    if (table === 'restaurant_memberships') {
      return { select: membershipSelect };
    }
    if (table === 'restaurant_invites') {
      return { select: vi.fn().mockReturnValue({ eq: inviteSelectByHash }), update };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, rpc };
}

function buildRouteSession(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

function buildRevokeRouteClient(invite = makeInvite()) {
  const revokedInvite = makeInvite({
    status: 'revoked',
    revoked_at: REVOKED_AT,
    updated_at: REVOKED_AT,
  });
  const predicates: Array<[string, unknown]> = [];
  const deleteMock = vi.fn();
  const updateMock = vi.fn();

  const updateQuery = {
    eq(column: string, value: unknown) {
      predicates.push([column, value]);
      return this;
    },
    select() {
      return this;
    },
    maybeSingle: vi.fn().mockResolvedValue({ data: revokedInvite, error: null }),
  };

  const lookupQuery = {
    eq(column: string, value: unknown) {
      predicates.push([column, value]);
      return this;
    },
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: invite.id, restaurant_id: invite.restaurant_id },
      error: null,
    }),
  };

  const selectMock = vi.fn(() => lookupQuery);
  updateMock.mockReturnValue(updateQuery);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: INVITER_ID, email: 'owner@example.com' } },
        error: null,
      }),
    },
    deleteMock,
    predicates,
    revokedInvite,
    updateMock,
    from: vi.fn((table: string) => {
      if (table !== 'restaurant_invites') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        delete: deleteMock,
        select: selectMock,
        update: updateMock,
      };
    }),
  };
}

describe('team invitation security', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    ensureProfileRowMock.mockReset();
    sendTeamInviteEmailMock.mockReset();
    requireMembershipForRestaurantMock.mockReset();
    requireAdminMembershipMock.mockReset();
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'owner' });
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
  });

  it('keeps raw invite tokens inside the email delivery flow only', async () => {
    const invite = makeInvite();
    const client = buildInsertClient(invite);

    const result = await createRestaurantInvite({
      restaurantId: RESTAURANT_ID,
      email: 'victim@example.com',
      role: 'host',
      invitedBy: INVITER_ID,
      expiresAt: '2026-06-01T12:00:00.000Z',
      authClient: client as never,
    });

    expect(result).toEqual({ invite });
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('inviteUrl');
    expect(sendTeamInviteEmailMock).toHaveBeenCalledWith({
      invite,
      token: expect.any(String),
    });
  });

  it('does not expose token, inviteUrl, or token_hash in invite creation responses', async () => {
    const invite = makeInvite({ role: 'manager' });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      ...buildInsertClient(invite),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: INVITER_ID, email: 'owner@example.com' } },
          error: null,
        }),
      },
    });
    ensureProfileRowMock.mockResolvedValue({});

    const response = await createInvitePOST(
      new NextRequest('https://app.nabatable.com/api/ops/team/invitations', {
        method: 'POST',
        headers: csrfHeaders(),
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          email: 'victim@example.com',
          role: 'manager',
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(JSON.stringify(body)).not.toContain('token');
    expect(JSON.stringify(body)).not.toContain('inviteUrl');
    expect(JSON.stringify(body)).not.toContain('hashed-token');
    expect(body).toEqual({
      invite: expect.objectContaining({
        id: invite.id,
        email: invite.email,
        role: invite.role,
      }),
    });
  });

  it('rejects manager attempts to invite an owner role', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: INVITER_ID, email: 'manager@example.com' } },
          error: null,
        }),
      },
    });
    requireAdminMembershipMock.mockResolvedValue({ role: 'manager' });
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'manager' });

    const response = await createInvitePOST(
      new NextRequest('https://app.nabatable.com/api/ops/team/invitations', {
        method: 'POST',
        headers: csrfHeaders(),
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          email: 'victim@example.com',
          role: 'owner',
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it('allows owners to invite owners when business rules permit it', async () => {
    const invite = makeInvite({ role: 'owner' });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      ...buildInsertClient(invite),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: INVITER_ID, email: 'owner@example.com' } },
          error: null,
        }),
      },
    });
    ensureProfileRowMock.mockResolvedValue({});

    const response = await createInvitePOST(
      new NextRequest('https://app.nabatable.com/api/ops/team/invitations', {
        method: 'POST',
        headers: csrfHeaders(),
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          email: 'new-owner@example.com',
          role: 'owner',
        }),
      }),
    );

    expect(response.status).toBe(201);
  });

  it('soft-revokes pending invites and returns the revoked invite response contract', async () => {
    const client = buildRevokeRouteClient();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });

    const response = await revokeInviteDELETE(
      new NextRequest(
        `https://app.nabatable.com/api/ops/team/invitations/${client.revokedInvite.id}`,
        {
          method: 'DELETE',
          headers: csrfHeaders(),
        },
      ),
      { params: Promise.resolve({ id: client.revokedInvite.id }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      invite: expect.objectContaining({
        id: client.revokedInvite.id,
        restaurantId: RESTAURANT_ID,
        status: 'revoked',
        revokedAt: REVOKED_AT,
      }),
    });
    expect(client.deleteMock).not.toHaveBeenCalled();
    expect(client.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'revoked',
        revoked_at: expect.any(String),
      }),
    );
    expect(client.predicates).toEqual(
      expect.arrayContaining([
        ['id', client.revokedInvite.id],
        ['restaurant_id', RESTAURANT_ID],
        ['status', 'pending'],
      ]),
    );
  });

  it('requires an authenticated matching email to accept an invite and never mutates passwords', async () => {
    const invite = makeInvite();
    const sessionClient = buildRouteSession({ id: INVITED_USER_ID, email: 'victim@example.com' });
    const serviceClient = {
      ...buildInviteAcceptClient({ inviterRole: 'owner', foundInvite: invite }),
      auth: {
        admin: {
          createUser: vi.fn(),
          updateUserById: vi.fn(),
        },
      },
    };
    getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    ensureProfileRowMock.mockResolvedValue({});

    const response = await acceptInvitePOST(
      new NextRequest('https://www.nabatable.com/api/team/invitations/raw-token/accept', {
        method: 'POST',
        body: JSON.stringify({ password: 'attacker-password', name: 'Victim' }),
      }),
      { params: Promise.resolve({ token: 'raw-token-value' }) },
    );

    expect(response.status).toBe(200);
    expect(serviceClient.rpc).toHaveBeenCalledWith('accept_restaurant_invite', {
      p_invite_id: invite.id,
      p_user_id: INVITED_USER_ID,
      p_restaurant_id: RESTAURANT_ID,
      p_role: invite.role,
    });
    expect(serviceClient.auth.admin.createUser).not.toHaveBeenCalled();
    expect(serviceClient.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('rejects invite acceptance when the session email does not match the invite email', async () => {
    const invite = makeInvite();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(
      buildRouteSession({ id: INVITED_USER_ID, email: 'attacker@example.com' }),
    );
    getServiceSupabaseClientMock.mockReturnValue({
      ...buildInviteAcceptClient({ inviterRole: 'owner', foundInvite: invite }),
    });

    const response = await acceptInvitePOST(
      new NextRequest('https://www.nabatable.com/api/team/invitations/raw-token/accept', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ token: 'raw-token-value' }) },
    );

    expect(response.status).toBe(403);
  });

  it('fails replayed invites before membership side effects', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(
      buildRouteSession({ id: INVITED_USER_ID, email: 'victim@example.com' }),
    );
    getServiceSupabaseClientMock.mockReturnValue(
      buildInviteAcceptClient({ foundInvite: makeInvite({ status: 'accepted' }) }),
    );

    const response = await acceptInvitePOST(
      new NextRequest('https://www.nabatable.com/api/team/invitations/raw-token/accept', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ token: 'raw-token-value' }) },
    );

    expect(response.status).toBe(409);
  });

  it('revalidates invite role before membership upsert', async () => {
    const invite = makeInvite({ role: 'owner' });
    const client = buildInviteAcceptClient({ inviterRole: 'manager' });
    requireMembershipForRestaurantMock.mockResolvedValueOnce({ role: 'manager' });

    await expect(
      acceptInviteForAuthenticatedUser({
        invite,
        userId: INVITED_USER_ID,
        userEmail: 'victim@example.com',
        client: client as never,
      }),
    ).rejects.toMatchObject({ code: 'INVITE_ROLE_FORBIDDEN' });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('revokeRestaurantInvite reports already-processed invites without hard deletion', async () => {
    const deleteMock = vi.fn();
    const updateMock = vi.fn();
    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateMock.mockReturnValue(updateQuery);
    const client = {
      from: vi.fn(() => ({
        delete: deleteMock,
        update: updateMock,
      })),
    };

    await expect(
      revokeRestaurantInvite({
        inviteId: makeInvite().id,
        restaurantId: RESTAURANT_ID,
        authClient: client as never,
      }),
    ).rejects.toMatchObject({ code: 'INVITE_NOT_FOUND' });

    expect(client.from).toHaveBeenCalledWith('restaurant_invites');
    expect(deleteMock).not.toHaveBeenCalled();
    expect(updateQuery.eq).toHaveBeenCalledWith('status', 'pending');
  });
});
