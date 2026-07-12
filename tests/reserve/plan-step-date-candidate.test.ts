import { describe, expect, it } from 'vitest';

import { findNextCandidateDate } from '@features/reservations/wizard/hooks/usePlanStepForm';

describe('findNextCandidateDate', () => {
  it('selects the next day when it is available @contract', () => {
    expect(findNextCandidateDate('2026-07-07', new Map())).toBe('2026-07-08');
  });

  it('skips multiple consecutive unavailable dates @contract', () => {
    const unavailable = new Map([
      ['2026-07-08', 'closed' as const],
      ['2026-07-09', 'no-slots' as const],
    ]);

    expect(findNextCandidateDate('2026-07-07', unavailable, { skipNoSlots: true })).toBe(
      '2026-07-10',
    );
  });
});
