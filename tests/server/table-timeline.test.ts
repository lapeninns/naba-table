import { describe, expect, it } from 'vitest';

import { normalizeOpsStatus } from '@/server/ops/table-timeline';

describe('normalizeOpsStatus', () => {
  it('keeps supported statuses', () => {
    expect(normalizeOpsStatus('pending')).toBe('pending');
    expect(normalizeOpsStatus('checked_in')).toBe('checked_in');
    expect(normalizeOpsStatus('completed')).toBe('completed');
  });

  it('coerces unsupported statuses to pending', () => {
    expect(normalizeOpsStatus('unknown')).toBe('pending');
    expect(normalizeOpsStatus(undefined)).toBe('pending');
    expect(normalizeOpsStatus(null)).toBe('pending');
  });
});
