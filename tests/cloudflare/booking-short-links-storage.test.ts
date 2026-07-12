import { describe, expect, it, vi } from 'vitest';

import { createShortLinkRepository } from '@/cloudflare/booking-short-links/src/storage';

function makeDb(row: Record<string, unknown> | null) {
  const first = vi.fn().mockResolvedValue(row);
  const run = vi.fn().mockResolvedValue(undefined);
  const bind = vi.fn(() => ({ first, run }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    db: { prepare },
    prepare,
    bind,
    first,
    run,
  };
}

describe('booking short-link storage', () => {
  it('uses D1 revocation state instead of returning a stale cached active link', async () => {
    const revokedAt = '2026-05-16T12:00:00.000Z';
    const { db, prepare, first } = makeDb({
      token: 'short-token',
      destination_url: 'https://nabatable.com/bookings/recover?token=secret',
      destination_host: 'nabatable.com',
      purpose: 'booking_manage',
      booking_id: 'booking-1',
      restaurant_id: 'restaurant-1',
      created_at: '2026-05-16T11:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
      revoked_at: revokedAt,
      last_accessed_at: null,
      created_by: 'guest_confirmation_sms',
    });
    const cache = {
      get: vi.fn().mockResolvedValue({
        token: 'short-token',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=secret',
        destinationHost: 'nabatable.com',
        purpose: 'booking_manage',
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        createdAt: '2026-05-16T11:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
        revokedAt: null,
        lastAccessedAt: null,
        createdBy: 'guest_confirmation_sms',
      }),
      put: vi.fn(),
    };

    const repository = createShortLinkRepository({ db, cache });

    await expect(repository.getLinkByToken('short-token')).resolves.toMatchObject({
      token: 'short-token',
      revokedAt,
    });
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('FROM booking_short_links'));
    expect(first).toHaveBeenCalled();
  });

  it('queries reusable review links by purpose, source, destination, and active TTL', async () => {
    const destinationUrl = 'https://g.page/demo-venue/review';
    const { db, bind } = makeDb({
      token: 'Review123456',
      destination_url: destinationUrl,
      destination_host: 'g.page',
      purpose: 'review',
      booking_id: 'booking-1',
      restaurant_id: 'restaurant-1',
      created_at: '2026-07-12T18:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
      revoked_at: null,
      last_accessed_at: null,
      created_by: 'guest_review_whatsapp',
    });
    const repository = createShortLinkRepository({ db });

    const record = await repository.findReusableLink({
      bookingId: 'booking-1',
      purpose: 'review',
      createdBy: 'guest_review_whatsapp',
      destinationUrl,
      nowIso: '2026-07-12T20:00:00.000Z',
    });

    expect(bind).toHaveBeenCalledWith(
      'booking-1',
      'review',
      'guest_review_whatsapp',
      destinationUrl,
      '2026-07-12T20:00:00.000Z',
    );
    expect(record).toMatchObject({
      purpose: 'review',
      createdBy: 'guest_review_whatsapp',
      destinationUrl,
    });
  });
});
