import { describe, expect, it } from 'vitest';

import { isRolloutEnabled } from '@/lib/feature-flags/rollout';

describe('isRolloutEnabled', () => {
  it('respects 0% and 100%', () => {
    expect(isRolloutEnabled({ percent: 0, subject: 'abc', salt: 'flag' })).toBe(false);
    expect(isRolloutEnabled({ percent: 100, subject: 'abc', salt: 'flag' })).toBe(true);
  });

  it('is deterministic for same inputs', () => {
    const a = isRolloutEnabled({ percent: 25, subject: 'user-1', salt: 'flag-x' });
    const b = isRolloutEnabled({ percent: 25, subject: 'user-1', salt: 'flag-x' });
    expect(a).toBe(b);
  });
});
