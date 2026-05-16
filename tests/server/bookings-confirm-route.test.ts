import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const validateConfirmationTokenMock = vi.hoisted(() => vi.fn());
const markTokenUsedMock = vi.hoisted(() => vi.fn());
const toPublicConfirmationMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/security/request', () => ({
  extractClientIp: vi.fn(() => '127.0.0.1'),
  anonymizeIp: vi.fn(() => '127.0.0.0/24'),
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/bookings/confirmation-token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/bookings/confirmation-token')>();
  return {
    ...actual,
    validateConfirmationToken: validateConfirmationTokenMock,
    markTokenUsed: markTokenUsedMock,
    toPublicConfirmation: toPublicConfirmationMock,
  };
});

import { generateConfirmationToken } from '@/server/bookings/confirmation-token';
import { GET } from '@/src/app/api/bookings/confirm/route';

function restaurantQuery() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi
      .fn()
      .mockResolvedValue({ data: { name: 'The Bell', slug: 'the-bell' }, error: null }),
  };
  return builder;
}

describe('GET /api/bookings/confirm', () => {
  beforeEach(() => {
    consumeRateLimitMock.mockReset();
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
    });
    validateConfirmationTokenMock.mockReset();
    validateConfirmationTokenMock.mockResolvedValue({
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
    });
    markTokenUsedMock.mockReset();
    markTokenUsedMock.mockResolvedValue(undefined);
    toPublicConfirmationMock.mockReset();
    toPublicConfirmationMock.mockReturnValue({ id: 'booking-1', restaurantName: 'The Bell' });
    getServiceSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReturnValue({ from: vi.fn(() => restaurantQuery()) });
  });

  it('accepts tokens produced by the application generator', async () => {
    const token = generateConfirmationToken();

    expect(token).toHaveLength(43);

    const response = await GET(
      new NextRequest(`https://www.nabatable.com/api/bookings/confirm?token=${token}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(validateConfirmationTokenMock).toHaveBeenCalledWith(token);
    expect(markTokenUsedMock).toHaveBeenCalledWith(token);
    expect(body).toEqual({ booking: { id: 'booking-1', restaurantName: 'The Bell' } });
  });
});
