import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getAllCustomersWithHistoryMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/ops/customers', () => ({
  getAllCustomersWithHistory: getAllCustomersWithHistoryMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
}));

import { GET } from '@/src/app/api/ops/customers/export/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

function request(search = '') {
  return new NextRequest(`https://app.nabatable.com/api/ops/customers/export${search}`);
}

function mockAuthenticatedSupabase(userId = 'user-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  };
}

describe('GET /api/ops/customers/export', () => {
  beforeEach(() => {
    fetchUserMembershipsMock.mockReset();
    getAllCustomersWithHistoryMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    requireApiRateLimitMock.mockReset();

    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase());
    getServiceSupabaseClientMock.mockReturnValue({ service: true });
    fetchUserMembershipsMock.mockResolvedValue([
      {
        restaurant_id: RESTAURANT_ID,
        restaurants: { name: 'QA Venue' },
      },
    ]);
    requireApiRateLimitMock.mockResolvedValue(null);
    getAllCustomersWithHistoryMock.mockResolvedValue([]);
  });

  it('rejects unauthenticated exports before membership or export queries @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const response = await GET(request(`?restaurantId=${RESTAURANT_ID}`));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
    expect(fetchUserMembershipsMock).not.toHaveBeenCalled();
    expect(requireApiRateLimitMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getAllCustomersWithHistoryMock).not.toHaveBeenCalled();
  });

  it('blocks cross-tenant exports before rate limit or service-role export reads @p1 @api @security', async () => {
    const response = await GET(request(`?restaurantId=${OTHER_RESTAURANT_ID}`));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: "You don't have permission to do that.",
      code: 'FORBIDDEN',
      message: "You don't have permission to do that.",
    });
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith('user-1', expect.anything());
    expect(requireApiRateLimitMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getAllCustomersWithHistoryMock).not.toHaveBeenCalled();
  });

  it('exports only the authorized tenant and sanitizes risky CSV cells @p1 @api @security', async () => {
    const serviceSupabase = { service: true };
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);
    getAllCustomersWithHistoryMock.mockResolvedValue([
      {
        id: 'customer-1',
        restaurantId: RESTAURANT_ID,
        name: '=HYPERLINK("https://evil.example")',
        email: '+SUM(1,2)',
        phone: '@cmd',
        marketingOptIn: true,
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
        firstBookingAt: '2026-05-02T18:00:00.000Z',
        lastVisitAt: '2026-05-03T18:00:00.000Z',
        totalBookings: 3,
        totalCovers: 8,
        totalCancellations: 0,
      },
    ]);

    const response = await GET(
      request(
        `?restaurantId=${RESTAURANT_ID}&search=alex&marketingOptIn=opted_in&lastVisit=90d&minBookings=2&sort=asc&sortBy=bookings`,
      ),
    );
    const bodyBytes = new Uint8Array(await response.arrayBuffer());
    const csv = new TextDecoder().decode(bodyBytes);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="guests-qa-venue-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(Array.from(bodyBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain('Name,Email,Phone,Total Bookings');
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.example"")"');
    expect(csv).toContain('"\'+SUM(1,2)"');
    expect(csv).toContain("'@cmd");
    expect(getAllCustomersWithHistoryMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      sortOrder: 'asc',
      sortBy: 'bookings',
      search: 'alex',
      marketingOptIn: 'opted_in',
      lastVisit: '90d',
      minBookings: 2,
      client: serviceSupabase,
      maxRows: 5000,
    });
  });

  it('returns rate-limit responses before export reads @p1 @api @security', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many export requests. Please try again later.' }), {
        status: 429,
      }),
    );

    const response = await GET(request(`?restaurantId=${RESTAURANT_ID}`));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: 'Too many export requests. Please try again later.' });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getAllCustomersWithHistoryMock).not.toHaveBeenCalled();
  });
});
