import { describe, expect, it } from 'vitest';

import {
  bookingCreateRequestSchema,
  contactBookingLookupQuerySchema,
  DEFAULT_SEATING_PREFERENCE,
} from '@/server/bookings/request-validation';

const validBookingRequest = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantSlug: 'old-crown',
  date: '2026-05-23',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  notes: 'Window table',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '07123456789',
};

describe('booking request validation', () => {
  describe('contact booking lookup query schema', () => {
    it('accepts the existing contact lookup query shape', () => {
      expect(
        contactBookingLookupQuerySchema.parse({
          restaurantId: '11111111-1111-4111-8111-111111111111',
          email: 'guest@example.com',
          phone: '07123456789',
        }),
      ).toEqual({
        restaurantId: '11111111-1111-4111-8111-111111111111',
        email: 'guest@example.com',
        phone: '07123456789',
      });
    });

    it('rejects invalid email and UK phone values', () => {
      const parsed = contactBookingLookupQuerySchema.safeParse({
        email: 'not-an-email',
        phone: '123',
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
          expect.arrayContaining(['email', 'phone']),
        );
      }
    });
  });

  describe('booking create request schema', () => {
    it('accepts the existing booking create request shape and applies defaults', () => {
      expect(bookingCreateRequestSchema.parse(validBookingRequest)).toEqual({
        ...validBookingRequest,
        marketingOptIn: false,
      });
      expect(DEFAULT_SEATING_PREFERENCE).toBe('any');
    });

    it('allows nullable notes and coerces marketing opt-in values', () => {
      expect(
        bookingCreateRequestSchema.parse({
          ...validBookingRequest,
          notes: null,
          marketingOptIn: 'true',
        }),
      ).toMatchObject({
        notes: null,
        marketingOptIn: true,
      });
    });

    it('parses explicit false marketing opt-in strings as false', () => {
      expect(
        bookingCreateRequestSchema.parse({
          ...validBookingRequest,
          marketingOptIn: 'false',
        }),
      ).toMatchObject({
        marketingOptIn: false,
      });

      expect(
        bookingCreateRequestSchema.parse({
          ...validBookingRequest,
          marketingOptIn: '0',
        }),
      ).toMatchObject({
        marketingOptIn: false,
      });
    });

    it('rejects invalid slug, date, time, party size, and phone values', () => {
      const parsed = bookingCreateRequestSchema.safeParse({
        ...validBookingRequest,
        restaurantSlug: 'bad slug',
        date: '23-05-2026',
        time: '6:30',
        party: 999,
        phone: '123',
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
          expect.arrayContaining(['restaurantSlug', 'date', 'time', 'party', 'phone']),
        );
      }
    });
  });
});
