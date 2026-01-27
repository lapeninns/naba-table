import { describe, expect, it } from 'vitest';

import { formatUKPhoneToE164, isUKPhone } from './contact';

describe('UK phone validation', () => {
  it('accepts valid UK mobiles and landlines', () => {
    expect(isUKPhone('07123 456789')).toBe(true);
    expect(isUKPhone('+447123456789')).toBe(true);
    expect(isUKPhone('020 7123 4567')).toBe(true);
    expect(isUKPhone('+442071234567')).toBe(true);
  });

  it('accepts valid UK non-geographic numbers', () => {
    expect(isUKPhone('0300 123 4567')).toBe(true);
  });

  it('rejects invalid or non-UK numbers', () => {
    expect(isUKPhone('12345')).toBe(false);
    expect(isUKPhone('+33123456789')).toBe(false);
    expect(isUKPhone('not-a-phone')).toBe(false);
  });
});

describe('UK phone canonicalization', () => {
  it('formats valid numbers to E.164', () => {
    expect(formatUKPhoneToE164('07123 456789')).toBe('+447123456789');
    expect(formatUKPhoneToE164('020 7123 4567')).toBe('+442071234567');
  });

  it('returns null for invalid numbers', () => {
    expect(formatUKPhoneToE164('12345')).toBeNull();
    expect(formatUKPhoneToE164(null)).toBeNull();
    expect(formatUKPhoneToE164(undefined)).toBeNull();
  });
});
