import { describe, expect, it } from 'vitest';

import {
  createRestaurantSchema,
  updateRestaurantSchema,
} from '@/src/app/api/ops/restaurants/schema';

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const BEL = String.fromCharCode(7);

describe('restaurant name control-character hardening', () => {
  it('rejects a restaurant name containing CR/LF control characters on create', () => {
    const result = createRestaurantSchema.safeParse({
      name: `Acme${CR}${LF}Bcc: x@y.com`,
      timezone: 'Europe/London',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a restaurant name containing a non-printable control character on update', () => {
    const result = updateRestaurantSchema.safeParse({
      name: `Acme${BEL}Evil`,
    });

    expect(result.success).toBe(false);
  });

  it('still accepts a normal restaurant name', () => {
    expect(
      createRestaurantSchema.safeParse({
        name: 'The Atomic Arms',
        timezone: 'Europe/London',
      }).success,
    ).toBe(true);
  });
});
