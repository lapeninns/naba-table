import { describe, expect, it } from 'vitest';

import { buildDualSyncPublishJobsPanelModel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPublishJobsDomain';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';

function makeRollup(overrides: Partial<DualSyncPublishJobRollup> = {}): DualSyncPublishJobRollup {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.500Z',
    totalOperations: 4,
    succeededCount: 2,
    failedCount: 1,
    skippedCount: 1,
    otherCount: 0,
    sections: ['profile'],
    errorCodes: [],
    importCount: 1,
    exportCount: 2,
    ...overrides,
  };
}

describe('dualSyncPublishJobsDomain', () => {
  it('builds the publish jobs panel model from an optional response', () => {
    expect(buildDualSyncPublishJobsPanelModel(undefined)).toEqual({ jobs: [] });
    expect(
      buildDualSyncPublishJobsPanelModel({
        restaurantId: 'restaurant-1',
        jobs: [makeRollup()],
      }),
    ).toEqual({ jobs: [makeRollup()] });
  });
});
