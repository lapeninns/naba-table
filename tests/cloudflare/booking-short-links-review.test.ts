import { describe, expect, it, vi } from 'vitest';

import {
  createBookingShortLink,
  resolveBookingShortLink,
  validateShortLinkRequest,
} from '@/cloudflare/booking-short-links/src/core';

import type { ShortLinkRecord } from '@/cloudflare/booking-short-links/src/contracts';

const reviewRequest = {
  purpose: 'review',
  destinationUrl: 'https://search.google.com/local/writereview?placeid=venue-1',
  bookingId: 'booking-1',
  restaurantId: 'rest-1',
  expiresAt: '2099-01-01T00:00:00.000Z',
  createdBy: 'guest_review_whatsapp',
} as const;

function reviewRecord(overrides: Partial<ShortLinkRecord> = {}): ShortLinkRecord {
  return {
    token: 'Review123456',
    destinationUrl: 'https://g.page/demo-venue/review',
    destinationHost: 'g.page',
    purpose: 'review',
    bookingId: 'booking-1',
    restaurantId: 'rest-1',
    createdAt: '2026-07-12T18:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    revokedAt: null,
    lastAccessedAt: null,
    createdBy: 'guest_review_whatsapp',
    ...overrides,
  };
}

function repositoryFor(record: ShortLinkRecord) {
  return {
    findReusableLink: vi.fn().mockResolvedValue(record),
    insertLink: vi.fn(),
    getLinkByToken: vi.fn().mockResolvedValue(record),
    touchLink: vi.fn(),
  };
}

describe('review short-link core', () => {
  it('accepts supported HTTPS Google review destinations', () => {
    expect(validateShortLinkRequest(reviewRequest, ['nabatable.com'])).toMatchObject({ ok: true });
    expect(
      validateShortLinkRequest(
        { ...reviewRequest, destinationUrl: 'https://g.page/demo-venue/review' },
        ['nabatable.com'],
      ),
    ).toMatchObject({ ok: true });
  });

  it.each([
    'http://search.google.com/local/writereview?placeid=venue-1',
    'https://search.google.com/search?q=venue',
    'https://www.google.com/url?review=1&q=https%3A%2F%2Fevil.test',
    'https://www.google.com/url?q=https%3A%2F%2Fg.page%2Fvenue%2Freview',
    'https://www.google.com/search?q=writereview',
    'https://evil.test@search.google.com/local/writereview?placeid=venue-1',
    'https://search.google.com:444/local/writereview?placeid=venue-1',
    'https://maps.google.com/?q=venue',
    'https://google.com.evil.test/review',
    'https://evil.test/google.com/review',
  ])('rejects unsafe review destination %s', (destinationUrl) => {
    expect(
      validateShortLinkRequest({ ...reviewRequest, destinationUrl }, ['nabatable.com']),
    ).toMatchObject({ ok: false });
  });

  it('keeps creation sources bound to their purpose', () => {
    expect(
      validateShortLinkRequest({ ...reviewRequest, createdBy: 'guest_confirmation_sms' }, [
        'nabatable.com',
      ]),
    ).toEqual({ ok: false, error: 'Creation source is not allowed for this purpose.' });
    expect(
      validateShortLinkRequest(
        {
          ...reviewRequest,
          purpose: 'booking_manage',
          destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
          createdBy: 'guest_review_whatsapp',
        },
        ['nabatable.com'],
      ),
    ).toEqual({ ok: false, error: 'Creation source is not allowed for this purpose.' });
  });

  it('reuses only the matching review-purpose record', async () => {
    const record = reviewRecord();
    const repository = repositoryFor(record);

    const result = await createBookingShortLink({
      repository,
      request: { ...reviewRequest, destinationUrl: record.destinationUrl },
      shortBaseUrl: 'https://go.nabatable.com',
    });

    expect(result.shortUrl).toBe('https://go.nabatable.com/r/Review123456');
    expect(repository.findReusableLink).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'review',
        createdBy: 'guest_review_whatsapp',
        destinationUrl: record.destinationUrl,
      }),
    );
    expect(repository.insertLink).not.toHaveBeenCalled();
  });

  it('fails closed when a token is resolved through the wrong purpose', async () => {
    const repository = repositoryFor(
      reviewRecord({
        purpose: 'booking_manage',
        destinationUrl: 'https://nabatable.com/bookings/recover?token=abc',
        destinationHost: 'nabatable.com',
        createdBy: 'guest_confirmation_sms',
      }),
    );

    await expect(
      resolveBookingShortLink({ repository, token: 'Review123456', purpose: 'review' }),
    ).resolves.toEqual({ status: 'missing' });
    expect(repository.touchLink).not.toHaveBeenCalled();
  });

  it.each([
    reviewRecord({ revokedAt: '2026-07-12T19:00:00.000Z' }),
    reviewRecord({ destinationUrl: 'https://search.google.com/search?q=demo' }),
  ])('does not resolve a revoked or unsafe stored review record', async (record) => {
    const repository = repositoryFor(record);

    const result = await resolveBookingShortLink({
      repository,
      token: record.token,
      purpose: 'review',
      now: new Date('2026-07-12T20:00:00.000Z'),
    });

    expect(['expired', 'missing']).toContain(result.status);
    expect(repository.touchLink).not.toHaveBeenCalled();
  });
});
