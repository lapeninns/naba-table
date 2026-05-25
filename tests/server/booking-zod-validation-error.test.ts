import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { mapBookingZodValidationFailure } from '@/server/bookings/zod-validation-error';

describe('booking Zod validation failure mapper', () => {
  it('uses the first field error in the public message', () => {
    const schema = z.object({
      email: z.string().email(),
      party: z.number().int().min(1),
    });

    const parsed = schema.safeParse({ email: 'not-an-email', party: 0 });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const result = mapBookingZodValidationFailure(parsed.error);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Validation failed - email: Invalid email address');
      expect(result.body.code).toBe('VALIDATION_FAILED');
      expect(result.body.details.fieldErrors.email).toEqual(['Invalid email address']);
      expect(result.body.details.fieldErrors.party).toEqual([
        'Too small: expected number to be >=1',
      ]);
    }
  });

  it('uses the existing fallback message when no field error exists', () => {
    const schema = z.object({}).superRefine((_value, context) => {
      context.addIssue({
        code: 'custom',
        message: 'Object-level failure',
      });
    });

    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      expect(mapBookingZodValidationFailure(parsed.error)).toEqual({
        status: 400,
        body: {
          error: 'Validation failed - Invalid payload',
          code: 'VALIDATION_FAILED',
          details: {
            formErrors: ['Object-level failure'],
            fieldErrors: {},
          },
        },
      });
    }
  });
});
