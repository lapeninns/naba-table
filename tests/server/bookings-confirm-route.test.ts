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
  const actual = await importOriginal<typeof ConfirmationTokenModule>();
  return {
    ...actual,
    validateConfirmationToken: validateConfirmationTokenMock,
    markTokenUsed: markTokenUsedMock,
    toPublicConfirmation: toPublicConfirmationMock,
  };
});

import {
  buildBookingConfirmationTokenAttachment,
  generateConfirmationToken,
  getStoredBookingConfirmationTokenState,
  isConfirmationTokenFormat,
  resolveBookingCreateConfirmationToken,
} from '@/server/bookings/confirmation-token';
import { GET } from '@/src/app/api/bookings/confirm/route';

import type { BookingRecord } from '@/server/bookings';
import type * as ConfirmationTokenModule from '@/server/bookings/confirmation-token';

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

describe('getStoredBookingConfirmationTokenState', () => {
  it('extracts stored confirmation token and string expiry', () => {
    expect(
      getStoredBookingConfirmationTokenState({
        confirmation_token: 'token-1',
        confirmation_token_expires_at: '2026-05-24T12:00:00.000Z',
      } as BookingRecord),
    ).toEqual({
      confirmationToken: 'token-1',
      confirmationTokenExpiresAt: '2026-05-24T12:00:00.000Z',
    });
  });

  it('normalizes missing token and invalid expiry values to null', () => {
    expect(
      getStoredBookingConfirmationTokenState({
        confirmation_token: null,
        confirmation_token_expires_at: 123,
      } as unknown as BookingRecord),
    ).toEqual({
      confirmationToken: null,
      confirmationTokenExpiresAt: null,
    });
  });

  it('normalizes absent expiry property to null', () => {
    expect(
      getStoredBookingConfirmationTokenState({
        confirmation_token: 'token-1',
      } as BookingRecord),
    ).toEqual({
      confirmationToken: 'token-1',
      confirmationTokenExpiresAt: null,
    });
  });
});

describe('buildBookingConfirmationTokenAttachment', () => {
  it('returns null when the booking already has a token and expiry', () => {
    expect(
      buildBookingConfirmationTokenAttachment({
        bookingId: 'booking-1',
        confirmationToken: 'token-1',
        confirmationTokenExpiresAt: '2026-05-24T12:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('reuses a stored token when only expiry is missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'));

    try {
      expect(
        buildBookingConfirmationTokenAttachment({
          bookingId: 'booking-1',
          confirmationToken: 'token-1',
          confirmationTokenExpiresAt: null,
        }),
      ).toEqual({
        bookingId: 'booking-1',
        confirmationToken: 'token-1',
        confirmationTokenExpiresAt: '2026-06-22T12:00:00.000Z',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('generates a token when only expiry is stored', () => {
    const attachment = buildBookingConfirmationTokenAttachment({
      bookingId: 'booking-1',
      confirmationToken: null,
      confirmationTokenExpiresAt: '2026-05-24T12:00:00.000Z',
    });

    expect(attachment?.bookingId).toBe('booking-1');
    expect(attachment?.confirmationTokenExpiresAt).toBe('2026-05-24T12:00:00.000Z');
    expect(attachment?.confirmationToken).toEqual(expect.any(String));
    expect(isConfirmationTokenFormat(attachment?.confirmationToken ?? '')).toBe(true);
  });

  it('generates a token and computes the aligned default expiry when both are missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'));

    try {
      const attachment = buildBookingConfirmationTokenAttachment({
        bookingId: 'booking-1',
        confirmationToken: null,
        confirmationTokenExpiresAt: null,
      });

      expect(attachment?.bookingId).toBe('booking-1');
      expect(attachment?.confirmationTokenExpiresAt).toBe('2026-06-22T12:00:00.000Z');
      expect(attachment?.confirmationToken).toEqual(expect.any(String));
      expect(isConfirmationTokenFormat(attachment?.confirmationToken ?? '')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('resolveBookingCreateConfirmationToken', () => {
  it('returns the stored token for reused bookings without attaching a new token', async () => {
    const attachToken = vi.fn();

    await expect(
      resolveBookingCreateConfirmationToken({
        booking: {
          id: 'booking-1',
          confirmation_token: 'stored-token',
          confirmation_token_expires_at: '2026-05-24T12:00:00.000Z',
        },
        reusedExisting: true,
        attachToken,
      }),
    ).resolves.toBe('stored-token');

    expect(attachToken).not.toHaveBeenCalled();
  });

  it('returns the stored token for new bookings that already have token state', async () => {
    const attachToken = vi.fn();

    await expect(
      resolveBookingCreateConfirmationToken({
        booking: {
          id: 'booking-1',
          confirmation_token: 'stored-token',
          confirmation_token_expires_at: '2026-05-24T12:00:00.000Z',
        },
        reusedExisting: false,
        attachToken,
      }),
    ).resolves.toBe('stored-token');

    expect(attachToken).not.toHaveBeenCalled();
  });

  it('attaches a missing expiry for new bookings and returns the token to use', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'));
    const attachToken = vi.fn(async () => undefined);

    try {
      await expect(
        resolveBookingCreateConfirmationToken({
          booking: {
            id: 'booking-1',
            confirmation_token: 'stored-token',
            confirmation_token_expires_at: null,
          },
          reusedExisting: false,
          attachToken,
        }),
      ).resolves.toBe('stored-token');
    } finally {
      vi.useRealTimers();
    }

    expect(attachToken).toHaveBeenCalledWith(
      'booking-1',
      'stored-token',
      '2026-06-22T12:00:00.000Z',
    );
  });

  it('propagates attachment failures so the route can log and continue', async () => {
    const attachError = new Error('attach failed');

    await expect(
      resolveBookingCreateConfirmationToken({
        booking: {
          id: 'booking-1',
          confirmation_token: 'stored-token',
          confirmation_token_expires_at: null,
        },
        reusedExisting: false,
        attachToken: vi.fn(async () => {
          throw attachError;
        }),
      }),
    ).rejects.toThrow(attachError);
  });
});
