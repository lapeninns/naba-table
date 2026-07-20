import { describe, expect, it } from 'vitest';

import { mapBookingApiError } from '@/server/bookings/api-error';
import { CustomerContactStorageError } from '@/server/customer-contact-errors';

describe('mapBookingApiError contact storage failures', () => {
  it('maps PHONE_REQUIRED to a customer-safe 422 instead of a 500', async () => {
    const mapped = mapBookingApiError(
      new CustomerContactStorageError(
        'PHONE_REQUIRED',
        'A phone number is required to complete this booking.',
      ),
    );
    expect(mapped.status).toBe(422);
    expect(mapped.body.code).toBe('PHONE_REQUIRED');
    expect(mapped.body.error).toContain('phone number');
  });

  it('maps INVALID_CONTACT to a customer-safe 422', () => {
    const mapped = mapBookingApiError(
      new CustomerContactStorageError(
        'INVALID_CONTACT',
        'The provided contact details could not be stored.',
      ),
    );
    expect(mapped.status).toBe(422);
    expect(mapped.body.code).toBe('INVALID_CONTACT');
  });

  it('keeps unknown errors on the INTERNAL_SERVER_ERROR path', () => {
    const mapped = mapBookingApiError(new Error('unexpected'));
    expect(mapped.status).toBe(500);
    expect(mapped.body.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
