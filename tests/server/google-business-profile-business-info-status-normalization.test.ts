import { describe, expect, it } from 'vitest';

import { normalizeBusinessStatus } from '@/server/google-business-profile/businessInfoStatusNormalization';

describe('google business profile business info status normalization', () => {
  it('maps known Google business statuses and rejects unknown values', () => {
    expect(normalizeBusinessStatus(' open ')).toBe('open');
    expect(normalizeBusinessStatus('CLOSED_PERMANENTLY')).toBe('closed_permanently');
    expect(normalizeBusinessStatus('CLOSED_TEMPORARILY')).toBe('closed_temporarily');
    expect(normalizeBusinessStatus('UNKNOWN')).toBeNull();
    expect(normalizeBusinessStatus(undefined)).toBeNull();
  });
});
