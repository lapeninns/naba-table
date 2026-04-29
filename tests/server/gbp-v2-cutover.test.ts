import { describe, expect, it } from 'vitest';

import { isGbpSyncV2Enabled } from '@/server/google-business-profile-v2/flag';

const RESTAURANT_ID = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c';

describe('isGbpSyncV2Enabled', () => {
  it('keeps V2 enabled without rollout environment flags', () => {
    expect(isGbpSyncV2Enabled({ restaurantId: RESTAURANT_ID })).toBe(true);
  });
});
