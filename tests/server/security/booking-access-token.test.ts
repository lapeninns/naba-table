import { describe, expect, it } from 'vitest';

import { createUnsubscribeToken } from '@/server/emails/unsubscribe-token';
import { sealAeadToken } from '@/server/security/aead-token';
import {
  BOOKING_ACCESS_CREATOR_MAX_SECONDS,
  BOOKING_ACCESS_REDEEM_MAX_SECONDS,
  bookingAccessTokenMatchesBooking,
  computeBookingContactFingerprint,
  createBookingAccessToken,
  isLegacySessionRecoveryToken,
  validateBookingAccessToken,
} from '@/server/security/booking-access-token';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

const secret = 'test-booking-access-secret';
const now = new Date('2026-09-26T12:00:00.000Z');
const nowSeconds = Math.floor(now.getTime() / 1000);
const HOUR = 3600;
const DAY = 24 * HOUR;

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: '65c3207e-318a-4e4b-b82d-1249a720d776',
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    customer_email: 'Alex@Example.com',
    customer_phone: '+447700900123',
    start_at: '2026-09-26T14:00:00.000Z',
    end_at: '2026-09-26T15:30:00.000Z',
    booking_date: '2026-09-26',
    ...overrides,
  };
}

function flip(token: string, partIndex: number): string {
  const parts = token.split('.');
  const bytes = Buffer.from(parts[partIndex], 'base64url');
  bytes[0] = bytes[0] ^ 0xff;
  parts[partIndex] = bytes.toString('base64url');
  return parts.join('.');
}

