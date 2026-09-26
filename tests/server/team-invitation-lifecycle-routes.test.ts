import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import {
  getInviteAvailability,
  resolveInviteExpiry,
  type RestaurantInvite,
} from '@/server/team/invitations';
import { POST as resendInvitePOST } from '@/src/app/api/ops/team/invitations/[id]/resend/route';
import { DELETE as revokeInviteDELETE } from '@/src/app/api/ops/team/invitations/[id]/route';
import { POST as createInvitePOST } from '@/src/app/api/ops/team/invitations/route';
import { POST as acceptInvitePOST } from '@/src/app/api/team/invitations/[token]/accept/route';
import { GET as inviteTokenGET } from '@/src/app/api/team/invitations/[token]/route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureProfileRowMock = vi.hoisted(() => vi.fn());
const sendTeamInviteEmailMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));
vi.mock('@/lib/profile/server', () => ({ ensureProfileRow: ensureProfileRowMock }));
vi.mock('@/server/emails/invitations', () => ({ sendTeamInviteEmail: sendTeamInviteEmailMock }));
vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));
vi.mock('@/lib/logger', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/logger');
  return { ...actual, logger: loggerMock };
});
vi.mock('@/server/team/access', async () => {
  const actual = await vi.importActual('@/server/team/access');
  return {
    ...(actual as object),
    requireAdminMembership: requireAdminMembershipMock,
    requireMembershipForRestaurant: requireMembershipForRestaurantMock,
    invalidateUserMembershipsCache: vi.fn(),
  };
});

const RESTAURANT_ID = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const INVITE_ID = '657902e8-8e0d-49bc-9614-67bd6d7d8cbd';
const INVITER_ID = '33eeab93-378a-41c0-bfaa-9e2e73b7920e';
const INVITED_USER_ID = '0b106691-80b1-4f92-91c3-d8f4a9d5fd48';
const CSRF_TOKEN = 'team-invite-csrf-token';
const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE = new Date(Date.now() + 7 * DAY_MS).toISOString();
const PAST = new Date(Date.now() - DAY_MS).toISOString();

function csrfHeaders(): Headers {
  return new Headers({
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  });
}

function makeInvite(overrides: Partial<RestaurantInvite> = {}): RestaurantInvite {
  return {
    id: INVITE_ID,
    restaurant_id: RESTAURANT_ID,
    email: 'invitee@example.com',
    email_normalized: 'invitee@example.com',
    role: 'host',
    token_hash: 'hashed-token',
    status: 'pending',
    expires_at: FUTURE,
    invited_by: INVITER_ID,
    accepted_at: null,
    revoked_at: null,
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    ...overrides,
  } as RestaurantInvite;
}

type Call = { method: string; args: unknown[] };
type Chain = { table: string; calls: Call[] };
type Resolver = (chain: Chain) => { data?: unknown; error?: unknown };

/** A chainable Supabase query fake. The resolver answers each finished chain. */
function buildDb(resolve: Resolver) {
  const chains: Chain[] = [];
  const from = vi.fn((table: string) => {
    const chain: Chain = { table, calls: [] };
    chains.push(chain);
    const settle = () => Promise.resolve({ data: null, error: null, ...resolve(chain) });
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'update', 'insert', 'eq', 'gt', 'lt', 'order']) {
      builder[method] = (...args: unknown[]) => {
        chain.calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      chain.calls.push({ method: 'maybeSingle', args: [] });
      return settle();
    };
    builder.single = () => {
      chain.calls.push({ method: 'single', args: [] });
      return settle();
    };
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => settle().then(onFulfilled, onRejected);
    return builder;
  });
  return { from, chains };
}

function has(chain: Chain, method: string, predicate?: (args: unknown[]) => boolean) {
  return chain.calls.some((call) => call.method === method && (!predicate || predicate(call.args)));
}

