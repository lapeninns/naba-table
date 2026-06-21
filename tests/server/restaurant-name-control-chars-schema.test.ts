import { describe, expect, it } from 'vitest';

import { createRestaurantSchema, updateRestaurantSchema } from '@/app/api/ops/restaurants/schema';

// triage-042 (defense in depth): the restaurant name is single-line and flows into the email
// From display name; the schema must reject CR/LF and other control characters.
const BELL = String.fromCharCode(7); // non-printable C0 control char

describe('restaurant name control-character hardening (triage-042)', () => {
  it('rejects a restaurant name containing CR/LF on create', () => {
    expect(createRestaurantSchema.shape.name.safeParse('Acme\r\nBcc: x@y.com').success).toBe(false);
  });

  it('rejects a restaurant name containing a non-printable control character on update', () => {
    expect(updateRestaurantSchema.shape.name.safeParse(`Acme${BELL}Corp`).success).toBe(false);
  });

  it('still accepts a normal restaurant name on create and update', () => {
    expect(createRestaurantSchema.shape.name.safeParse('The Atomic Arms').success).toBe(true);
    expect(updateRestaurantSchema.shape.name.safeParse('The Atomic Arms').success).toBe(true);
  });
});
