import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const GuardErrorMock = vi.hoisted(
  () =>
    class GuardError extends Error {
      status: number;
      code: string;
      details?: unknown;

      constructor(params: { status: number; code: string; message: string; details?: unknown }) {
        super(params.message);
        this.name = 'GuardError';
        this.status = params.status;
        this.code = params.code;
        this.details = params.details;
      }
    },
);
const requireSessionMock = vi.hoisted(() => vi.fn());
const listUserRestaurantMembershipsMock = vi.hoisted(() => vi.fn());
const withPlatformAdminAuthorizationMock = vi.hoisted(() => vi.fn());
const fetchAllOccasionsMock = vi.hoisted(() => vi.fn());
const createOccasionMock = vi.hoisted(() => vi.fn());
const fetchOccasionByKeyMock = vi.hoisted(() => vi.fn());
const deleteOccasionMock = vi.hoisted(() => vi.fn());
const clearOccasionCatalogCacheMock = vi.hoisted(() => vi.fn());
const OccasionAlreadyExistsErrorMock = vi.hoisted(
  () =>
    class OccasionAlreadyExistsError extends Error {
      constructor() {
        super('Occasion already exists');
        this.name = 'OccasionAlreadyExistsError';
      }
    },
);

vi.mock('@/server/auth/guards', () => ({
  GuardError: GuardErrorMock,
  listUserRestaurantMemberships: listUserRestaurantMembershipsMock,
  requireSession: requireSessionMock,
  withPlatformAdminAuthorization: withPlatformAdminAuthorizationMock,
}));

vi.mock('@/server/occasions/admin', () => ({
  fetchAllOccasions: fetchAllOccasionsMock,
  createOccasion: createOccasionMock,
  fetchOccasionByKey: fetchOccasionByKeyMock,
  deleteOccasion: deleteOccasionMock,
  OccasionAlreadyExistsError: OccasionAlreadyExistsErrorMock,
  insertAudit: vi.fn(),
  toAdminOccasion: vi.fn((occasion) => occasion),
}));

vi.mock('@/server/occasions/catalog', () => ({
  clearOccasionCatalogCache: clearOccasionCatalogCacheMock,
}));

vi.mock('@/server/auth/supabase-auth-errors', () => ({
  mapSupabaseAuthError: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
  getServiceSupabaseClient: vi.fn(),
}));

import { DELETE } from '@/src/app/api/ops/occasions/[key]/route';
import { GET, POST } from '@/src/app/api/ops/occasions/route';

