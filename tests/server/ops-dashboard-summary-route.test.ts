import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSession = vi.fn();
const requireRestaurantMember = vi.fn();
const getTodayBookingsSummary = vi.fn();
const getServiceSupabaseClient = vi.fn(() => ({ tag: 'service-client' }));

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual('@/server/auth/guards');
  return {
    ...actual,
    requireSession,
    requireRestaurantMember,
  };
});

vi.mock('@/server/ops/bookings', () => ({
  getTodayBookingsSummary,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient,
}));

describe('GET /api/ops/dashboard/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 with retry guidance when membership validation is temporarily unavailable', async () => {
    const { GuardError } = await import('@/server/auth/guards');
    const { GET } = await import('@/src/app/api/ops/dashboard/summary/route');

    requireSession.mockResolvedValue({
      supabase: { tag: 'tenant-client' },
      user: { id: 'user-123' },
    });
    requireRestaurantMember.mockRejectedValue(
      new GuardError({
        status: 503,
        code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
        message: 'Membership verification is temporarily unavailable',
        details: { upstream: 'supabase' },
      }),
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/ops/dashboard/summary?restaurantId=11111111-1111-4111-8111-111111111111',
      ),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    await expect(response.json()).resolves.toEqual({
      error: 'Membership verification is temporarily unavailable',
      code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
    });
    expect(getTodayBookingsSummary).not.toHaveBeenCalled();
  });

  it('returns summary data after successful access validation', async () => {
    const { GET } = await import('@/src/app/api/ops/dashboard/summary/route');

    requireSession.mockResolvedValue({
      supabase: { tag: 'tenant-client' },
      user: { id: 'user-123' },
    });
    requireRestaurantMember.mockResolvedValue({
      restaurant_id: '11111111-1111-4111-8111-111111111111',
      role: 'manager',
    });
    getTodayBookingsSummary.mockResolvedValue({
      totalBookings: 12,
      covers: 34,
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/ops/dashboard/summary?restaurantId=11111111-1111-4111-8111-111111111111&date=2026-04-13',
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalBookings: 12,
      covers: 34,
    });
    expect(getServiceSupabaseClient).toHaveBeenCalledTimes(1);
    expect(getTodayBookingsSummary).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
      client: { tag: 'service-client' },
      targetDate: '2026-04-13',
    });
  });

  it('rejects an invalid optional date instead of falling back to today', async () => {
    const { GET } = await import('@/src/app/api/ops/dashboard/summary/route');

    const response = await GET(
      new NextRequest(
        'http://localhost/api/ops/dashboard/summary?restaurantId=11111111-1111-4111-8111-111111111111&date=not-a-date',
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid query',
      code: 'VALIDATION_FAILED',
      fields: { date: expect.any(Array) },
    });
    expect(requireSession).not.toHaveBeenCalled();
    expect(getTodayBookingsSummary).not.toHaveBeenCalled();
  });
});
