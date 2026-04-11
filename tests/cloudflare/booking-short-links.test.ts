import { describe, expect, it, vi } from 'vitest';

import {
  createBookingShortLink,
  parseAllowedHosts,
  resolveBookingShortLink,
  validateShortLinkRequest,
} from '@/cloudflare/booking-short-links/src/core';

describe('booking short-link core', () => {
  it('uses default allowed hosts when none are configured', () => {
    expect(parseAllowedHosts(undefined)).toEqual([
      'nabatable.com',
      'www.nabatable.com',
      'app.nabatable.com',
    ]);
  });

  it('validates allowlisted destination URLs', () => {
    expect(
      validateShortLinkRequest(
        {
          purpose: 'booking_manage',
          destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
          bookingId: 'booking-1',
          restaurantId: 'rest-1',
          expiresAt: '2099-01-01T00:00:00.000Z',
          createdBy: 'guest_confirmation_sms',
        },
        ['nabatable.com'],
      ),
    ).toMatchObject({ ok: true });

    expect(
      validateShortLinkRequest(
        {
          purpose: 'booking_manage',
          destinationUrl: 'https://evil.example.com/steal',
          bookingId: 'booking-1',
          restaurantId: 'rest-1',
          expiresAt: '2099-01-01T00:00:00.000Z',
          createdBy: 'guest_confirmation_sms',
        },
        ['nabatable.com'],
      ),
    ).toEqual({
      ok: false,
      error: 'Destination host is not allowlisted.',
    });
  });

  it('reuses an existing active short link for the same booking and SMS source', async () => {
    const repository = {
      findReusableLink: vi.fn().mockResolvedValue({
        token: 'ABC123',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
        destinationHost: 'nabatable.com',
        purpose: 'booking_manage',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        createdAt: '2026-04-11T15:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
        revokedAt: null,
        lastAccessedAt: null,
        createdBy: 'guest_confirmation_sms',
      }),
      insertLink: vi.fn(),
      getLinkByToken: vi.fn(),
      touchLink: vi.fn(),
    };

    const result = await createBookingShortLink({
      repository,
      request: {
        purpose: 'booking_manage',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdBy: 'guest_confirmation_sms',
      },
      shortBaseUrl: 'https://go.nabatable.com',
    });

    expect(result).toEqual({
      token: 'ABC123',
      shortUrl: 'https://go.nabatable.com/m/ABC123',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect(repository.insertLink).not.toHaveBeenCalled();
  });

  it('creates and resolves a new short link record', async () => {
    let insertedToken = '';
    const repository = {
      findReusableLink: vi.fn().mockResolvedValue(null),
      insertLink: vi.fn().mockImplementation(async (record) => {
        insertedToken = record.token;
      }),
      getLinkByToken: vi.fn().mockImplementation(async (token) => {
        if (token !== insertedToken) return null;
        return {
          token,
          destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
          destinationHost: 'nabatable.com',
          purpose: 'booking_manage',
          bookingId: 'booking-1',
          restaurantId: 'rest-1',
          createdAt: '2026-04-11T15:00:00.000Z',
          expiresAt: '2099-01-01T00:00:00.000Z',
          revokedAt: null,
          lastAccessedAt: null,
          createdBy: 'guest_update_sms',
        };
      }),
      touchLink: vi.fn().mockResolvedValue(undefined),
    };

    const created = await createBookingShortLink({
      repository,
      request: {
        purpose: 'booking_manage',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdBy: 'guest_update_sms',
      },
      shortBaseUrl: 'https://go.nabatable.com',
      randomBytes: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    });

    expect(created.shortUrl.startsWith('https://go.nabatable.com/m/')).toBe(true);

    const resolved = await resolveBookingShortLink({
      repository,
      token: created.token,
    });

    expect(resolved).toMatchObject({
      status: 'redirect',
    });
    expect(repository.touchLink).toHaveBeenCalledWith(created.token, expect.any(String));
  });

  it('marks expired records as expired instead of redirecting', async () => {
    const repository = {
      findReusableLink: vi.fn(),
      insertLink: vi.fn(),
      getLinkByToken: vi.fn().mockResolvedValue({
        token: 'ABC123',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
        destinationHost: 'nabatable.com',
        purpose: 'booking_manage',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        createdAt: '2026-04-11T15:00:00.000Z',
        expiresAt: '2026-04-11T15:00:00.000Z',
        revokedAt: null,
        lastAccessedAt: null,
        createdBy: 'guest_update_sms',
      }),
      touchLink: vi.fn(),
    };

    const resolved = await resolveBookingShortLink({
      repository,
      token: 'ABC123',
      now: new Date('2026-04-11T15:01:00.000Z'),
    });

    expect(resolved).toMatchObject({
      status: 'expired',
    });
    expect(repository.touchLink).not.toHaveBeenCalled();
  });
});