describe('ops occasions route security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockReset();
    listUserRestaurantMembershipsMock.mockReset();
    withPlatformAdminAuthorizationMock.mockReset();
    fetchAllOccasionsMock.mockReset();
    createOccasionMock.mockReset();
  });

  it('lists the occasion catalog for authenticated restaurant members @api @security', async () => {
    requireSessionMock.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: 'owner@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([{ restaurant_id: 'restaurant-1' }]);
    fetchAllOccasionsMock.mockResolvedValue([{ key: 'dinner', label: 'Dinner' }]);

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ occasions: [{ key: 'dinner', label: 'Dinner' }] });
    expect(withPlatformAdminAuthorizationMock).not.toHaveBeenCalled();
    expect(fetchAllOccasionsMock).toHaveBeenCalledOnce();
  });

  it('rejects occasion catalog reads from authenticated users without a restaurant membership @api @security', async () => {
    requireSessionMock.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: 'owner@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([]);

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });

  it('maps session guard failures before listing the occasion catalog @api @security', async () => {
    requireSessionMock.mockRejectedValue(
      new GuardErrorMock({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      }),
    );

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });

  it('keeps platform admin authorization required for occasion mutations @api @security', async () => {
    withPlatformAdminAuthorizationMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Platform administrator access required' }), {
        status: 403,
      }),
    });

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/ops/occasions', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    expect(withPlatformAdminAuthorizationMock).toHaveBeenCalledWith(expect.any(NextRequest), {
      csrf: true,
    });
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });

  describe('platform-admin writes', () => {
    const adminUser = { id: '33333333-3333-4333-8333-333333333333', email: 'admin@example.com' };

    function postRequest(body: unknown) {
      return new NextRequest('https://app.nabatable.com/api/ops/occasions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    beforeEach(() => {
      withPlatformAdminAuthorizationMock.mockResolvedValue({
        ok: true,
        user: adminUser,
        platformAdmin: true,
      });
    });

    it('creates through the single atomic helper and clears the catalog cache', async () => {
      createOccasionMock.mockResolvedValue({ key: 'brunch', label: 'Brunch' });

      const response = await POST(postRequest({ key: 'brunch', label: 'Brunch' }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ occasion: { key: 'brunch', label: 'Brunch' } });
      expect(createOccasionMock).toHaveBeenCalledTimes(1);
      expect(createOccasionMock).toHaveBeenCalledWith(
        { key: 'brunch', label: 'Brunch' },
        adminUser.id,
      );
      expect(clearOccasionCatalogCacheMock).toHaveBeenCalledOnce();
    });

    it('answers a taken key with 409 OCCASION_ALREADY_EXISTS, not a generic conflict', async () => {
      createOccasionMock.mockRejectedValue(new OccasionAlreadyExistsErrorMock());

      const response = await POST(postRequest({ key: 'brunch', label: 'Brunch' }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe('OCCASION_ALREADY_EXISTS');
      expect(clearOccasionCatalogCacheMock).not.toHaveBeenCalled();
    });

    it('validates the body at the boundary', async () => {
      const response = await POST(
        postRequest({ key: 'Bad Key', label: '', defaultDurationMinutes: 99999 }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(body.fields)).toEqual(
        expect.arrayContaining(['key', 'label', 'defaultDurationMinutes']),
      );
      expect(createOccasionMock).not.toHaveBeenCalled();
    });

    it('never echoes database text from a failed create', async () => {
      createOccasionMock.mockRejectedValue(new Error('SECRET_DB_DETAIL admin@example.com'));

      const response = await POST(postRequest({ key: 'brunch', label: 'Brunch' }));
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(text).code).toBe('INTERNAL_ERROR');
      expect(text).not.toContain('SECRET_DB_DETAIL');
    });

    it('refuses to delete a type still used by upcoming bookings or meal times with OCCASION_IN_USE', async () => {
      deleteOccasionMock.mockResolvedValue({
        status: 'in_use',
        futureBookings: 0,
        servicePeriods: 2,
      });

      const response = await DELETE(
        new NextRequest('https://app.nabatable.com/api/ops/occasions/brunch', { method: 'DELETE' }),
        { params: Promise.resolve({ key: 'brunch' }) },
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        code: 'OCCASION_IN_USE',
        details: { futureBookings: 0, servicePeriods: 2 },
      });
      // One atomic call: no separate read or count before the write.
      expect(deleteOccasionMock).toHaveBeenCalledWith('brunch', expect.any(String));
      expect(fetchOccasionByKeyMock).not.toHaveBeenCalled();
      expect(clearOccasionCatalogCacheMock).not.toHaveBeenCalled();
    });

    it.each([
      [{ status: 'not_found' }, 404, 'OCCASION_NOT_FOUND'],
      [{ status: 'builtin' }, 400, 'OCCASION_BUILTIN'],
    ])('maps a refused delete %j to %i %s', async (result, status, code) => {
      deleteOccasionMock.mockResolvedValue(result);

      const response = await DELETE(
        new NextRequest('https://app.nabatable.com/api/ops/occasions/brunch', { method: 'DELETE' }),
        { params: Promise.resolve({ key: 'brunch' }) },
      );

      expect(response.status).toBe(status);
      expect((await response.json()).code).toBe(code);
      expect(clearOccasionCatalogCacheMock).not.toHaveBeenCalled();
    });

    it('deletes atomically and clears the catalog cache', async () => {
      deleteOccasionMock.mockResolvedValue({ status: 'deleted' });

      const response = await DELETE(
        new NextRequest('https://app.nabatable.com/api/ops/occasions/brunch', { method: 'DELETE' }),
        { params: Promise.resolve({ key: 'brunch' }) },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(clearOccasionCatalogCacheMock).toHaveBeenCalledTimes(1);
    });

    it('never echoes database text from a failed delete', async () => {
      deleteOccasionMock.mockRejectedValue(new Error('SECRET_DB_DETAIL'));

      const response = await DELETE(
        new NextRequest('https://app.nabatable.com/api/ops/occasions/brunch', { method: 'DELETE' }),
        { params: Promise.resolve({ key: 'brunch' }) },
      );
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).not.toContain('SECRET_DB_DETAIL');
    });
  });
});
