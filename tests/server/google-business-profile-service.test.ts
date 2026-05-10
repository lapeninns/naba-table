import { describe, expect, it } from 'vitest';

import { getProviderReferenceUpdatedAt } from '@/server/google-business-profile/service';

describe('getProviderReferenceUpdatedAt', () => {
  it('returns the most recent persisted provider timestamp', () => {
    expect(
      getProviderReferenceUpdatedAt({
        last_pull_at: '2026-04-18T11:00:00.000Z',
        last_push_at: '2026-04-18T12:00:00.000Z',
      }),
    ).toBe('2026-04-18T12:00:00.000Z');
  });

  it('returns null when neither persisted timestamp is available', () => {
    expect(
      getProviderReferenceUpdatedAt({
        last_pull_at: null,
        last_push_at: null,
      }),
    ).toBeNull();
  });
});
