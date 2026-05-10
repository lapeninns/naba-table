import { describe, expect, it } from 'vitest';

import { defaultDualSyncExportPreflight } from '@/server/dual-sync/publish/preflight';

import type { DualSyncPublishGroup } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: () => ({}) } as unknown as SupabaseClient<Database>;
const snapshot = {} as DualSyncCanonicalSnapshot;

function group(overrides: Partial<DualSyncPublishGroup> = {}): DualSyncPublishGroup {
  return {
    groupId: 'export_to_google:operatingHours:location.regularHours',
    direction: 'export_to_google',
    sectionKey: 'operatingHours',
    writeGroup: 'location.regularHours',
    fields: [],
    riskLevel: 'high',
    requiresPreflight: true,
    requiresManualConfirmation: true,
    destructiveWritePossible: true,
    googleUpdateMasks: ['regularHours'],
    ...overrides,
  };
}

describe('defaultDualSyncExportPreflight', () => {
  it('records a passed contract for required export groups with masks', async () => {
    const result = await defaultDualSyncExportPreflight({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      group: group(),
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      actorUserId: 'user-1',
    });

    expect(result.status).toBe('passed');
    expect(result.result).toMatchObject({
      validator: 'dual_sync_export_preflight_contract',
      googleValidateOnly: 'delegated_to_export_port',
      providerValidateOnly: 'supported',
      preflightUnsupported: false,
      maskStrategy: 'updateMask',
      googleUpdateMasks: ['regularHours'],
      destructiveWritePossible: true,
    });
  });

  it('records attribute-mask exports as preflight-unsupported by Google', async () => {
    const result = await defaultDualSyncExportPreflight({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      group: group({
        sectionKey: 'businessContext.attributes',
        writeGroup: 'location.attributes',
        googleUpdateMasks: ['attributes'],
      }),
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      actorUserId: 'user-1',
    });

    expect(result.status).toBe('passed');
    expect(result.result).toMatchObject({
      googleValidateOnly: 'unsupported',
      providerValidateOnly: 'unsupported',
      preflightUnsupported: true,
      maskStrategy: 'attributeMask',
      unsupportedReason: expect.stringContaining('attributeMask'),
      googleUpdateMasks: ['attributes'],
    });
  });

  it('records FoodMenus replacement exports as preflight-unsupported by Google', async () => {
    const result = await defaultDualSyncExportPreflight({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      group: group({
        sectionKey: 'foodMenus',
        writeGroup: 'location.foodMenus',
        googleUpdateMasks: ['menus'],
      }),
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      actorUserId: 'user-1',
    });

    expect(result.status).toBe('passed');
    expect(result.result).toMatchObject({
      googleValidateOnly: 'unsupported',
      providerValidateOnly: 'unsupported',
      preflightUnsupported: true,
      maskStrategy: 'updateMask',
      unsupportedReason: expect.stringContaining('updateFoodMenus'),
      googleUpdateMasks: ['menus'],
    });
  });

  it('fails required export groups with no Google update masks', async () => {
    const result = await defaultDualSyncExportPreflight({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      group: group({ googleUpdateMasks: [] }),
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      actorUserId: 'user-1',
    });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.failure).toMatchObject({
        code: 'GOOGLE_VALIDATION_FAILED',
        retryable: false,
      });
    }
  });
});
