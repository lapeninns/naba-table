import { expect, it } from 'vitest';

import { requiresPublishPreviewAcknowledgement } from '@/components/features/restaurant-settings/dual-sync/dualSyncPublishPreviewDomain';
import { DEV_RESTAURANT_ID } from '@/src/app/(public)/dev/_mocks/devIds';
import { installGbpFetchMock } from '@/src/app/(public)/dev/_mocks/gbp/gbpFetchMock';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';
import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

it('previews and completes an import using the import response contracts', async () => {
  const restore = installGbpFetchMock('linked');
  const request = {
    method: 'POST',
    body: JSON.stringify({
      decisions: [{ fieldKey: 'profile.description', action: 'import_from_google' }],
    }),
  };
  const base = `/api/ops/restaurants/${DEV_RESTAURANT_ID}/dual-sync/publish`;
  try {
    const preview: DualSyncPublishPlan = await (
      await window.fetch(`${base}/preview`, request)
    ).json();
    expect(requiresPublishPreviewAcknowledgement(preview)).toBe(false);
    expect(preview.acceptedCount).toBe(1);
    expect(preview.groups[0]?.direction).toBe('import_from_google');
    const result: DualSyncPublishResponse = await (await window.fetch(base, request)).json();
    expect(result.succeededCount).toBe(1);
    expect(result.failedCount).toBe(0);
  } finally {
    restore();
  }
});