function sessionClient(
  db: ReturnType<typeof buildDb>,
  user = { id: INVITER_ID, email: 'owner@example.com' },
) {
  return {
    ...db,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('https://app.nabatable.com/api/ops/team/invitations', {
    method: 'POST',
    headers: csrfHeaders(),
    body: JSON.stringify({ restaurantId: RESTAURANT_ID, role: 'host', ...body }),
  });
}

function resendRequest(headers: Headers = csrfHeaders()) {
  return new NextRequest(`https://app.nabatable.com/api/ops/team/invitations/${INVITE_ID}/resend`, {
    method: 'POST',
    headers,
  });
}

const inviteParams = () => ({ params: Promise.resolve({ id: INVITE_ID }) });

describe('team invitation lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiRateLimitMock.mockResolvedValue(null);
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'owner' });
    ensureProfileRowMock.mockResolvedValue({});
    sendTeamInviteEmailMock.mockResolvedValue({ delivered: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('resolveInviteExpiry', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');

    it('defaults to 7 days', () => {
      expect(resolveInviteExpiry(undefined, now)).toBe('2026-09-08T00:00:00.000Z');
    });

    it('clamps requests to between 1 and 30 days from now', () => {
      expect(resolveInviteExpiry('2027-09-01T00:00:00.000Z', now)).toBe('2026-10-01T00:00:00.000Z');
      expect(resolveInviteExpiry('2020-01-01T00:00:00.000Z', now)).toBe('2026-09-02T00:00:00.000Z');
      expect(resolveInviteExpiry('2026-09-15T12:00:00.000Z', now)).toBe('2026-09-15T12:00:00.000Z');
    });
  });

  it('treats a pending invite past its expiry as expired', () => {
    expect(getInviteAvailability(makeInvite({ expires_at: PAST }))).toBe('expired');
    expect(getInviteAvailability(makeInvite())).toBe('pending');
    expect(getInviteAvailability(makeInvite({ status: 'accepted', expires_at: PAST }))).toBe(
      'accepted',
    );
  });

  describe('create', () => {
    function createDb(invite = makeInvite()) {
      return buildDb((chain) => (has(chain, 'insert') ? { data: invite } : {}));
    }

    it('returns 201 with emailSent: false when the email fails, and logs no address', async () => {
      const db = createDb();
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));
      sendTeamInviteEmailMock.mockRejectedValue(new Error('Provider rejected invitee@example.com'));

      const response = await createInvitePOST(createRequest({ email: 'invitee@example.com' }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.emailSent).toBe(false);
      expect(body.invite).toMatchObject({ id: INVITE_ID, status: 'pending' });
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'team_invite.email_failed',
        expect.objectContaining({ inviteId: INVITE_ID, restaurantId: RESTAURANT_ID }),
      );
      expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain('invitee@example.com');
    });

    it('reports a suppressed recipient as emailSent: false', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(createDb()));
      sendTeamInviteEmailMock.mockResolvedValue({ delivered: false });

      const response = await createInvitePOST(createRequest({ email: 'invitee@example.com' }));

      expect(response.status).toBe(201);
      expect((await response.json()).emailSent).toBe(false);
    });

    it('clamps a requested expiry to 30 days', async () => {
      const db = createDb();
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

      await createInvitePOST(
        createRequest({ email: 'invitee@example.com', expiresAt: '2099-01-01T00:00:00.000Z' }),
      );

      const insertChain = db.chains.find((chain) => has(chain, 'insert'));
      const inserted = insertChain?.calls.find((call) => call.method === 'insert')?.args[0] as {
        expires_at: string;
      };
      const days = (new Date(inserted.expires_at).getTime() - Date.now()) / DAY_MS;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('expires stale pending invites before inserting, so re-inviting after expiry works', async () => {
      const db = createDb();
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

      await createInvitePOST(createRequest({ email: 'invitee@example.com' }));

      const expireIndex = db.chains.findIndex(
        (chain) =>
          has(chain, 'update', (args) => (args[0] as { status?: string }).status === 'expired') &&
          has(chain, 'lt', (args) => args[0] === 'expires_at'),
      );
      const insertIndex = db.chains.findIndex((chain) => has(chain, 'insert'));
      expect(expireIndex).toBeGreaterThanOrEqual(0);
      expect(expireIndex).toBeLessThan(insertIndex);
    });

    it('returns a C1 conflict for an invite that is already waiting', async () => {
      const db = buildDb((chain) =>
        has(chain, 'insert') ? { error: { code: '23505', message: 'duplicate key' } } : {},
      );
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

      const response = await createInvitePOST(createRequest({ email: 'invitee@example.com' }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({ code: 'INVITE_ALREADY_PENDING', message: expect.any(String) });
      expect(body.error).toBe(body.message);
      expect(JSON.stringify(body)).not.toContain('duplicate key');
    });

    it('returns C1 validation fields for a bad payload', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(createDb()));

      const response = await createInvitePOST(createRequest({ email: 'not-an-email' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.fields.email).toBeDefined();
    });

    it('hides database text behind a generic 500', async () => {
      const db = buildDb((chain) =>
        has(chain, 'insert')
          ? { error: { code: 'XX000', message: 'relation secret_internal' } }
          : {},
      );
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

      const response = await createInvitePOST(createRequest({ email: 'invitee@example.com' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(body)).not.toContain('secret_internal');
    });
  });

  describe('resend', () => {
    function resendDb(options: {
      /** The guarded pending read; defaults to a pending invite with hash 'hashed-token'. */
      pending?: RestaurantInvite | null;
      rotated?: RestaurantInvite | null;
      current?: RestaurantInvite | null;
      lookup?: { id: string; restaurant_id: string } | null;
    }) {
      return buildDb((chain) => {
        if (has(chain, 'update', (args) => 'token_hash' in (args[0] as object))) {
          const isRotation = has(
            chain,
            'eq',
            (args) => args[0] === 'token_hash' && args[1] === 'hashed-token',
          );
          return isRotation ? { data: options.rotated ?? null } : {};
        }
        if (has(chain, 'select', (args) => args[0] === 'id, restaurant_id')) {
          return {
            data:
              options.lookup === undefined
                ? { id: INVITE_ID, restaurant_id: RESTAURANT_ID }
                : options.lookup,
          };
        }
        if (has(chain, 'select') && has(chain, 'gt')) {
          return { data: options.pending === undefined ? makeInvite() : options.pending };
        }
        if (has(chain, 'select')) {
          return { data: options.current ?? null };
        }
        return {};
      });
    }

    function tokenUpdates(db: ReturnType<typeof buildDb>) {
      return db.chains
        .filter((chain) => has(chain, 'update', (args) => 'token_hash' in (args[0] as object)))
        .map((chain) => ({
          set: (
            chain.calls.find((call) => call.method === 'update')!.args[0] as {
              token_hash: string;
            }
          ).token_hash,
          guard: chain.calls.find((call) => call.method === 'eq' && call.args[0] === 'token_hash')
            ?.args[1],
        }));
    }

    it('rotates the token of a pending invite with one guarded update and re-sends it', async () => {
      const rotated = makeInvite({
        token_hash: 'new-hash',
        updated_at: '2026-05-02T12:00:00.000Z',
      });
      const db = resendDb({ rotated });
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

      const response = await resendInvitePOST(resendRequest(), inviteParams());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        invite: expect.objectContaining({ id: INVITE_ID, status: 'pending' }),
        emailSent: true,
      });
      expect(JSON.stringify(body)).not.toContain('new-hash');

      const updateChain = db.chains.find((chain) => has(chain, 'update'))!;
      const newHash = (
        updateChain.calls.find((call) => call.method === 'update')!.args[0] as {
          token_hash: string;
        }
      ).token_hash;
      expect(newHash).toMatch(/^[0-9a-f]{64}$/);
      expect(updateChain.calls).toEqual(
        expect.arrayContaining([
          { method: 'eq', args: ['id', INVITE_ID] },
          { method: 'eq', args: ['restaurant_id', RESTAURANT_ID] },
          { method: 'eq', args: ['token_hash', 'hashed-token'] },
          { method: 'eq', args: ['status', 'pending'] },
          { method: 'gt', args: ['expires_at', expect.any(String)] },
        ]),
      );
      // Delivered: the old hash is not restored.
      expect(tokenUpdates(db)).toHaveLength(1);

      const [{ invite, token }] = sendTeamInviteEmailMock.mock.calls[0] as [
        { invite: RestaurantInvite; token: string },
      ];
      expect(invite.id).toBe(INVITE_ID);
      const { hashInviteToken } = await import('@/server/team/invitations');
      expect(hashInviteToken(token)).toBe(newHash);
    });

    it('requires CSRF', async () => {
      const response = await resendInvitePOST(resendRequest(new Headers()), inviteParams());

      expect(response.status).toBe(403);
      expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    });

    it('is limited to owners and managers', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(resendDb({})));
      requireAdminMembershipMock.mockRejectedValue(
        Object.assign(new Error('denied'), { code: 'MEMBERSHIP_ROLE_DENIED' }),
      );

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('TEAM_INVITES_FORBIDDEN');
      expect(sendTeamInviteEmailMock).not.toHaveBeenCalled();
    });

    it('returns 404 for an invite the caller cannot see', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(
        sessionClient(resendDb({ lookup: null })),
      );

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(404);
      expect(sendTeamInviteEmailMock).not.toHaveBeenCalled();
    });

    it('is rate limited per invite before any side effect', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(
        sessionClient(resendDb({ rotated: makeInvite() })),
      );
      requireApiRateLimitMock.mockResolvedValueOnce(null).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'slow down', code: 'RATE_LIMITED' }), {
          status: 429,
        }),
      );

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(429);
      expect(requireApiRateLimitMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          scope: 'ops.team_invitations.resend',
          tenantId: RESTAURANT_ID,
          parts: [INVITE_ID],
        }),
      );
      expect(sendTeamInviteEmailMock).not.toHaveBeenCalled();
    });

    it('refuses invites that are no longer pending', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(
        sessionClient(resendDb({ pending: null, current: makeInvite({ status: 'accepted' }) })),
      );

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('INVITE_NOT_PENDING');
      expect(sendTeamInviteEmailMock).not.toHaveBeenCalled();
    });

    it('refuses pending invites past their expiry', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(
        sessionClient(resendDb({ pending: null, current: makeInvite({ expires_at: PAST }) })),
      );

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('INVITE_EXPIRED');
    });

    it('reports a failed email as a retryable 502 without provider text', async () => {
      const db = resendDb({ rotated: makeInvite() });
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));
      sendTeamInviteEmailMock.mockRejectedValue(
        new Error('provider exploded for invitee@example.com'),
      );

      const response = await resendInvitePOST(resendRequest(), inviteParams());
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body).toMatchObject({ code: 'INVITE_EMAIL_FAILED', retryable: true });
      expect(JSON.stringify(body)).not.toContain('exploded');
      expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain('invitee@example.com');

      // The previous link keeps working: the old hash is put back, guarded on the new one.
      const [rotation, restore] = tokenUpdates(db);
      expect(rotation).toEqual({
        set: expect.stringMatching(/^[0-9a-f]{64}$/),
        guard: 'hashed-token',
      });
      expect(restore).toEqual({ set: 'hashed-token', guard: rotation!.set });
    });

    it('keeps the previous link when the recipient is suppressed', async () => {
      const db = resendDb({ rotated: makeInvite() });
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));
      sendTeamInviteEmailMock.mockResolvedValue({ delivered: false });

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(422);
      const [rotation, restore] = tokenUpdates(db);
      expect(restore).toEqual({ set: 'hashed-token', guard: rotation!.set });
    });

    it('still reports the send failure when restoring the old link fails', async () => {
      const db = resendDb({ rotated: makeInvite() });
      const originalFrom = db.from;
      let tokenUpdateCount = 0;
      const client = sessionClient(db);
      client.from = vi.fn((table: string) => {
        const builder = originalFrom(table) as unknown as Record<
          string,
          (...a: unknown[]) => unknown
        >;
        const update = builder.update!;
        builder.update = (...args: unknown[]) => {
          if ('token_hash' in (args[0] as object) && ++tokenUpdateCount === 2) {
            throw new Error('db down');
          }
          return update(...args);
        };
        return builder;
      }) as unknown as typeof db.from;
      getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
      sendTeamInviteEmailMock.mockRejectedValue(new Error('provider down'));

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(502);
      expect(loggerMock.error).toHaveBeenCalledWith(
        'team_invite.resend_restore_failed',
        expect.objectContaining({ inviteId: INVITE_ID }),
      );
    });

    it('reports a concurrent rotation as a conflict without sending', async () => {
      const db = resendDb({ rotated: null, current: makeInvite({ token_hash: 'someone-else' }) });
      getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('INVITE_CHANGED');
      expect(sendTeamInviteEmailMock).not.toHaveBeenCalled();
    });

    it('reports a suppressed recipient', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(
        sessionClient(resendDb({ rotated: makeInvite() })),
      );
      sendTeamInviteEmailMock.mockResolvedValue({ delivered: false });

      const response = await resendInvitePOST(resendRequest(), inviteParams());

      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe('INVITE_EMAIL_SUPPRESSED');
    });
  });

  it('revoke returns a C1 conflict for an invite that is no longer pending', async () => {
    const db = buildDb((chain) => {
      if (has(chain, 'update')) return { data: null };
      return { data: { id: INVITE_ID, restaurant_id: RESTAURANT_ID } };
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionClient(db));

    const response = await revokeInviteDELETE(
      new NextRequest(`https://app.nabatable.com/api/ops/team/invitations/${INVITE_ID}`, {
        method: 'DELETE',
        headers: csrfHeaders(),
      }),
      inviteParams(),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: 'INVITE_NOT_PENDING', message: expect.any(String) });
  });

  describe('accept', () => {
    function acceptRequest() {
      return new NextRequest('https://www.nabatable.com/api/team/invitations/raw-token/accept', {
        method: 'POST',
        headers: csrfHeaders(),
        body: JSON.stringify({ name: 'Invitee Person' }),
      });
    }
    const tokenParams = () => ({ params: Promise.resolve({ token: 'raw-token-value' }) });

    function serviceClient(reads: RestaurantInvite[]) {
      let readIndex = 0;
      const db = buildDb((chain) => {
        if (chain.table === 'restaurant_memberships') {
          return { data: { restaurant_id: RESTAURANT_ID, role: 'owner' } };
        }
        if (has(chain, 'update')) return { data: null };
        const invite = reads[Math.min(readIndex, reads.length - 1)];
        readIndex += 1;
        return { data: invite };
      });
      return {
        ...db,
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'P0001', message: 'Invite is not pending or has expired' },
        }),
      };
    }

    beforeEach(() => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue(
        sessionClient(
          buildDb(() => ({})),
          { id: INVITED_USER_ID, email: 'invitee@example.com' },
        ),
      );
    });

    it('says "expired" when the invite expires between loading and the atomic accept', async () => {
      const service = serviceClient([makeInvite(), makeInvite({ expires_at: PAST })]);
      getServiceSupabaseClientMock.mockReturnValue(service);

      const response = await acceptInvitePOST(acceptRequest(), tokenParams());
      const body = await response.json();

      expect(service.rpc).toHaveBeenCalledWith('accept_restaurant_invite', expect.any(Object));
      expect(response.status).toBe(410);
      expect(body.code).toBe('INVITE_EXPIRED');
      expect(body.message).toMatch(/expired/i);
      expect(body.message).not.toMatch(/already accepted/i);
    });

    it('says "already accepted" only when it really was accepted', async () => {
      const service = serviceClient([makeInvite(), makeInvite({ status: 'accepted' })]);
      getServiceSupabaseClientMock.mockReturnValue(service);

      const response = await acceptInvitePOST(acceptRequest(), tokenParams());

      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('INVITE_ALREADY_ACCEPTED');
    });

    it('says "revoked" when it was revoked in the meantime', async () => {
      const service = serviceClient([makeInvite(), makeInvite({ status: 'revoked' })]);
      getServiceSupabaseClientMock.mockReturnValue(service);

      const response = await acceptInvitePOST(acceptRequest(), tokenParams());

      expect(response.status).toBe(410);
      expect((await response.json()).code).toBe('INVITE_REVOKED');
    });

    it('rejects an expired invite before calling the RPC', async () => {
      const service = serviceClient([makeInvite({ expires_at: PAST })]);
      getServiceSupabaseClientMock.mockReturnValue(service);

      const response = await acceptInvitePOST(acceptRequest(), tokenParams());

      expect(response.status).toBe(410);
      expect((await response.json()).code).toBe('INVITE_EXPIRED');
      expect(service.rpc).not.toHaveBeenCalled();
    });
  });

  it('token lookup returns C1 bodies for unavailable invites', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildDb((chain) =>
        has(chain, 'update') ? { data: null } : { data: makeInvite({ status: 'revoked' }) },
      ),
    );

    const response = await inviteTokenGET(
      new NextRequest('https://www.nabatable.com/api/team/invitations/raw-token-value'),
      { params: Promise.resolve({ token: 'raw-token-value' }) },
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      code: 'INVITE_REVOKED',
      message: expect.any(String),
      error: expect.any(String),
    });
  });
});