describe('bk1 booking access token', () => {
  it('round-trips the booking id, restaurant id, source and expiry', () => {
    const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now });
    expect(minted).not.toBeNull();
    expect(minted!.token.startsWith('bk1.')).toBe(true);

    const result = validateBookingAccessToken(minted!.token, { secret, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.bid).toBe(booking().id);
    expect(result.payload.rid).toBe(booking().restaurant_id);
    expect(result.payload.src).toBe('link');
    expect(result.payload.exp).toBe(Math.floor(minted!.expiresAt.getTime() / 1000));
    expect(result.payload.cfp).toHaveLength(22);
  });

  it.each([1, 2, 3])('rejects a flipped byte in part %i as invalid_signature', (partIndex) => {
    const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
    const result = validateBookingAccessToken(flip(minted.token, partIndex), { secret, now });
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('rejects another prefix and malformed tokens', () => {
    const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
    expect(
      validateBookingAccessToken(minted.token.replace(/^bk1/, 'bk2'), { secret, now }),
    ).toEqual({ ok: false, reason: 'invalid_prefix' });
    expect(validateBookingAccessToken('bk1.only-two', { secret, now })).toEqual({
      ok: false,
      reason: 'invalid_format',
    });
  });

  it('keeps domain separation from sr2, unsub1 and the unsubscribe key', () => {
    const sr2 = createSessionRecoveryAccessToken({
      restaurantId: booking().restaurant_id,
      email: 'alex@example.com',
      secret,
      now,
    });
    const unsub = createUnsubscribeToken({ email: 'alex@example.com', secret, now });
    expect(validateBookingAccessToken(sr2, { secret, now }).ok).toBe(false);
    expect(validateBookingAccessToken(unsub, { secret, now }).ok).toBe(false);

    const valid = validateBookingAccessToken(
      createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!.token,
      { secret, now },
    );
    if (!valid.ok) throw new Error('expected a valid token');
    const sealedWithUnsubscribeKey = sealAeadToken({
      prefix: 'bk1',
      keyLabel: 'email-unsubscribe-token',
      secret,
      plaintext: JSON.stringify(valid.payload),
    });
    expect(validateBookingAccessToken(sealedWithUnsubscribeKey, { secret, now })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  it('rejects a payload with unknown keys (strict schema)', () => {
    const valid = validateBookingAccessToken(
      createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!.token,
      { secret, now },
    );
    if (!valid.ok) throw new Error('expected a valid token');
    const tampered = sealAeadToken({
      prefix: 'bk1',
      keyLabel: 'booking-access-token',
      secret,
      plaintext: JSON.stringify({ ...valid.payload, extra: true }),
    });
    expect(validateBookingAccessToken(tampered, { secret, now })).toEqual({
      ok: false,
      reason: 'invalid_payload',
    });
  });

  it('expires one second after exp', () => {
    const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
    const exp = Math.floor(minted.expiresAt.getTime() / 1000);
    expect(validateBookingAccessToken(minted.token, { secret, now: new Date(exp * 1000) }).ok).toBe(
      true,
    );
    expect(
      validateBookingAccessToken(minted.token, { secret, now: new Date((exp + 1) * 1000) }),
    ).toEqual({ ok: false, reason: 'expired' });
  });

  describe('lifetimes', () => {
    it('link for a booking in 2 hours ends 24 hours after the booking ends', () => {
      const endAt = new Date(now.getTime() + 2 * HOUR * 1000);
      const minted = createBookingAccessToken({
        booking: booking({ end_at: endAt.toISOString() }),
        secret,
        source: 'link',
        now,
      })!;
      expect(minted.expiresAt.getTime()).toBe(endAt.getTime() + DAY * 1000);
    });

    it('link for a booking in 200 days is capped at 30 days', () => {
      const endAt = new Date(now.getTime() + 200 * DAY * 1000);
      const minted = createBookingAccessToken({
        booking: booking({ end_at: endAt.toISOString(), start_at: null }),
        secret,
        source: 'link',
        now,
      })!;
      expect(Math.floor(minted.expiresAt.getTime() / 1000)).toBe(nowSeconds + 30 * DAY);
    });

    it('link for an ended booking lives one hour', () => {
      const minted = createBookingAccessToken({
        booking: booking({ end_at: '2026-09-01T20:00:00.000Z' }),
        secret,
        source: 'link',
        now,
      })!;
      expect(Math.floor(minted.expiresAt.getTime() / 1000)).toBe(nowSeconds + HOUR);
    });

    it('falls back to start_at + 4h and then booking_date 23:59 UTC', () => {
      const fromStart = createBookingAccessToken({
        booking: booking({ end_at: null, start_at: '2026-09-27T12:00:00.000Z' }),
        secret,
        source: 'link',
        now,
      })!;
      expect(fromStart.expiresAt.toISOString()).toBe('2026-09-28T16:00:00.000Z');

      const fromDate = createBookingAccessToken({
        booking: booking({ end_at: null, start_at: null, booking_date: '2026-09-27' }),
        secret,
        source: 'link',
        now,
      })!;
      expect(fromDate.expiresAt.toISOString()).toBe('2026-09-28T23:59:00.000Z');
    });

    it('redeem tokens are capped at 14 days and at the link expiry', () => {
      const far = booking({ end_at: new Date(now.getTime() + 60 * DAY * 1000).toISOString() });
      const redeem = createBookingAccessToken({ booking: far, secret, source: 'redeem', now })!;
      expect(Math.floor(redeem.expiresAt.getTime() / 1000)).toBe(
        nowSeconds + BOOKING_ACCESS_REDEEM_MAX_SECONDS,
      );

      const capped = createBookingAccessToken({
        booking: far,
        secret,
        source: 'redeem',
        now,
        notAfter: new Date((nowSeconds + 2 * HOUR) * 1000),
      })!;
      expect(Math.floor(capped.expiresAt.getTime() / 1000)).toBe(nowSeconds + 2 * HOUR);
    });

    it('creator tokens are capped at 24 hours', () => {
      const far = booking({ end_at: new Date(now.getTime() + 10 * DAY * 1000).toISOString() });
      const creator = createBookingAccessToken({ booking: far, secret, source: 'create', now })!;
      expect(Math.floor(creator.expiresAt.getTime() / 1000)).toBe(
        nowSeconds + BOOKING_ACCESS_CREATOR_MAX_SECONDS,
      );
      expect(BOOKING_ACCESS_CREATOR_MAX_SECONDS).toBe(DAY);
    });
  });

  describe('fingerprint', () => {
    it('matches the same contact across case and format variants', () => {
      const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
      const result = validateBookingAccessToken(minted.token, { secret, now });
      if (!result.ok) throw new Error('expected a valid token');

      expect(
        bookingAccessTokenMatchesBooking(
          result.payload,
          booking({ customer_email: '  alex@EXAMPLE.com ', customer_phone: '+44 7700 900123' }),
          secret,
        ),
      ).toBe('ok');
    });

    it('reports revoked when the email or phone changes', () => {
      const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
      const result = validateBookingAccessToken(minted.token, { secret, now });
      if (!result.ok) throw new Error('expected a valid token');

      expect(
        bookingAccessTokenMatchesBooking(
          result.payload,
          booking({ customer_email: 'new@example.com' }),
          secret,
        ),
      ).toBe('revoked');
      expect(
        bookingAccessTokenMatchesBooking(
          result.payload,
          booking({ customer_phone: '+447700900999' }),
          secret,
        ),
      ).toBe('revoked');
    });

    it('reports wrong_booking for another booking or restaurant', () => {
      const minted = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
      const result = validateBookingAccessToken(minted.token, { secret, now });
      if (!result.ok) throw new Error('expected a valid token');

      expect(
        bookingAccessTokenMatchesBooking(
          result.payload,
          booking({ id: '75c3207e-318a-4e4b-b82d-1249a720d777' }),
          secret,
        ),
      ).toBe('wrong_booking');
      expect(
        bookingAccessTokenMatchesBooking(
          result.payload,
          booking({ restaurant_id: '22222222-2222-4222-8222-222222222222' }),
          secret,
        ),
      ).toBe('wrong_booking');
    });

    it('is keyed by the secret (different secret, different fingerprint)', () => {
      expect(computeBookingContactFingerprint('a@b.co', null, secret)).not.toBe(
        computeBookingContactFingerprint('a@b.co', null, `${secret}-other`),
      );
      expect(computeBookingContactFingerprint(null, null, secret)).toBeNull();
    });
  });

  it('mints distinct tokens for the same booking', () => {
    const a = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
    const b = createBookingAccessToken({ booking: booking(), secret, source: 'link', now })!;
    expect(a.token).not.toBe(b.token);
  });

  it('returns null for preview ids and missing contact', () => {
    expect(
      createBookingAccessToken({
        booking: booking({ id: 'preview-confirmed' }),
        secret,
        source: 'link',
        now,
      }),
    ).toBeNull();
    expect(
      createBookingAccessToken({
        booking: booking({ customer_email: null, customer_phone: '' }),
        secret,
        source: 'link',
        now,
      }),
    ).toBeNull();
    expect(
      createBookingAccessToken({
        booking: booking({ restaurant_id: null }),
        secret,
        source: 'link',
        now,
      }),
    ).toBeNull();
  });

  it('recognises legacy sr2 tokens', () => {
    expect(isLegacySessionRecoveryToken('sr2.a.b.c')).toBe(true);
    expect(isLegacySessionRecoveryToken('bk1.a.b.c')).toBe(false);
    expect(isLegacySessionRecoveryToken(null)).toBe(false);
  });
});
