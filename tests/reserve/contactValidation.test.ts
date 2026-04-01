import { describe, expect, it } from 'vitest';

import { formatUKPhoneToE164, isUKPhone, normalizeComparablePhone } from '@reserve/shared/validation';

describe('shared UK phone validation', () => {
  it('accepts a broad range of valid UK numbering-plan numbers', () => {
    const accepted = [
      '020 7123 4567',
      '0121 496 0123',
      '07123 456789',
      '0800 123 4567',
      '0845 123 4567',
      '0870 123 4567',
      '0900 123 4567',
      '0300 123 4567',
      '0333 123 4567',
      '055 1234 5678',
      '056 1234 5678',
      '070 1234 5678',
      '07624 123456',
      '07781 123456',
      '07797 123456',
      '+44 20 7123 4567',
      '+44 7624 123456',
      '+44 7781 123456',
      '+44 7797 123456',
    ];

    for (const value of accepted) {
      expect(isUKPhone(value)).toBe(true);
      expect(formatUKPhoneToE164(value)).toMatch(/^\+44\d+$/);
      expect(normalizeComparablePhone(value)).toMatch(/^44\d+$/);
    }
  });

  it('rejects invalid or unsupported samples', () => {
    const rejected = [
      '',
      '12345',
      '01632 960123',
      '500 123 456',
      '+1 650 555 1234',
      'abcdefg',
    ];

    for (const value of rejected) {
      expect(isUKPhone(value)).toBe(false);
    }
  });
});
