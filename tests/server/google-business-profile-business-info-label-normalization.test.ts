import { describe, expect, it } from 'vitest';

import { humanizeIdentifier } from '@/server/google-business-profile/businessInfoLabelNormalization';

describe('google business profile business info label normalization', () => {
  it('humanizes provider identifiers with existing separators and casing', () => {
    expect(humanizeIdentifier('business.services_table-service')).toBe(
      'Business Services Table Service',
    );
    expect(humanizeIdentifier('PAYMENT_OPTIONS/CREDIT_CARD')).toBe('Payment Options Credit Card');
    expect(humanizeIdentifier('   ')).toBeNull();
    expect(humanizeIdentifier(null)).toBeNull();
  });
});
