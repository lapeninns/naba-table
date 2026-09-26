import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const listZonesMock = vi.hoisted(() => vi.fn());
const createZoneMock = vi.hoisted(() => vi.fn());
const updateZoneMock = vi.hoisted(() => vi.fn());
const deleteZoneMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/ops/zones', () => ({
  listZones: listZonesMock,
  createZone: createZoneMock,
  updateZone: updateZoneMock,
  deleteZone: deleteZoneMock,
}));

// CSRF failure telemetry writes security events; keep the suite offline.
vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: vi.fn(),
}));

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { DELETE, PATCH } from '@/src/app/api/ops/zones/[id]/route';
import { GET, POST } from '@/src/app/api/ops/zones/route';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';
const ZONE_ID = '33333333-3333-4333-8333-333333333333';
const CSRF_TOKEN = 'ops-zones-csrf-token';

function csrfHeaders() {
  return {
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  };
}

function getRequest(query: string) {
  return new NextRequest(`https://app.nabatable.com/api/ops/zones${query}`);
}

function mutationRequest(path: string, method: string, body?: unknown, includeCsrf = true) {
  return new NextRequest(`https://app.nabatable.com${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: includeCsrf
      ? { 'content-type': 'application/json', ...csrfHeaders() }
      : { 'content-type': 'application/json' },
  });
}

function zoneContext(id: string = ZONE_ID) {
  return { params: Promise.resolve({ id }) };
}

type SupabaseFixture = {
  user?: { id: string } | null;
  membership?: { role: string } | null;
  membershipError?: { message: string } | null;
  zone?: { id: string; restaurant_id: string } | null;
  zoneError?: { message: string } | null;
};

type RecordedCall = { table: string; method: string; args: unknown[] };

function buildSupabase(fixture: SupabaseFixture = {}) {
  const {
    user = { id: 'user-1' },
    membership = { role: 'owner' },
    membershipError = null,
    zone = { id: ZONE_ID, restaurant_id: RESTAURANT_A },
    zoneError = null,
  } = fixture;

  const calls: RecordedCall[] = [];

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn((...args: unknown[]) => {
          calls.push({ table, method: 'select', args });
          return chain;
        }),
        eq: vi.fn((...args: unknown[]) => {
          calls.push({ table, method: 'eq', args });
          return chain;
        }),
        maybeSingle: vi.fn(async () => {
          calls.push({ table, method: 'maybeSingle', args: [] });
          if (table === 'restaurant_memberships') {
            return { data: membership, error: membershipError };
          }
          if (table === 'zones') {
            return { data: zone, error: zoneError };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };
      return chain;
    }),
  };

  return { client, calls };
}

beforeEach(() => {
  getRouteHandlerSupabaseClientMock.mockReset();
  listZonesMock.mockReset();
  createZoneMock.mockReset();
  updateZoneMock.mockReset();
  deleteZoneMock.mockReset();
});

describe('GET/POST /api/ops/zones', () => {
  it('rejects unauthenticated zone listings @p1 @api @security', async () => {
    const { client } = buildSupabase({ user: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_A}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(listZonesMock).not.toHaveBeenCalled();
  });

  it('rejects zone listings without a valid restaurantId @p1 @api @contract', async () => {
    const { client } = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await GET(getRequest('?restaurantId=not-a-uuid'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { restaurantId: [expect.any(String)] },
    });
    expect(listZonesMock).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant zone listings when membership is missing @p1 @api @security', async () => {
    const { client, calls } = buildSupabase({ membership: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_A}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(calls).toContainEqual({
      table: 'restaurant_memberships',
      method: 'eq',
      args: ['restaurant_id', RESTAURANT_A],
    });
    expect(listZonesMock).not.toHaveBeenCalled();
  });

  it('lists zones through the RLS-scoped client for members @p1 @api', async () => {
    const { client } = buildSupabase({ membership: { role: 'host' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    listZonesMock.mockResolvedValue([
      { id: ZONE_ID, restaurant_id: RESTAURANT_A, name: 'Main Dining' },
    ]);

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_A}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      zones: [{ id: ZONE_ID, restaurant_id: RESTAURANT_A, name: 'Main Dining' }],
    });
    expect(listZonesMock).toHaveBeenCalledWith(client, RESTAURANT_A);
  });

  it('rejects zone creation without a CSRF token before any auth work @p1 @api @security', async () => {
    const response = await POST(
      mutationRequest('/api/ops/zones', 'POST', { restaurantId: RESTAURANT_A, name: 'Bar' }, false),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  it('rejects invalid zone creation payloads @p1 @api @contract', async () => {
    const { client } = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await POST(
      mutationRequest('/api/ops/zones', 'POST', { restaurantId: RESTAURANT_A }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields).toBeDefined();
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only zone names after trimming @p2 @api @contract', async () => {
    const { client } = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await POST(
      mutationRequest('/api/ops/zones', 'POST', { restaurantId: RESTAURANT_A, name: '   ' }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { name: [expect.any(String)] },
    });
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  it('rejects zone creation for restaurants the user is not a member of @p1 @api @security', async () => {
    const { client } = buildSupabase({ membership: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await POST(
      mutationRequest('/api/ops/zones', 'POST', { restaurantId: RESTAURANT_B, name: 'Patio' }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  it('rejects zone creation for non-admin members @p1 @api @security', async () => {
    const { client } = buildSupabase({ membership: { role: 'host' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await POST(
      mutationRequest('/api/ops/zones', 'POST', { restaurantId: RESTAURANT_A, name: 'Patio' }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' });
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  it('creates zones through the RLS-scoped client for admins @p1 @api', async () => {
    const { client } = buildSupabase({ membership: { role: 'manager' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    createZoneMock.mockResolvedValue({
      id: ZONE_ID,
      restaurant_id: RESTAURANT_A,
      name: 'Terrace',
      sort_order: 0,
      active: true,
    });

    const response = await POST(
      mutationRequest('/api/ops/zones', 'POST', {
        restaurantId: RESTAURANT_A,
        name: '  Terrace  ',
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      zone: {
        id: ZONE_ID,
        restaurant_id: RESTAURANT_A,
        name: 'Terrace',
        sort_order: 0,
        active: true,
      },
    });
    expect(createZoneMock).toHaveBeenCalledWith(client, {
      restaurantId: RESTAURANT_A,
      name: 'Terrace',
      sortOrder: 0,
      active: true,
    });
  });
});

describe('PATCH/DELETE /api/ops/zones/[id]', () => {
  it.each([
    ['PATCH', (req: NextRequest) => PATCH(req, zoneContext()), { name: 'Renamed' }],
    ['DELETE', (req: NextRequest) => DELETE(req, zoneContext()), undefined],
  ] as const)(
    'rejects %s without a CSRF token before any auth work @p1 @api @security',
    async (method, invoke, body) => {
      const response = await invoke(
        mutationRequest(`/api/ops/zones/${ZONE_ID}`, method, body, false),
      );
      const parsed = await response.json();

      expect(response.status).toBe(403);
      expect(parsed.code).toBe('CSRF_INVALID');
      expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
      expect(updateZoneMock).not.toHaveBeenCalled();
      expect(deleteZoneMock).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid zone update payloads @p1 @api @contract', async () => {
    const { client } = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await PATCH(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'PATCH', { sortOrder: 99999 }),
      zoneContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the zone is not visible to the caller @p1 @api @security', async () => {
    const { client } = buildSupabase({ zone: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await PATCH(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'PATCH', { name: 'Renamed' }),
      zoneContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'ZONE_NOT_FOUND' });
    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  it("rejects updates to another restaurant's zone when membership is missing @p1 @api @security", async () => {
    const { client, calls } = buildSupabase({
      zone: { id: ZONE_ID, restaurant_id: RESTAURANT_B },
      membership: null,
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await PATCH(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'PATCH', { name: 'Hijacked' }),
      zoneContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    // Membership is checked against the zone's own restaurant, not caller input.
    expect(calls).toContainEqual({
      table: 'restaurant_memberships',
      method: 'eq',
      args: ['restaurant_id', RESTAURANT_B],
    });
    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  it('rejects zone updates from non-admin members @p1 @api @security', async () => {
    const { client } = buildSupabase({ membership: { role: 'server' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await PATCH(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'PATCH', { name: 'Renamed' }),
      zoneContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' });
    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  it('updates zones through the RLS-scoped client for admins @p1 @api', async () => {
    const { client } = buildSupabase({ membership: { role: 'owner' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    updateZoneMock.mockResolvedValue({
      id: ZONE_ID,
      restaurant_id: RESTAURANT_A,
      name: 'Renamed',
      sort_order: 5,
      active: true,
    });

    const response = await PATCH(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'PATCH', { name: ' Renamed ', sortOrder: 5 }),
      zoneContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      zone: {
        id: ZONE_ID,
        restaurant_id: RESTAURANT_A,
        name: 'Renamed',
        sort_order: 5,
        active: true,
      },
    });
    expect(updateZoneMock).toHaveBeenCalledWith(client, ZONE_ID, {
      name: 'Renamed',
      sortOrder: 5,
      active: undefined,
    });
  });

  it("returns 404 for deletes of another restaurant's zone hidden by RLS @p1 @api @security", async () => {
    const { client } = buildSupabase({ zone: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await DELETE(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'DELETE'),
      zoneContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'ZONE_NOT_FOUND' });
    expect(deleteZoneMock).not.toHaveBeenCalled();
  });

  it('rejects zone deletes from non-admin members @p1 @api @security', async () => {
    const { client } = buildSupabase({ membership: { role: 'host' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await DELETE(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'DELETE'),
      zoneContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' });
    expect(deleteZoneMock).not.toHaveBeenCalled();
  });

  it('deletes zones through the RLS-scoped client for admins @p1 @api @destructive', async () => {
    const { client } = buildSupabase({ membership: { role: 'owner' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    deleteZoneMock.mockResolvedValue(undefined);

    const response = await DELETE(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'DELETE'),
      zoneContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(deleteZoneMock).toHaveBeenCalledWith(client, ZONE_ID);
  });

  it('maps foreign-key delete conflicts to 409 when tables still use the zone @p2 @api', async () => {
    const { client } = buildSupabase({ membership: { role: 'owner' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    deleteZoneMock.mockRejectedValue(
      Object.assign(new Error('violates foreign key constraint'), { code: '23503' }),
    );

    const response = await DELETE(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'DELETE'),
      zoneContext(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'ZONE_IN_USE' });
  });

  it('maps duplicate zone names to 409 ZONE_NAME_TAKEN on create and rename @p2 @api', async () => {
    const { client } = buildSupabase({ membership: { role: 'owner' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    createZoneMock.mockRejectedValue(duplicate);
    updateZoneMock.mockRejectedValue(duplicate);

    const created = await POST(
      mutationRequest('/api/ops/zones', 'POST', { restaurantId: RESTAURANT_A, name: 'Patio' }),
    );
    expect(created.status).toBe(409);
    await expect(created.json()).resolves.toMatchObject({ code: 'ZONE_NAME_TAKEN' });

    const renamed = await PATCH(
      mutationRequest(`/api/ops/zones/${ZONE_ID}`, 'PATCH', { name: 'Patio' }),
      zoneContext(),
    );
    expect(renamed.status).toBe(409);
    const text = await renamed.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'ZONE_NAME_TAKEN' });
    expect(text).not.toContain('duplicate key');
  });

  it('never returns database text for unexpected failures @p1 @api @security', async () => {
    const { client } = buildSupabase({ membership: { role: 'owner' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);
    listZonesMock.mockRejectedValue(new Error('relation "secret_zones" does not exist'));

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_A}`));

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(text).not.toContain('secret_zones');
  });

  it('treats a malformed zone id as not found instead of a 500 @p2 @api', async () => {
    const { client } = buildSupabase({ membership: { role: 'owner' } });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(client);

    const response = await DELETE(
      mutationRequest('/api/ops/zones/not-a-uuid', 'DELETE'),
      zoneContext('not-a-uuid'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'ZONE_NOT_FOUND' });
    expect(deleteZoneMock).not.toHaveBeenCalled();
  });
});
