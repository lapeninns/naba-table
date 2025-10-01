import { describe, expect, it } from 'vitest';

import { isEmail, isUKPhone } from '@reserve/shared/validation';

describe('contact validation helpers', () => {
  it('validates email addresses', () => {
    expect(isEmail('hello@example.com')).toBe(true);
    expect(isEmail('invalid@')).toBe(false);
  });

  it('validates UK mobile numbers', () => {
    expect(isUKPhone('07123456789')).toBe(true);
    expect(isUKPhone('+447123456789')).toBe(true);
    expect(isUKPhone('00123456789')).toBe(false);
  });
});
